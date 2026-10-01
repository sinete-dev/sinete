/**
 * `@sinete/emissor/nfse`: o emissor da NFS-e Nacional (`criarEmissorNfse`) e o perfil da NFS-e (`perfilNfse`).
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

import type { Autorizado } from '@sinete/core';
import { contextoDeTempo, ErroDeConfiguracao, ErroDeValidacao } from '@sinete/core';
import { descendentes, lerXml } from '@sinete/core/xml';
import type {
  CancelamentoPedido,
  ClienteNfse,
  ClienteNfseOpcoes,
  DadosDps,
  EventoRegistrado,
  InscricaoFederal,
  MontarDpsOpcoes,
  NfseConsultada,
  NfseGerada,
  RejeicaoNfse,
  ResolucaoEnvio,
  ResultadoNfse,
} from '@sinete/nfse';
import { assinarDps, criarClienteNfse, montarDps, resolverEnvioSemResposta } from '@sinete/nfse';
import { conteudoDps } from './conteudo.ts';
import { codigosDe, eventoRegistradoNfse } from './cstat.ts';
import type { PdfNfseOpcoes } from './da.ts';
import { carregadorDa } from './da.ts';

export type { PdfNfseOpcoes } from './da.ts';

import type { Desfecho, DesfechoEvento } from './desfecho.ts';
import type { ContextoEmissor, Emissor, EmissorOpcoes, EmitirOpcoes, PerfilDocumento } from './emissor.ts';
import { criarEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado } from './evento.ts';
import type { EnvioOpcoes } from './sinal.ts';
import { abortado, conferirSinal, erroCancelado, falhaSemResposta } from './sinal.ts';

/** De onde sai o desfecho da NFS-e: a emissão ou a NFS-e da consulta da DPS. */
export type BrutoNfse = ResultadoNfse<NfseGerada> | NfseConsultada;

/** Desfecho de `emitir` e `retomar` da NFS-e. `id` é o Id da DPS; a chave da NFS-e está em `protocolo.chaveAcesso`. */
export type DesfechoNfse = Desfecho<NfseGerada, BrutoNfse>;

/** Desfecho do `cancelar` da NFS-e. */
export type DesfechoCancelamentoNfse = DesfechoEvento<EventoRegistrado, ResultadoNfse<EventoRegistrado> | undefined>;

export interface PerfilNfseOpcoes {
  /** Opções da montagem além de ambiente e relógio (versão do aplicativo, fuso). */
  readonly montagem?: Omit<Partial<MontarDpsOpcoes>, 'ambiente'>;
  /** Opções do cliente além das que o emissor preenche (cache de parâmetros, endpoints). */
  readonly cliente?: Omit<Partial<ClienteNfseOpcoes>, 'transporte' | 'assinador' | 'ambiente' | 'relogio'>;
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
  let raiz: ReturnType<typeof lerXml>['raiz'];
  try {
    raiz = lerXml(evento).raiz;
  } catch {
    return 'cancelamento';
  }
  for (const e of descendentes(raiz)) if (e.local === 'e105102' && e.ns === NFSE_NS) return 'substituicao';
  return 'cancelamento';
}

/** Namespace dos documentos da NFS-e Nacional. */
const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';

/** Id da DPS assinada, lido do atributo `Id` do `infDPS`. */
function idDe(xml: string): string {
  const id = /<infDPS\b[^>]*\bId="(DPS[0-9]+)"/.exec(xml)?.[1];
  if (id === undefined) throw new ErroDeConfiguracao('DPS assinada sem o Id do infDPS');
  return id;
}

/**
 * Perfil da NFS-e para o `criarEmissor` de `@sinete/emissor/perfil`. Experimental, como aquele subpath (ADR 0016): a forma do
 * perfil (`PerfilDocumento`) pode mudar em versão minor. Para emitir, use a fábrica deste subpath, que é estável.
 *
 * @experimental
 */
export function perfilNfse(
  opcoes: PerfilNfseOpcoes = {},
): PerfilDocumento<DadosDps, ClienteNfse, NfseGerada, BrutoNfse> {
  const recusado = (id: string, r: RejeicaoNfse): DesfechoNfse => ({
    documento: 'nfse',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.dica === undefined ? {} : { dica: r.dica }),
    bruto: r,
  });
  const gerada = (id: string, r: Autorizado<NfseGerada>): DesfechoNfse => ({
    documento: 'nfse',
    tipo: 'autorizado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    proc: r.valor.xml,
    protocolo: r.valor,
    bruto: r,
  });

  /** Envia; sem resposta ou E0014, resolve pela consulta da DPS. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: ClienteNfse, xml: string, reenvia: boolean, env?: EnvioOpcoes): Promise<DesfechoNfse> {
    let r: ResultadoNfse<NfseGerada>;
    try {
      r = await cli.autorizar(xml, env);
    } catch (e) {
      const falha = falhaSemResposta(e, env?.signal);
      if (falha === undefined) throw e;
      return resolver(cli, xml, undefined, falha, reenvia, env);
    }
    if (r.tipo === 'autorizado') return gerada(idDe(xml), r);
    return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia, env) : recusado(idDe(xml), r);
  }

  async function resolver(
    cli: ClienteNfse,
    xml: string,
    anterior: RejeicaoNfse | undefined,
    erroEnvio: unknown,
    reenvia: boolean,
    env?: EnvioOpcoes,
  ): Promise<DesfechoNfse> {
    const id = idDe(xml);
    // A recusa que levou à consulta (E0014) vai junto da pendência.
    const ant = anterior === undefined ? {} : { anterior: { cStat: anterior.cStat, xMotivo: anterior.xMotivo } };
    // Depois do abort, nenhuma chamada nova: os bytes ficam para a retomada.
    if (abortado(env?.signal)) {
      const causa = erroEnvio ?? erroCancelado(env.signal, 'consulta');
      return { documento: 'nfse', tipo: 'pendente', id, motivo: 'sem-resposta', causa, ...ant };
    }
    let res: ResolucaoEnvio;
    try {
      res = await resolverEnvioSemResposta(cli, xml, anterior, env);
    } catch (e) {
      const falha = falhaSemResposta(e, env?.signal);
      if (falha === undefined) throw e;
      return { documento: 'nfse', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio ?? falha, ...ant };
    }
    switch (res.acao) {
      case 'concluida':
        return gerada(id, res.resultado);
      case 'indefinida':
        // A consulta respondeu sem decidir (a DPS consta sem a NFS-e, ou a E0014 sem a DPS na consulta): os bytes ficam.
        return { documento: 'nfse', tipo: 'pendente', id, motivo: 'consulta-indefinida', xMotivo: res.motivo, ...ant };
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
        if (reenvia) return autorizar(cli, res.dpsAssinada, false, env);
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
    criarCliente(ctx: ContextoEmissor): ClienteNfse {
      return criarClienteNfse({
        transporte: ctx.transporte(),
        assinador: ctx.assinador,
        ambiente: ctx.ambiente,
        relogio: ctx.relogio,
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(dps: DadosDps, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const r = await montarDps(dps, {
        tempo: contextoDeTempo({ emissao: ctx.relogio }),
        ...opcoes.montagem,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ErroDeValidacao('a DPS não passou na validação', r.ocorrencias);
      return { id: r.valor.id, xml: await assinarDps(r.valor, ctx.assinador) };
    },
    enviar: (cli: ClienteNfse, xml: string, modo: 'primeiro' | 'retomada', env?: EnvioOpcoes): Promise<DesfechoNfse> =>
      modo === 'primeiro' ? autorizar(cli, xml, true, env) : resolver(cli, xml, undefined, undefined, true, env),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfse` serve como está. */
export interface ModuloDanfse {
  danfse(xml: string, opcoes?: PdfNfseOpcoes): unknown;
  gerarPdf(documento: never): Uint8Array;
}

export interface EmissorNfseOpcoes extends EmissorOpcoes<NfseGerada, BrutoNfse>, PerfilNfseOpcoes {
  /**
   * Módulo `@sinete/da/nfse` para o `pdf`, o `pdfCancelado` e o `pdfPorChave`. Padrão: importado na primeira chamada,
   * se estiver instalado (Node e Bun). No Deno e num bundle de browser, importe `@sinete/da/nfse` de forma estática e
   * passe aqui.
   */
  readonly da?: ModuloDanfse;
}

/** Pedido de cancelamento do emissor: o autor, se faltar, é o titular do certificado. */
export type CancelamentoNfseEmissor = Omit<CancelamentoPedido, 'autor'> & { readonly autor?: InscricaoFederal };

export interface EmissorNfse extends Emissor<DadosDps, ClienteNfse, NfseGerada, BrutoNfse> {
  /**
   * Emite a DPS substituta (com o grupo `substituicao`), com a mesma gravação e retomada do `emitir`. A Sefin gera a
   * nova NFS-e e registra sozinha o cancelamento por substituição da anterior.
   */
  substituir(ref: string, dps: DadosDps, opcoes?: EmitirOpcoes): Promise<DesfechoNfse>;
  /** NFS-e pela chave, ou `undefined` se a Sefin não a conhece. Passagem direta para `cliente.consultar` (ADR 0010). */
  consultar(chave: string, opcoes?: EnvioOpcoes): Promise<NfseConsultada | undefined>;
  /**
   * Cancela (101101). Sem resposta, ou com E0840 (evento já vinculado à NFS-e), confirma pela consulta do e101101 se
   * a Sefin registrou o cancelamento (`recuperado: true`). Nunca conclui pelo código sozinho. `opcoes.signal` cancela:
   * antes de o pedido sair, lança o `cancelado`; depois, o desfecho é `pendente` com `motivo: 'sem-resposta'`, sem a
   * consulta.
   */
  cancelar(pedido: CancelamentoNfseEmissor, opcoes?: EnvioOpcoes): Promise<DesfechoCancelamentoNfse>;
  /**
   * PDF do DANFSe v2 a partir do XML da NFS-e: o `proc` do desfecho autorizado, o que o `aoDecidir` guardou (`opcoes`
   * são as do `danfse` do `@sinete/da/nfse`). Nada vai à rede.
   */
  pdf(nfse: string, opcoes?: PdfNfseOpcoes): Promise<Uint8Array>;
  /**
   * PDF do DANFSe com a marca d'água: "SUBSTITUÍDA" com o evento de cancelamento por substituição (e105102),
   * "CANCELADA" com os outros de cancelamento (e101101, e105104, e305101). O evento é o registrado, como o `cancelar`
   * devolve em `xml`. Só o render: guardar é do integrador. Evento de outra NFS-e ou de outro tipo lança
   * (`evento_incompativel`).
   */
  pdfCancelado(nfse: string, evento: string, opcoes?: MarcaDanfseAutomatica): Promise<Uint8Array>;
  /**
   * PDF do DANFSe para quem não guardou o XML: consulta a NFS-e pela chave na Sefin e os eventos que a marcam
   * (cancelamento, deferido por análise fiscal, por ofício e por substituição, sequência 1), e gera com a marca, se
   * houver. `undefined` se a Sefin não conhece a chave. Prefira o `pdf` com o XML guardado: são até cinco consultas.
   * `opcoes.signal` cancela as consultas (lança o `ErroTransporte` com `code: 'cancelado'`).
   */
  pdfPorChave(chave: string, opcoes?: PdfPorChaveOpcoes): Promise<Uint8Array | undefined>;
}

/** Opções do DANFSe quando o emissor põe a marca: a marca sai do evento, não das opções. */
export type MarcaDanfseAutomatica = Omit<PdfNfseOpcoes, 'cancelamento' | 'substituicao'>;

/** Opções do `pdfPorChave`: as do DANFSe com a marca automática e o `signal` das consultas. */
export interface PdfPorChaveOpcoes extends MarcaDanfseAutomatica, EnvioOpcoes {}

/**
 * Abre o PFX e devolve o emissor da NFS-e. Nada vai à rede até a primeira operação que precisa dela; o certificado
 * fora da validade é recusado aqui (`ErroCertificado`).
 */
export async function criarEmissorNfse(opcoes: EmissorNfseOpcoes): Promise<EmissorNfse> {
  const base = await criarEmissor(perfilNfse(opcoes), opcoes);
  const da = carregadorDa<ModuloDanfse>('nfse', opcoes.da);
  const render = async (nfse: string, o: PdfNfseOpcoes | undefined): Promise<Uint8Array> => {
    const m = await da();
    return (m.gerarPdf as (doc: unknown) => Uint8Array)(m.danfse(nfse, o));
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
    falha: { readonly erro: unknown } | RejeicaoNfse,
    env: EnvioOpcoes | undefined,
  ): Promise<DesfechoCancelamentoNfse> {
    const bruto = 'erro' in falha ? undefined : falha;
    if (abortado(env?.signal)) {
      const causa = 'erro' in falha ? falha.erro : erroCancelado(env.signal, 'consulta');
      return { tipo: 'pendente', motivo: 'sem-resposta', causa, bruto };
    }
    let eventos: readonly EventoRegistrado[];
    try {
      eventos = await base.cliente.consultarEventos(chave, { tpEvento: CANCELAMENTO, nSeqEvento: 1 }, env);
    } catch (e) {
      const f = falhaSemResposta(e, env?.signal);
      if (f === undefined) throw e;
      return { tipo: 'pendente', motivo: 'sem-resposta', causa: 'erro' in falha ? falha.erro : f, bruto };
    }
    const achado = eventos.find((ev) => ev.chaveAcesso === chave && ev.tpEvento === CANCELAMENTO);
    if (achado !== undefined) return eventoRegistrado(achado, achado.xml, eventoRegistradoNfse, true, bruto);
    if ('erro' in falha) return { tipo: 'pendente', motivo: 'sem-resposta', causa: falha.erro };
    return eventoRecusado<EventoRegistrado, ResultadoNfse<EventoRegistrado>>(falha, falha);
  }

  async function cancelar(p: CancelamentoNfseEmissor, env?: EnvioOpcoes): Promise<DesfechoCancelamentoNfse> {
    const autor = p.autor ?? titular;
    if (autor === undefined)
      throw new ErroDeConfiguracao('informe o autor do cancelamento: o certificado não traz CNPJ nem CPF');
    conferirSinal(env?.signal, 'cancelar');
    let o: ResultadoNfse<EventoRegistrado>;
    try {
      o = await base.cliente.cancelar({ ...p, autor }, env);
    } catch (e) {
      const f = falhaSemResposta(e, env?.signal);
      if (f === undefined) throw e;
      return recuperar(p.chave, { erro: f }, env);
    }
    if (o.tipo === 'autorizado') return eventoRegistrado(o.valor, o.valor.xml, o, false, o);
    return CODIGOS.eventoJaRegistrado.has(o.cStat)
      ? recuperar(p.chave, o, env)
      : eventoRecusado<EventoRegistrado, ResultadoNfse<EventoRegistrado>>(o, o);
  }

  return {
    tipo: base.tipo,
    titular: base.titular,
    emitir: base.emitir,
    assinar: base.assinar,
    retomar: base.retomar,
    fechar: base.fechar,
    get cliente(): ClienteNfse {
      return base.cliente;
    },
    substituir(ref: string, dps: DadosDps, o?: EmitirOpcoes): Promise<DesfechoNfse> {
      if (dps.substituicao === undefined) {
        return Promise.reject(new ErroDeConfiguracao('a DPS substituta precisa do grupo substituicao'));
      }
      return base.emitir(ref, dps, o);
    },
    consultar: (chave: string, env?: EnvioOpcoes): Promise<NfseConsultada | undefined> =>
      base.cliente.consultar(chave, env),
    cancelar,
    pdf: (nfse: string, o?: PdfNfseOpcoes): Promise<Uint8Array> => render(nfse, o),
    pdfCancelado(nfse: string, evento: string, o?: MarcaDanfseAutomatica): Promise<Uint8Array> {
      return render(nfse, { ...o, [opcaoDoEvento(evento)]: evento });
    },
    async pdfPorChave(chave: string, opcoesPdf?: PdfPorChaveOpcoes): Promise<Uint8Array | undefined> {
      const { signal, ...o } = opcoesPdf ?? {};
      const env: EnvioOpcoes | undefined = signal === undefined ? undefined : { signal };
      const nfse = await base.cliente.consultar(chave, env);
      if (nfse === undefined) return undefined;
      const achados = await Promise.all(
        MARCAS_DANFSE.map(async (m) => {
          const evs = await base.cliente.consultarEventos(chave, { tpEvento: m.tpEvento, nSeqEvento: 1 }, env);
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
