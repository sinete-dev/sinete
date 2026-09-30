/**
 * Montagem da DPS: entrada do domínio (`DadosDps`) para o XML canônico do leiaute 1.01 vigente, validado no XSD antes
 * de devolver, e assinatura por splice (`assinarDps`).
 *
 * O XML sai com a declaração `<?xml version="1.0" encoding="UTF-8"?>`: a Sefin Nacional recusa sem ela (E1229,
 * aprendido no spike S2, ADR 0004). A declaração fica fora do elemento assinado (`infDPS`), então a assinatura é a
 * mesma com ou sem ela; o sinete a põe antes de assinar para que a string assinada seja exatamente a enviada.
 */

import type { Ambiente, Assinador, ContextoDeTempo, Ocorrencia, Relogio } from '@sinete/core';
import { ErroDeConfiguracao, formatarDataHoraComFuso, formatarVerProc, tpAmbDoAmbiente } from '@sinete/core';
import { assinarXml, ErroXml } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { ErroSerializacao, serializarRaiz, validarRaiz } from '@sinete/schemas';
import type {
  TCInfDPS,
  TCInfoValores,
  TCRTCInfoIBSCBS,
  TCServ,
  TCTribMunicipal,
  TCTribTotal,
} from '@sinete/schemas/nfse/1.01-20260727';
import { cnpjValido, cpfValido } from '@sinete/validators';
import type { InscricaoFederal } from './codigos.ts';
import { cTribNacDps, idDps } from './codigos.ts';
import { leiauteVigente, VERSAO_LEIAUTE } from './leiaute.ts';
import type { DadosDps, IbsCbsDps, Pessoa, Prestador } from './model.ts';
import { formatarValor } from './valores.ts';
import { VERSAO_PACOTE } from './versao-gerada.ts';

/** Declaração XML exigida pela Sefin Nacional (E1229). */
export const DECLARACAO_XML = '<?xml version="1.0" encoding="UTF-8"?>';

/** Fuso de Brasília, o padrão do `dhEmi` e da data de competência. */
const BRASILIA = -180;

export interface MontarDpsOpcoes {
  readonly ambiente: Ambiente;
  /** Relógios de emissão (`dhEmi`, escolha do leiaute) e de fato gerador (`dCompet` padrão). */
  readonly tempo: ContextoDeTempo;
  /** Versão do aplicativo (`verAplic`, até 20 caracteres). Padrão `sinete <versão do @sinete/nfse>` (`formatarVerProc`). */
  readonly verAplic?: string;
  /** Fuso do `dhEmi` e da competência padrão, em minutos. Padrão -180 (Brasília). */
  readonly deslocamentoMin?: number;
}

/** DPS montada e validada, pronta para assinar. */
export interface DpsMontada {
  /** XML com a declaração UTF-8 e sem assinatura. */
  readonly xml: string;
  /** Id do `infDPS` (`DPS` + 42 posições). */
  readonly id: string;
  readonly ambiente: Ambiente;
  /** Subpath do módulo de schema usado (`nfse/1.01-20260727`). */
  readonly modulo: string;
  readonly dhEmi: string;
  readonly dCompet: string;
}

export type ResultadoMontagemDps =
  | { readonly ok: true; readonly valor: DpsMontada }
  | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[] };

type Doc = { CNPJ?: string; CPF?: string; NIF?: string; cNaoNIF?: string };

function conferirDocumento(doc: Doc | undefined, path: string, issues: Ocorrencia[]): void {
  if (doc === undefined) return;
  if (doc.CNPJ !== undefined && !cnpjValido(doc.CNPJ)) {
    issues.push({ caminho: `${path}.CNPJ`, code: 'documento_invalido', mensagem: 'CNPJ inválido (DV)' });
  }
  if (doc.CPF !== undefined && !cpfValido(doc.CPF)) {
    issues.push({ caminho: `${path}.CPF`, code: 'documento_invalido', mensagem: 'CPF inválido (DV)' });
  }
}

function inscricaoDoEmitente(input: DadosDps, issues: Ocorrencia[]): InscricaoFederal | undefined {
  const tp = input.tpEmit ?? '1';
  const [quem, path]: [Doc | undefined, string] =
    tp === '1'
      ? [input.prestador as Doc, 'prestador']
      : tp === '2'
        ? [input.tomador as Doc | undefined, 'tomador']
        : [input.intermediario as Doc | undefined, 'intermediario'];
  if (quem?.CNPJ !== undefined) return { CNPJ: quem.CNPJ };
  if (quem?.CPF !== undefined) return { CPF: quem.CPF };
  issues.push({
    caminho: path,
    code: 'emitente_sem_inscricao',
    mensagem: `o emitente da DPS (tpEmit ${tp}) precisa de CNPJ ou CPF: é a inscrição que forma o Id`,
  });
  return undefined;
}

function texto(v: string | number | bigint, pattern: RegExp, path: string, issues: Ocorrencia[]): string {
  const s = String(v).trim();
  if (!pattern.test(s)) issues.push({ caminho: path, code: 'campo_invalido', mensagem: `valor fora do formato: ${s}` });
  return s;
}

function ibsCbsDps(g: IbsCbsDps, issues: Ocorrencia[]): TCRTCInfoIBSCBS {
  const c = g.classificacao;
  const dif = c.diferimento;
  const pct = (v: string | number, campo: string): string =>
    formatarValor(v, `ibsCbs.classificacao.diferimento.${campo}`, issues) ?? '0';
  return {
    finNFSe: g.finNFSe ?? '0',
    ...(g.indFinal === undefined ? {} : { indFinal: g.indFinal }),
    cIndOp: g.cIndOp,
    ...(g.tpOper === undefined ? {} : { tpOper: g.tpOper }),
    ...(g.refNFSe === undefined ? {} : { gRefNFSe: { refNFSe: [...g.refNFSe] } }),
    ...(g.tpEnteGov === undefined ? {} : { tpEnteGov: g.tpEnteGov }),
    indDest: g.indDest,
    ...(g.destinatario === undefined ? {} : { dest: g.destinatario }),
    ...(g.imovel === undefined ? {} : { imovel: g.imovel }),
    valores: {
      ...(g.reembolsos === undefined ? {} : { gReeRepRes: g.reembolsos }),
      trib: {
        gIBSCBS: {
          CST: c.CST,
          cClassTrib: c.cClassTrib,
          ...(c.cCredPres === undefined ? {} : { cCredPres: c.cCredPres }),
          ...(c.tributacaoRegular === undefined ? {} : { gTribRegular: c.tributacaoRegular }),
          ...(dif === undefined
            ? {}
            : {
                gDif: {
                  pDifUF: pct(dif.pDifUF, 'pDifUF'),
                  pDifMun: pct(dif.pDifMun, 'pDifMun'),
                  pDifCBS: pct(dif.pDifCBS, 'pDifCBS'),
                },
              }),
        },
      },
    },
  };
}

function servico(input: DadosDps, issues: Ocorrencia[]): TCServ {
  const s = input.servico;
  let cTribNac = s.cTribNac;
  try {
    cTribNac = cTribNacDps(s.cTribNac);
  } catch (e) {
    issues.push({ caminho: 'servico.cTribNac', code: 'campo_invalido', mensagem: (e as Error).message });
  }
  return {
    locPrest: s.local,
    cServ: {
      cTribNac,
      ...(s.cTribMun === undefined ? {} : { cTribMun: s.cTribMun }),
      xDescServ: s.xDescServ,
      ...(s.cNBS === undefined ? {} : { cNBS: s.cNBS }),
      ...(s.cIntContrib === undefined ? {} : { cIntContrib: s.cIntContrib }),
    },
    ...(s.comExt === undefined ? {} : { comExt: s.comExt }),
    ...(s.obra === undefined ? {} : { obra: s.obra }),
    ...(s.atvEvento === undefined ? {} : { atvEvento: s.atvEvento }),
    ...(s.infoCompl === undefined ? {} : { infoCompl: s.infoCompl }),
  };
}

/**
 * Total aproximado dos tributos (Lei 12.741/2012) pelo regime do prestador no Simples Nacional, como o Anexo I exige:
 * `indTotTrib` só no MEI (E0712 no ME/EPP, E0713 no não optante) e `pTotTribSN` nunca no MEI (E0710) nem no não
 * optante (E0713). Sem o grupo, o MEI recebe `indTotTrib` 0 (não informado); os outros regimes precisam informar,
 * porque não há valor neutro permitido para eles. Com tomador ou intermediário emitindo, o grupo é obrigatório e não é
 * conferido: o regime do emitente não está na DPS.
 */
function totalTributos(input: DadosDps, issues: Ocorrencia[]): TCTribTotal {
  // As regras olham o regime do emitente. A DPS só traz o do prestador: com tomador ou intermediário emitindo
  // (tpEmit 2 e 3), o regime é desconhecido aqui, então nada é presumido nem recusado localmente.
  const regime = (input.tpEmit ?? '1') === '1' ? input.prestador.regTrib.opSimpNac : undefined;
  const t = input.tributacao.totTrib;
  const path = 'tributacao.totTrib';
  if (t === undefined) {
    if (regime === '2') return { indTotTrib: '0' };
    issues.push({
      caminho: path,
      code: 'campo_obrigatorio',
      mensagem:
        regime === undefined
          ? 'informe o total de tributos do emitente (tomador ou intermediário): o regime dele não vem na DPS'
          : 'informe vTotTrib ou pTotTrib (e pTotTribSN no ME/EPP): indTotTrib só vale para o MEI (E0712, E0713)',
    });
    return { indTotTrib: '0' };
  }
  const recusa = (codigo: string, campo: string): void => {
    issues.push({
      caminho: `${path}.${campo}`,
      code: 'campo_proibido',
      mensagem: `${campo} não é permitido para este regime do Simples Nacional (${codigo})`,
    });
  };
  if (t.indTotTrib !== undefined && regime === '3') recusa('E0712', 'indTotTrib');
  if (t.indTotTrib !== undefined && regime === '1') recusa('E0713', 'indTotTrib');
  if (t.pTotTribSN !== undefined && regime === '2') recusa('E0710', 'pTotTribSN');
  if (t.pTotTribSN !== undefined && regime === '1') recusa('E0713', 'pTotTribSN');
  return t;
}

function valores(input: DadosDps, issues: Ocorrencia[]): TCInfoValores {
  const v = input.valores;
  const money = (x: string | number | undefined, campo: string): string | undefined =>
    x === undefined ? undefined : formatarValor(x, `valores.${campo}`, issues);
  const vServ = money(v.vServ, 'vServ') ?? '0.00';
  const vReceb = money(v.vReceb, 'vReceb');
  const vDescIncond = money(v.vDescIncond, 'vDescIncond');
  const vDescCond = money(v.vDescCond, 'vDescCond');
  const iss = input.tributacao.issqn;
  const pAliq = iss.pAliq === undefined ? undefined : formatarValor(iss.pAliq, 'tributacao.issqn.pAliq', issues);
  const tribMun: TCTribMunicipal = {
    tribISSQN: iss.tribISSQN,
    ...(iss.cPaisResult === undefined ? {} : { cPaisResult: iss.cPaisResult }),
    ...(iss.tpImunidade === undefined ? {} : { tpImunidade: iss.tpImunidade }),
    ...(iss.exigSusp === undefined ? {} : { exigSusp: iss.exigSusp }),
    ...(iss.BM === undefined ? {} : { BM: iss.BM }),
    tpRetISSQN: iss.tpRetISSQN,
    ...(pAliq === undefined ? {} : { pAliq }),
  };
  return {
    vServPrest: { ...(vReceb === undefined ? {} : { vReceb }), vServ },
    ...(vDescIncond === undefined && vDescCond === undefined
      ? {}
      : {
          vDescCondIncond: {
            ...(vDescIncond === undefined ? {} : { vDescIncond }),
            ...(vDescCond === undefined ? {} : { vDescCond }),
          },
        }),
    ...(v.deducaoReducao === undefined ? {} : { vDedRed: v.deducaoReducao }),
    trib: {
      tribMun,
      ...(input.tributacao.federal === undefined ? {} : { tribFed: input.tributacao.federal }),
      totTrib: totalTributos(input, issues),
    },
  };
}

/**
 * Monta e valida a DPS. Nunca lança por dado de entrada: tudo o que impede a DPS vira `Ocorrencia` (formato,
 * documento com DV errado, competência depois da emissão, schema). Lança `ErroDeConfiguracao` só por opção inválida.
 */
export async function montarDps(entrada: DadosDps, opcoes: MontarDpsOpcoes): Promise<ResultadoMontagemDps> {
  const issues: Ocorrencia[] = [];
  const offset = opcoes.deslocamentoMin ?? BRASILIA;
  const verAplic = opcoes.verAplic ?? formatarVerProc('sinete', VERSAO_PACOTE);
  if (verAplic.length === 0 || verAplic.length > 20)
    throw new ErroDeConfiguracao('verAplic precisa ter de 1 a 20 caracteres');
  const { vigencia, leiaute } = leiauteVigente(opcoes.ambiente, opcoes.tempo.emissao);
  const dhEmi = formatarDataHoraComFuso(opcoes.tempo.emissao.agora(), offset);
  const dCompet = entrada.dCompet ?? formatarDataHoraComFuso(opcoes.tempo.fatoGerador.agora(), offset).slice(0, 10);
  if (dCompet > dhEmi.slice(0, 10)) {
    issues.push({
      caminho: 'dCompet',
      code: 'competencia_posterior_emissao',
      mensagem: 'a data de competência não pode ser posterior à data de emissão (E0015)',
    });
  }
  const serie = texto(entrada.serie, /^(?:\d{1,4}|[0-8]\d{4})$/, 'serie', issues);
  const nDPS = texto(entrada.nDPS, /^[1-9]\d{0,14}$/, 'nDPS', issues);
  conferirDocumento(entrada.prestador as Doc, 'prestador', issues);
  conferirDocumento(entrada.tomador as Doc | undefined, 'tomador', issues);
  conferirDocumento(entrada.intermediario as Doc | undefined, 'intermediario', issues);
  const emitente = inscricaoDoEmitente(entrada, issues);
  let id = '';
  if (emitente !== undefined) {
    try {
      id = idDps({ cLocEmi: entrada.cLocEmi, emitente, serie, nDPS });
    } catch (e) {
      issues.push({ caminho: 'cLocEmi', code: 'campo_invalido', mensagem: (e as Error).message });
    }
  }
  const inf: TCInfDPS = {
    Id: id,
    tpAmb: tpAmbDoAmbiente(opcoes.ambiente),
    dhEmi,
    verAplic,
    serie,
    nDPS,
    dCompet,
    tpEmit: entrada.tpEmit ?? '1',
    ...(entrada.cMotivoEmisTI === undefined ? {} : { cMotivoEmisTI: entrada.cMotivoEmisTI }),
    ...(entrada.chNFSeRej === undefined ? {} : { chNFSeRej: entrada.chNFSeRej }),
    cLocEmi: entrada.cLocEmi,
    ...(entrada.substituicao === undefined ? {} : { subst: entrada.substituicao }),
    prest: entrada.prestador as Prestador,
    ...(entrada.tomador === undefined ? {} : { toma: entrada.tomador as Pessoa }),
    ...(entrada.intermediario === undefined ? {} : { interm: entrada.intermediario as Pessoa }),
    serv: servico(entrada, issues),
    valores: valores(entrada, issues),
    ...(entrada.ibsCbs === undefined ? {} : { IBSCBS: ibsCbsDps(entrada.ibsCbs, issues) }),
  };
  // Tudo o que foi conferido até aqui é da entrada (ADR 0011); daqui para baixo, do XML montado.
  if (issues.length > 0)
    return { ok: false, ocorrencias: issues.map((i) => ({ ...i, origem: i.origem ?? 'entrada' })) };
  let corpo: string;
  try {
    corpo = serializarRaiz(leiaute.DPSElement, { versao: VERSAO_LEIAUTE, infDPS: inf });
  } catch (e) {
    if (!(e instanceof ErroSerializacao)) throw e;
    return {
      ok: false,
      ocorrencias: [{ caminho: e.caminho, code: 'schema', mensagem: e.message, origem: 'montagem' }],
    };
  }
  const xml = DECLARACAO_XML + corpo;
  const schema = validarNoSchema(leiaute.DPSElement, xml);
  if (schema.length > 0) return { ok: false, ocorrencias: schema };
  return { ok: true, valor: { xml, id, ambiente: opcoes.ambiente, modulo: vigencia.modulo, dhEmi, dCompet } };
}

/**
 * Validação estrita no schema, como ocorrências de `montagem` (ADR 0011). Texto com caractere proibido no XML (`\u0000` e afins) faz o parser
 * recusar o documento inteiro; isso também volta como ocorrência (`caractere_invalido`), nunca como exceção.
 */
export function validarNoSchema(raiz: ElementoRaiz<unknown>, xml: string): Ocorrencia[] {
  try {
    return validarRaiz(raiz, xml).map((i) => ({
      caminho: i.caminho,
      code: 'schema',
      mensagem: `${i.code}: ${i.mensagem}`,
      origem: 'montagem',
    }));
  } catch (e) {
    if (!(e instanceof ErroXml)) throw e;
    return [{ caminho: '/', code: 'caractere_invalido', mensagem: `XML inválido: ${e.message}`, origem: 'montagem' }];
  }
}

/** Assina a DPS (enveloped, `Reference` para o `infDPS`). A string devolvida é a que vai para a Sefin e para o banco. */
export async function assinarDps(dps: DpsMontada, assinador: Assinador): Promise<string> {
  return assinarXml(dps.xml, { id: dps.id }, assinador);
}

/** Relógio de emissão no fuso de Brasília, para quem monta outros documentos (`dhEvento`). */
export function dataHora(relogio: Relogio, offsetMinutes: number = BRASILIA): string {
  return formatarDataHoraComFuso(relogio.agora(), offsetMinutes);
}
