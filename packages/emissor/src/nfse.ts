/**
 * `@sinete/emissor/nfse`: o emissor da NFS-e Nacional (`createNfseEmissor`) e o perfil da NFS-e (`perfilNfse`).
 *
 * Importa o `@sinete/nfse` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.
 *
 * Diferenças que vêm do protocolo: a chave da NFS-e só existe depois da geração, então o `id` dos bytes gravados é o
 * Id da DPS; a Sefin não tem pendência de lote nem denegação (o desfecho é gerada, recusada, pendente por falta de
 * resposta ou divergente); a duplicidade é a E0014, conferida pela consulta da DPS. O PDF é o DANFSe v2 gerado aqui
 * pelo `@sinete/da/nfse` (NT SE/CGNFS-e 008/2026), porque a API de geração do ADN foi suspensa em 03/08/2026. A
 * substituição é uma DPS com o grupo `substituicao`, enviada pelo mesmo caminho: a Sefin gera a nova NFS-e e registra
 * sozinha o cancelamento por substituição da anterior.
 */

import type { Authorized } from '@sinete/core';
import { ConfigError, timeContext, ValidationError } from '@sinete/core';
import { descendants, parseXml } from '@sinete/core/xml';
import type {
  BuildDpsOptions,
  CancelamentoPedido,
  DpsInput,
  EventoRegistrado,
  InscricaoFederal,
  NfseClient,
  NfseClientOptions,
  NfseConsultada,
  NfseGerada,
  NfseOutcome,
  NfseRejeicao,
  ResolucaoEnvio,
} from '@sinete/nfse';
import { buildDps, createNfseClient, resolverEnvioSemResposta, signDps } from '@sinete/nfse';
import { conteudoDps } from './conteudo.ts';
import { codigosDe, eventoRegistradoNfse } from './cstat.ts';
import { carregadorDa } from './da.ts';
import type { Desfecho, DesfechoEvento } from './desfecho.ts';
import { semResposta } from './desfecho.ts';
import type { ContextoEmissor, Emissor, OpcoesEmissor, OpcoesEmitir, PerfilDocumento } from './emissor.ts';
import { createEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado } from './evento.ts';

/** De onde sai o desfecho da NFS-e: a emissão ou a NFS-e da consulta da DPS. */
export type BrutoNfse = NfseOutcome<NfseGerada> | NfseConsultada;

/** Desfecho de `emitir` e `retomar` da NFS-e. `id` é o Id da DPS; a chave da NFS-e está em `protocolo.chaveAcesso`. */
export type DesfechoNfse = Desfecho<NfseGerada, BrutoNfse>;

/** Desfecho do `cancelar` da NFS-e. */
export type DesfechoCancelamentoNfse = DesfechoEvento<EventoRegistrado, NfseOutcome<EventoRegistrado> | undefined>;

export interface OpcoesPerfilNfse {
  /** Opções da montagem além de ambiente e relógio (versão do aplicativo, fuso). */
  readonly montagem?: Omit<Partial<BuildDpsOptions>, 'ambiente'>;
  /** Opções do cliente além das que o emissor preenche (cache de parâmetros, endpoints). */
  readonly cliente?: Omit<Partial<NfseClientOptions>, 'transport' | 'signer' | 'ambiente' | 'clock'>;
}

const CODIGOS = codigosDe('nfse');

/** Cancelamento da NFS-e (Anexo II do leiaute v1.01, evento 101101). */
const CANCELAMENTO = '101101';

/**
 * Eventos que marcam o DANFSe (NT SE/CGNFS-e 008/2026, 2.5.1 e 2.5.2), na ordem em que o `pdfPorChave` os consulta:
 * cancelamento (101101), cancelamento deferido por análise fiscal (105104), cancelamento por ofício (305101) e
 * cancelamento por substituição (105102), que marca "SUBSTITUÍDA".
 */
const MARCAS_DANFSE: readonly { readonly tpEvento: string; readonly opcao: 'cancelamento' | 'substituicao' }[] = [
  { tpEvento: '101101', opcao: 'cancelamento' },
  { tpEvento: '105104', opcao: 'cancelamento' },
  { tpEvento: '305101', opcao: 'cancelamento' },
  { tpEvento: '105102', opcao: 'substituicao' },
];

/**
 * Marca que o evento dá ao DANFSe: o grupo e105102 (cancelamento por substituição), no namespace da NFS-e e com
 * qualquer prefixo, é "SUBSTITUÍDA"; o resto vai como cancelamento, e o `danfse` confere o tipo e a chave. XML que não
 * é bem formado também vai adiante, para o `danfse` recusar com `xml_invalido`.
 */
function opcaoDoEvento(evento: string): 'cancelamento' | 'substituicao' {
  let raiz: ReturnType<typeof parseXml>['root'];
  try {
    raiz = parseXml(evento).root;
  } catch {
    return 'cancelamento';
  }
  for (const e of descendants(raiz)) if (e.local === 'e105102' && e.ns === NFSE_NS) return 'substituicao';
  return 'cancelamento';
}

/** Namespace dos documentos da NFS-e Nacional. */
const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';

/** Id da DPS assinada, lido do atributo `Id` do `infDPS`. */
function idDe(xml: string): string {
  const id = /<infDPS\b[^>]*\bId="(DPS[0-9]+)"/.exec(xml)?.[1];
  if (id === undefined) throw new ConfigError('DPS assinada sem o Id do infDPS');
  return id;
}

/** Perfil da NFS-e para o `createEmissor` da raiz. */
export function perfilNfse(
  opcoes: OpcoesPerfilNfse = {},
): PerfilDocumento<DpsInput, NfseClient, NfseGerada, BrutoNfse> {
  const recusado = (id: string, r: NfseRejeicao): DesfechoNfse => ({
    documento: 'nfse',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.hint === undefined ? {} : { hint: r.hint }),
    bruto: r,
  });
  const gerada = (id: string, r: Authorized<NfseGerada>): DesfechoNfse => ({
    documento: 'nfse',
    tipo: 'autorizado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    proc: r.value.xml,
    protocolo: r.value,
    bruto: r,
  });

  /** Envia; sem resposta ou E0014, resolve pela consulta da DPS. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: NfseClient, xml: string, reenvia: boolean): Promise<DesfechoNfse> {
    let r: NfseOutcome<NfseGerada>;
    try {
      r = await cli.autorizar(xml);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return resolver(cli, xml, undefined, e, reenvia);
    }
    if (r.status === 'authorized') return gerada(idDe(xml), r);
    return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia) : recusado(idDe(xml), r);
  }

  async function resolver(
    cli: NfseClient,
    xml: string,
    anterior: NfseRejeicao | undefined,
    erroEnvio: unknown,
    reenvia: boolean,
  ): Promise<DesfechoNfse> {
    const id = idDe(xml);
    let res: ResolucaoEnvio;
    try {
      res = await resolverEnvioSemResposta(cli, xml);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return {
        documento: 'nfse',
        tipo: 'pendente',
        id,
        motivo: 'sem-resposta',
        causa: erroEnvio ?? e,
        // A recusa que levou à consulta (E0014) vai junto da pendência.
        ...(anterior === undefined ? {} : { anterior: { cStat: anterior.cStat, xMotivo: anterior.xMotivo } }),
      };
    }
    switch (res.acao) {
      case 'concluida':
        return gerada(id, res.outcome);
      case 'divergente':
        return {
          documento: 'nfse',
          tipo: 'divergente',
          id,
          chaveRegistrada: res.chaveAcesso,
          ...(anterior === undefined
            ? { xMotivo: 'a DPS gerou uma NFS-e com outro conteúdo (o DigestValue não confere com os bytes gravados)' }
            : { cStat: anterior.cStat, xMotivo: anterior.xMotivo }),
          bruto: res.nfse,
        };
      case 'reenviar':
        if (reenvia) return autorizar(cli, res.dpsAssinada, false);
        if (anterior !== undefined) return recusado(id, anterior);
        if (erroEnvio !== undefined) {
          return { documento: 'nfse', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio };
        }
        return {
          documento: 'nfse',
          tipo: 'pendente',
          id,
          motivo: 'consulta-indefinida',
          xMotivo: 'a DPS não gerou NFS-e depois do reenvio',
        };
    }
  }

  return {
    tipo: 'nfse',
    indefinido: (cStat: string): boolean => CODIGOS.indefinido.has(cStat),
    transitorio: (cStat: string): boolean => CODIGOS.transitorio.has(cStat),
    recusaPorCampoVolatil: (cStat: string): boolean => CODIGOS.campoVolatil.has(cStat),
    conteudoParaRecusa: conteudoDps,
    criarCliente(ctx: ContextoEmissor): NfseClient {
      return createNfseClient({
        transport: ctx.transporte(),
        signer: ctx.signer,
        ambiente: ctx.ambiente,
        clock: ctx.clock,
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(dps: DpsInput, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const r = buildDps(dps, {
        time: timeContext({ emissao: ctx.clock }),
        ...opcoes.montagem,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ValidationError('a DPS não passou na validação', r.issues);
      return { id: r.value.id, xml: await signDps(r.value, ctx.signer) };
    },
    enviar: (cli: NfseClient, xml: string, modo: 'primeiro' | 'retomada'): Promise<DesfechoNfse> =>
      modo === 'primeiro' ? autorizar(cli, xml, true) : resolver(cli, xml, undefined, undefined, true),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfse` serve como está. */
export interface ModuloDanfse {
  danfse(xml: string, opcoes?: object): unknown;
  toPdf(doc: never): Uint8Array;
}

export interface NfseEmissorOptions extends OpcoesEmissor<NfseGerada, BrutoNfse>, OpcoesPerfilNfse {
  /**
   * Módulo `@sinete/da/nfse` para o `pdf`, o `pdfCancelado` e o `pdfPorChave`. Padrão: importado na primeira chamada,
   * se estiver instalado (Node e Bun). No Deno e num bundle de browser, importe `@sinete/da/nfse` de forma estática e
   * passe aqui.
   */
  readonly da?: ModuloDanfse;
}

/** Pedido de cancelamento do emissor: o autor, se faltar, é o titular do certificado. */
export type CancelamentoNfseEmissor = Omit<CancelamentoPedido, 'autor'> & { readonly autor?: InscricaoFederal };

export interface NfseEmissor extends Emissor<DpsInput, NfseClient, NfseGerada, BrutoNfse> {
  /**
   * Emite a DPS substituta (com o grupo `substituicao`), com a mesma gravação e retomada do `emitir`. A Sefin gera a
   * nova NFS-e e registra sozinha o cancelamento por substituição da anterior.
   */
  substituir(ref: string, dps: DpsInput, opcoes?: OpcoesEmitir): Promise<DesfechoNfse>;
  /** NFS-e pela chave, ou `undefined` se a Sefin não a conhece. */
  consultar(chave: string): Promise<NfseConsultada | undefined>;
  /**
   * Cancela (101101). Sem resposta, ou com E0840 (evento já vinculado à NFS-e), confirma pela consulta do e101101 se
   * a Sefin registrou o cancelamento (`recuperado: true`). Nunca conclui pelo código sozinho.
   */
  cancelar(pedido: CancelamentoNfseEmissor): Promise<DesfechoCancelamentoNfse>;
  /**
   * PDF do DANFSe v2 a partir do XML da NFS-e: o `proc` do desfecho autorizado, o que o `aoDecidir` guardou (`opcoes`
   * são as do `danfse`: `canhoto`, `nomeMunicipio`). Nada vai à rede.
   */
  pdf(nfse: string, opcoes?: object): Promise<Uint8Array>;
  /**
   * PDF do DANFSe com a marca d'água: "SUBSTITUÍDA" com o evento de cancelamento por substituição (e105102),
   * "CANCELADA" com os outros de cancelamento (e101101, e105104, e305101). O evento é o registrado, como o `cancelar`
   * devolve em `xml`. Só o render: guardar é do integrador. Evento de outra NFS-e ou de outro tipo lança
   * (`evento_incompativel`).
   */
  pdfCancelado(nfse: string, evento: string, opcoes?: object): Promise<Uint8Array>;
  /**
   * PDF do DANFSe para quem não guardou o XML: consulta a NFS-e pela chave na Sefin e os eventos que a marcam
   * (cancelamento, deferido por análise fiscal, por ofício e por substituição, sequência 1), e gera com a marca, se
   * houver. `undefined` se a Sefin não conhece a chave. Prefira o `pdf` com o XML guardado: são até cinco consultas.
   */
  pdfPorChave(chave: string, opcoes?: object): Promise<Uint8Array | undefined>;
}

/**
 * Abre o PFX e devolve o emissor da NFS-e. Nada vai à rede até a primeira operação que precisa dela; o certificado
 * fora da validade é recusado aqui (`CertError`).
 */
export async function createNfseEmissor(opcoes: NfseEmissorOptions): Promise<NfseEmissor> {
  const base = await createEmissor(perfilNfse(opcoes), opcoes);
  const da = carregadorDa<ModuloDanfse>('nfse', opcoes.da);
  const render = async (nfse: string, o: object | undefined): Promise<Uint8Array> => {
    const m = await da();
    return (m.toPdf as (doc: unknown) => Uint8Array)(m.danfse(nfse, o));
  };
  const t = base.titular;
  const titular: InscricaoFederal | undefined =
    t.cnpj !== undefined ? { CNPJ: t.cnpj } : t.cpf !== undefined ? { CPF: t.cpf } : undefined;

  /**
   * Depois de um pedido sem resposta ou recusado com um código de `eventoJaRegistrado` (E0840): a consulta do
   * e101101, sequência 1, diz se a Sefin registrou o cancelamento. Nunca conclui pelo código sozinho: a E0840 diz que
   * algum evento já está vinculado à NFS-e (Anexo II, aba RN EVENTOSxEVENTOS), que pode ser o cancelamento por
   * substituição ou outro que impede o cancelamento. Sem o e101101 na consulta, a E0840 continua `recusado`.
   */
  async function recuperar(
    chave: string,
    falha: { readonly erro: unknown } | NfseRejeicao,
  ): Promise<DesfechoCancelamentoNfse> {
    const bruto = 'erro' in falha ? undefined : falha;
    let eventos: readonly EventoRegistrado[];
    try {
      eventos = await base.cliente.consultarEventos(chave, { tpEvento: CANCELAMENTO, nSeqEvento: 1 });
    } catch (e) {
      if (!semResposta(e)) throw e;
      return { tipo: 'pendente', motivo: 'sem-resposta', causa: 'erro' in falha ? falha.erro : e, bruto };
    }
    const achado = eventos.find((ev) => ev.chaveAcesso === chave && ev.tpEvento === CANCELAMENTO);
    if (achado !== undefined) return eventoRegistrado(achado, achado.xml, eventoRegistradoNfse, true, bruto);
    if ('erro' in falha) return { tipo: 'pendente', motivo: 'sem-resposta', causa: falha.erro };
    return eventoRecusado<EventoRegistrado, NfseOutcome<EventoRegistrado>>(falha, falha);
  }

  async function cancelar(p: CancelamentoNfseEmissor): Promise<DesfechoCancelamentoNfse> {
    const autor = p.autor ?? titular;
    if (autor === undefined)
      throw new ConfigError('informe o autor do cancelamento: o certificado não traz CNPJ nem CPF');
    let o: NfseOutcome<EventoRegistrado>;
    try {
      o = await base.cliente.cancelar({ ...p, autor });
    } catch (e) {
      if (!semResposta(e)) throw e;
      return recuperar(p.chave, { erro: e });
    }
    if (o.status === 'authorized') return eventoRegistrado(o.value, o.value.xml, o, false, o);
    return CODIGOS.eventoJaRegistrado.has(o.cStat)
      ? recuperar(p.chave, o)
      : eventoRecusado<EventoRegistrado, NfseOutcome<EventoRegistrado>>(o, o);
  }

  return {
    tipo: base.tipo,
    titular: base.titular,
    emitir: base.emitir,
    assinar: base.assinar,
    retomar: base.retomar,
    fechar: base.fechar,
    get cliente(): NfseClient {
      return base.cliente;
    },
    substituir(ref: string, dps: DpsInput, o?: OpcoesEmitir): Promise<DesfechoNfse> {
      if (dps.substituicao === undefined) {
        return Promise.reject(new ConfigError('a DPS substituta precisa do grupo substituicao'));
      }
      return base.emitir(ref, dps, o);
    },
    consultar: (chave: string): Promise<NfseConsultada | undefined> => base.cliente.consultar(chave),
    cancelar,
    pdf: (nfse: string, o?: object): Promise<Uint8Array> => render(nfse, o),
    pdfCancelado(nfse: string, evento: string, o?: object): Promise<Uint8Array> {
      return render(nfse, { ...o, [opcaoDoEvento(evento)]: evento });
    },
    async pdfPorChave(chave: string, o?: object): Promise<Uint8Array | undefined> {
      const nfse = await base.cliente.consultar(chave);
      if (nfse === undefined) return undefined;
      const achados = await Promise.all(
        MARCAS_DANFSE.map(async (m) => {
          const evs = await base.cliente.consultarEventos(chave, { tpEvento: m.tpEvento, nSeqEvento: 1 });
          const ev = evs.find((e) => e.chaveAcesso === chave && e.tpEvento === m.tpEvento);
          return ev === undefined ? undefined : { opcao: m.opcao, xml: ev.xml };
        }),
      );
      // A substituição é um cancelamento: com os dois registrados (o que a Sefin não faz), vale a substituição.
      const marca = achados.find((a) => a?.opcao === 'substituicao') ?? achados.find((a) => a !== undefined);
      return render(nfse.xml, marca === undefined ? o : { ...o, [marca.opcao]: marca.xml });
    },
  };
}
