/**
 * Chave de acesso de DF-e (NF-e, NFC-e, CT-e, MDF-e): 44 posições.
 *
 * Composição (MOC 7.0 Visão Geral, item 2.2.6 e Tabela 2-1, e NT Conjunta 2025.001 v1.00, item 5): cUF (2), AAMM da emissão (4), CNPJ do emitente
 * (14; em alguns DF-e, CPF com zeros à esquerda), modelo (2), série (3), número (9), tpEmis (1), código numérico (8)
 * e DV (1). Com o CNPJ alfanumérico a expressão passa a `[0-9]{6}[A-Z0-9]{12}[0-9]{26}` e o DV é módulo 11 com pesos 2
 * a 9 da direita para a esquerda sobre os 43 caracteres, cada um valendo o código ASCII menos 48; resto que gera 10 ou
 * 11 vira 0 (NT 2025.001, item 5 e Anexo II).
 */

import type { CUf, Ocorrencia, Relogio, Resultado, Uf } from '@sinete/core';
import { ehCUf, falha, ok, ufPorCUf } from '@sinete/core';
import { lerCnpj } from './cnpj.ts';
import type { LerOpcoes } from './cpf.ts';
import { lerCpf } from './cpf.ts';
import rules from './data/chave.json' with { type: 'json' };
import { cyclicWeights, issue, mod11Complement, stripMask, throwInvalid, weightedSum } from './digits.ts';

/**
 * Vigência do CNPJ alfanumérico nos DF-e: NT 2026.004 v1.01 (NF-e/NFC-e), produção a partir de 1º de julho de 2026.
 * Chave com letra no CNPJ e AAMM anterior é recusada pela SEFAZ como CNPJ inválido (NT 2025.001, item 5, nota aos
 * autorizadores).
 */
export const CNPJ_ALFANUMERICO_VIGENCIA: {
  readonly aamm: string;
  readonly fonte: string;
} = {
  aamm: '2607',
  fonte:
    'NT 2026.004 v1.01 (NF-e/NFC-e, CNPJ alfanumérico), produção em 2026-07-01; NT Conjunta 2025.001 v1.00, item 5',
};

const CHAVE_WEIGHTS: readonly number[] = cyclicWeights(43);
const CHAVE_FORMAT = /^\d{6}[A-Z0-9]{12}\d{26}$/;

/** Chave de acesso decomposta. Os campos têm a forma lexical do leiaute (strings com zeros à esquerda). */
export interface ChaveAcesso {
  readonly chave: string;
  readonly cUF: CUf;
  readonly uf: Uf;
  /** Ano e mês da emissão, `AAMM`. */
  readonly aamm: string;
  /** Ano com 4 dígitos (`2000 + AA`). */
  readonly ano: number;
  readonly mes: number;
  /** As 14 posições do emitente como vieram. */
  readonly emitente: string;
  /**
   * Presente quando as 14 posições formam um CNPJ válido. Nos modelos com regra de série (NF-e e NFC-e), só quando a
   * série não é a de emitente pessoa física (910 a 969).
   */
  readonly cnpj?: string;
  /**
   * Presente quando as posições são `000` seguido de um CPF válido (emitente pessoa física). Nos modelos com regra de
   * série, só nas séries de pessoa física: as 14 posições de um CPF podem formar também um CNPJ válido (cerca de 1,4%
   * dos CPFs), e é a série que desfaz a dúvida (RV BA02-30).
   */
  readonly cpf?: string;
  readonly mod: string;
  /** Documento do modelo (`NF-e`, `NFC-e`, `CT-e`...). */
  readonly documento: string;
  readonly serie: string;
  readonly nNF: string;
  /** Leiaute usado na leitura: `2.00` (padrão) ou `1.10` quando pedido em `opcoes.leiaute`. */
  readonly leiaute: '2.00' | '1.10';
  /** Ausente no leiaute 1.10. */
  readonly tpEmis?: string;
  readonly cNF: string;
  readonly cDV: string;
}

/** O DV (1 algarismo) dos 43 primeiros caracteres da chave. */
export function calcularDvChaveAcesso(base: string): string {
  if (!/^\d{6}[A-Z0-9]{12}\d{25}$/.test(base))
    throwInvalid('chNFe', 'chave_base_invalida', 'A base da chave tem 43 caracteres no formato da chave');
  return String(mod11Complement(weightedSum(base, CHAVE_WEIGHTS)));
}

export interface PartesChaveAcesso {
  readonly cUF: string;
  readonly aamm: string;
  /** CNPJ (14) ou CPF (11, recebe `000` à esquerda). */
  readonly emitente: string;
  readonly mod: string;
  readonly serie: string | number;
  readonly nNF: string | number;
  readonly tpEmis: string | number;
  readonly cNF: string | number;
}

/** Monta a chave com o DV a partir das partes, completando zeros à esquerda. Não valida o emitente. */
export function montarChaveAcesso(partes: PartesChaveAcesso): string {
  const emitente = stripMask(partes.emitente).toUpperCase().padStart(14, '0');
  const base = [
    partes.cUF.padStart(2, '0'),
    partes.aamm,
    emitente,
    partes.mod.padStart(2, '0'),
    String(partes.serie).padStart(3, '0'),
    String(partes.nNF).padStart(9, '0'),
    String(partes.tpEmis),
    String(partes.cNF).padStart(8, '0'),
  ].join('');
  return base + calcularDvChaveAcesso(base);
}

export interface LerChaveAcessoOpcoes extends LerOpcoes {
  /** Confere se o emitente é CNPJ ou CPF válido conforme a série e a vigência do CNPJ alfanumérico. Padrão: `true`. */
  readonly conferirEmitente?: boolean;
  /**
   * Aplica também as regras de uma emissão nova, que uma chave antiga já autorizada pode não cumprir: cNF (RV B03-10),
   * tpEmis por modelo (B22-10, B22-34), NFC-e de pessoa física só nas séries 920 a 969 (NT 2023.002), série até 969 (B07). Padrão: `false`.
   */
  readonly emissao?: boolean;
  /** Com relógio, recusa ano de emissão posterior ao corrente (RV BA02-20). */
  readonly relogio?: Relogio;
  /**
   * Leiaute da chave. Padrão `2.00` (com tpEmis e cNF de 8 posições). `1.10` só por escolha explícita: não há como
   * detectar pelo dígito, que no leiaute 1.10 é parte do cNF e pode coincidir com um tpEmis válido, e chaves anteriores
   * a 2011 já passaram do prazo legal de guarda de 5 anos.
   */
  readonly leiaute?: '2.00' | '1.10';
}

type Range = readonly (readonly number[])[];
const inRange = (n: number, ranges: Range): boolean => ranges.some(([a = 0, b = 0]) => n >= a && n <= b);
const MODELOS: ReadonlyMap<string, string> = new Map(rules.modelos.map((m) => [m.mod, m.documento]));
const NAO_SUPORTADOS: ReadonlyMap<string, string> = new Map(
  rules.modelosNaoSuportados.map((m) => [m.mod, m.documento]),
);

/**
 * Valida e decompõe a chave de acesso (aceita espaços, como no DANFE, e minúsculas). Cada componente é conferido
 * contra o domínio do leiaute, com a regra de origem em `data/chave.json`.
 */
export function lerChaveAcesso(entrada: string, opcoes: LerChaveAcessoOpcoes = {}): Resultado<ChaveAcesso, Ocorrencia> {
  const path = opcoes.caminho ?? 'chNFe';
  const fail = (code: string, message: string): Resultado<ChaveAcesso, Ocorrencia> => falha(issue(path, code, message));
  const chave = stripMask(entrada.trim()).toUpperCase();
  if (!/^[A-Z0-9]*$/.test(chave)) return fail('chave_caractere_invalido', 'Chave de acesso só tem letras e algarismos');
  if (chave.length !== 44) return fail('chave_tamanho_invalido', 'Chave de acesso tem 44 posições');
  if (!CHAVE_FORMAT.test(chave)) {
    return fail('chave_formato_invalido', 'Letras só são aceitas nas 12 primeiras posições do CNPJ');
  }
  // DV: MOC Visão Geral 2.2.6.2; RV BA02-10 (547)
  if (calcularDvChaveAcesso(chave.slice(0, 43)) !== chave[43]) {
    return fail('chave_dv_invalido', 'Dígito verificador da chave de acesso não confere');
  }
  // cUF: tabela de UF do IBGE; RV BA02-14 (522)
  const cUF = chave.slice(0, 2);
  const uf = ehCUf(cUF) ? ufPorCUf(cUF) : undefined;
  if (!ehCUf(cUF) || uf === undefined) return fail('chave_uf_invalida', 'Código da UF da chave de acesso inexistente');
  // AAMM: RV BA02-20 e BA02-24 (524)
  const aamm = chave.slice(2, 6);
  const aa = Number(aamm.slice(0, 2));
  const mes = Number(aamm.slice(2));
  if (mes < 1 || mes > 12) return fail('chave_mes_invalido', 'Mês da chave de acesso fora de 01 a 12');
  const ano = 2000 + aa;
  if (aa < rules.anoMinimo.aa || (opcoes.relogio !== undefined && ano > opcoes.relogio.agora().getUTCFullYear())) {
    return fail('chave_ano_invalido', 'Ano da chave de acesso anterior a 2006 ou posterior ao ano corrente');
  }
  // mod: B06 e modelos dos demais DF-e com a mesma composição de chave; RV BA02-34 (679)
  const mod = chave.slice(20, 22);
  const naoSuportado = NAO_SUPORTADOS.get(mod);
  if (naoSuportado !== undefined) {
    return fail(
      'chave_modelo_nao_suportado',
      `Chave do ${naoSuportado} (modelo ${mod}) tem outra composição; fora do escopo`,
    );
  }
  const documento = MODELOS.get(mod);
  if (documento === undefined) return fail('chave_modelo_invalido', `Modelo ${mod} não é de DF-e com chave de acesso`);
  // nNF: TNF [1-9][0-9]{0,8}; RV BA02-40 (683)
  const serie = chave.slice(22, 25);
  const nNF = chave.slice(25, 34);
  if (/^0+$/.test(nNF)) return fail('chave_numero_invalido', 'Número do documento zerado na chave de acesso');
  // tpEmis e cNF dependem do leiaute escolhido: 1.10 não tem tpEmis e usa cNF de 9 posições
  const tpEmisRaw = chave.slice(34, 35);
  const layout = opcoes.leiaute ?? '2.00';
  if (layout === '2.00' && !rules.tpEmis.valores.includes(tpEmisRaw)) {
    return fail('chave_tpemis_invalido', `Forma de emissão ${tpEmisRaw} fora do domínio do tpEmis`);
  }
  const cNF = layout === '2.00' ? chave.slice(35, 43) : chave.slice(34, 43);
  // Emitente: CNPJ ou CPF conforme a série nos modelos 55 e 65 (RV BA02-30, 552)
  const emitente = chave.slice(6, 20);
  const cnpj = lerCnpj(emitente);
  const cpf = emitente.startsWith('000') ? lerCpf(emitente.slice(3)) : undefined;
  const nSerie = Number(serie);
  const serieRule = rules.serieNfe.aplicaAosModelos.includes(mod);
  if (opcoes.conferirEmitente !== false) {
    const wantsCnpj = serieRule && inRange(nSerie, rules.serieNfe.cnpj);
    const wantsCpf = serieRule && inRange(nSerie, rules.serieNfe.cpf);
    const okEmit = wantsCnpj ? cnpj.ok : wantsCpf ? cpf?.ok === true : cnpj.ok || cpf?.ok === true;
    if (!okEmit) {
      const esperado = wantsCnpj ? 'CNPJ' : wantsCpf ? 'CPF' : 'CNPJ ou CPF';
      return fail(
        'chave_emitente_invalido',
        `Emitente da chave de acesso não é ${esperado} válido para a série ${serie}`,
      );
    }
    if (/[A-Z]/.test(emitente) && aamm < CNPJ_ALFANUMERICO_VIGENCIA.aamm) {
      return fail(
        'chave_cnpj_alfanumerico_fora_da_vigencia',
        `CNPJ alfanumérico em chave com AAMM ${aamm}, anterior à vigência (${CNPJ_ALFANUMERICO_VIGENCIA.aamm})`,
      );
    }
  }
  if (opcoes.emissao === true && serieRule) {
    const e = rules.emissao;
    if (!inRange(nSerie, e.seriesPermitidas))
      return fail('chave_serie_invalida', `Série ${serie} fora das faixas de 000 a 969`);
    if (
      mod === '65' &&
      inRange(nSerie, rules.serieNfe.cpf) &&
      !inRange(nSerie, [e.nfceCpf.series as [number, number]])
    ) {
      return fail('chave_serie_invalida', 'NFC-e de emitente pessoa física usa a série 920 a 969 (NT 2023.002)');
    }
    const tpEmisOk = (e.tpEmisPorModelo as Readonly<Record<string, readonly string[]>>)[mod] ?? rules.tpEmis.valores;
    if (layout === '1.10' || !tpEmisOk.includes(tpEmisRaw)) {
      return fail('chave_tpemis_invalido', `Forma de emissão ${tpEmisRaw} não permitida para o modelo ${mod}`);
    }
    if (e.cnfProibidos.includes(cNF) || Number(cNF) === Number(nNF)) {
      return fail('chave_cnf_invalido', 'Código numérico em sequência proibida ou igual ao número do documento');
    }
  }
  return ok({
    chave,
    cUF,
    uf: uf.sigla,
    aamm,
    ano,
    mes,
    emitente,
    // Com regra de série, só a leitura que a série permite: CPF de 920 a 969, CNPJ nas demais faixas de CNPJ.
    ...(cnpj.ok && !(serieRule && inRange(nSerie, rules.serieNfe.cpf)) ? { cnpj: cnpj.valor } : {}),
    ...(cpf?.ok && !(serieRule && inRange(nSerie, rules.serieNfe.cnpj)) ? { cpf: cpf.valor } : {}),
    mod,
    documento,
    serie,
    nNF,
    leiaute: layout,
    ...(layout === '2.00' ? { tpEmis: tpEmisRaw } : {}),
    cNF,
    cDV: chave.slice(43),
  });
}

export function chaveAcessoValida(entrada: string, opcoes?: LerChaveAcessoOpcoes): boolean {
  return lerChaveAcesso(entrada, opcoes).ok;
}

/** Chave em 11 blocos de 4, como no DANFE. Não valida. */
export function formatarChaveAcesso(valor: string): string {
  return (
    stripMask(valor)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}
