/**
 * `createEmissor(perfil, opcoes)`: o ciclo de transmissão comum aos documentos (ADR 0010).
 *
 * Trava o documento, lê o que estiver gravado; sem bytes, monta, assina e grava; envia (ou retoma, com os bytes
 * gravados, sem nunca montar de novo); renova a trava enquanto espera a SEFAZ; confere a trava antes de guardar o
 * desfecho; conclui, mantém ou descarta os bytes pela política do documento; solta a trava no fim, dê certo ou não.
 *
 * O que muda de um documento para outro (montagem, assinatura, protocolo de envio, tabela de `cStat`) fica no perfil
 * (`PerfilDocumento`). Cada subpath exporta o seu e um `create<Doc>Emissor` com os tipos fixados:
 * `@sinete/emissor/nfe`, `/mdfe` e `/nfse`. Esta raiz não importa nenhum pacote de documento.
 */

import type { IcpIdentity } from '@sinete/cert';
import type { Ambiente, Assinador, Logger, Relogio } from '@sinete/core';
import { ErroDeConfiguracao, loggerSilencioso, relogioDoSistema, tpAmbDoAmbiente } from '@sinete/core';
import type { CreateTransportOptions, Transport } from '@sinete/transport';
import { allowlistPolicy, ambienteHosts, createTransport } from '@sinete/transport';
import type { CertificadoAberto } from './certificado.ts';
import { abrirCertificado } from './certificado.ts';
import type { ContingenciaDoPerfil, MudancaContingencia, OpcoesContingencia } from './contingencia.ts';
import { criarContingencia } from './contingencia.ts';
import type { Desfecho, DesfechoDecidido, SituacaoPosterior, TipoDocumento } from './desfecho.ts';
import { destinoDosBytes } from './desfecho.ts';
import { RecusaRepetidaError, TransmissaoEmAndamentoError, TravaPerdidaError } from './erros.ts';
import type { RegistroTransmissao, TransmissaoStore, Trava } from './store.ts';

/** O que o perfil recebe do emissor: certificado aberto, relógio e o transporte do certificado. */
export interface ContextoEmissor {
  readonly ambiente: Ambiente;
  readonly clock: Relogio;
  readonly signer: Assinador;
  /** Titular do certificado (CNPJ ou CPF, nome). */
  readonly titular: IcpIdentity;
  readonly logger: Logger | undefined;
  readonly timeoutMs: number | undefined;
  /** Transporte mTLS do certificado, criado na primeira chamada (no browser, `assinar` não chega a criá-lo). */
  transporte(): Transport;
}

/** Documento montado e assinado. `id` é a chave de acesso, ou o Id da DPS na NFS-e. */
export interface DocumentoAssinado {
  readonly id: string;
  readonly xml: string;
}

/** `primeiro`: os bytes acabaram de ser gravados e nunca saíram. `retomada`: podem ter chegado à SEFAZ. */
export type ModoEnvio = 'primeiro' | 'retomada';

/**
 * O que muda de um documento para outro. `enviar` nunca monta: recebe os bytes gravados, espera o recibo quando houver,
 * resolve a duplicidade e o envio sem resposta pela consulta, e devolve o desfecho normalizado. Só lança o que não é
 * da SEFAZ nem da rede (configuração, política do transporte, bug).
 */
export interface PerfilDocumento<Entrada, Cliente, P = unknown, B = unknown> {
  readonly tipo: TipoDocumento;
  /** `cStat` de recusa que mantém os bytes gravados (duplicidade, lote em processamento), pela tabela do documento. */
  indefinido(cStat: string): boolean;
  /**
   * `cStat` de recusa do serviço, não da nota (serviço paralisado, erro não catalogado): não barra o reenvio dos mesmos
   * bytes (`OpcoesEmissor.recusaRepetida`). Sem a função, toda recusa descartada conta.
   */
  transitorio?(cStat: string): boolean;
  /**
   * O conteúdo que a barreira da recusa repetida compara: o XML assinado sem o que muda sozinho entre duas montagens da
   * mesma nota (data e hora de emissão e de saída, código numérico e dígito da chave, assinatura, grupo suplementar).
   * Sem a função, a barreira compara os bytes.
   */
  conteudoParaRecusa?(xml: string): string;
  /**
   * `cStat` de recusa que pode ser corrigida só no que `conteudoParaRecusa` tira (a data de emissão, a assinatura): para
   * ela a barreira compara os bytes, para não barrar a correção.
   */
  recusaPorCampoVolatil?(cStat: string): boolean;
  /** Contingência automática do documento (ADR 0013); sem ela, `OpcoesEmissor.contingencia.automatica` é recusada. */
  readonly contingencia?: ContingenciaDoPerfil<Entrada, ContextoEmissor>;
  criarCliente(ctx: ContextoEmissor): Cliente;
  /** Monta, valida e assina, sem rede. Entrada inválida lança `ErroDeValidacao`. */
  assinar(entrada: Entrada, ctx: ContextoEmissor): Promise<DocumentoAssinado>;
  enviar(cliente: Cliente, xml: string, modo: ModoEnvio): Promise<Desfecho<P, B>>;
}

/**
 * Guarda o documento decidido (autorizado ou denegado) no sistema do integrador. Roda antes de a gravação ser apagada,
 * com a trava conferida; se lançar, os bytes ficam e a próxima retomada decide de novo. Precisa ser idempotente: depois
 * de uma queda entre guardar e apagar, roda outra vez com o mesmo documento. `trava` serve para o integrador conferir o
 * dono na mesma transação em que guarda.
 */
export type AoDecidir<P = unknown, B = unknown> = (
  registro: RegistroTransmissao,
  desfecho: DesfechoDecidido<P, B>,
  trava: Trava,
) => void | Promise<void>;

/**
 * O integrador já guardou o documento destes bytes? Consultado com a trava, quando há bytes gravados, antes de ir à
 * SEFAZ. Sim quando a transmissão caiu entre guardar o documento e apagar a gravação: a gravação é apagada e o desfecho
 * é `ja-guardado`. Sem o gancho, a consulta da chave decide de novo e o `aoDecidir` roda outra vez; o gancho evita a
 * volta à SEFAZ e o documento cancelado ou encerrado nesse meio tempo, que voltaria com `situacaoAtual`.
 */
export type JaGuardado = (registro: RegistroTransmissao) => boolean | Promise<boolean>;

/** Como o integrador guarda o documento: no emissor (padrão de todas as chamadas) ou em cada chamada. */
export interface OpcoesGuarda<P = unknown, B = unknown> {
  /** Guarda o documento decidido (veja `AoDecidir`). O da chamada vale sobre o do emissor. */
  readonly aoDecidir?: AoDecidir<P, B>;
  /** Veja `JaGuardado`. O da chamada vale sobre o do emissor. */
  readonly jaGuardado?: JaGuardado;
}

/**
 * Barreira contra reenviar a mesma nota recusada. A SEFAZ pode bloquear o emitente por até uma hora quando a mesma
 * nota volta com a mesma rejeição mais de 30 vezes (MOC 7.0 Anexo I, item 4.3.1, rejeição 656; limites
 * "parametrizáveis por ambiente autorizador"). Com o store que lembra recusas (`registrarRecusa` e `recusaRecente`), o
 * emissor conta as recusas definitivas iguais (o mesmo conteúdo com o mesmo `cStat`) e, quando a conta chega ao
 * `limite` dentro da janela, recusa com `RecusaRepetidaError`, antes de gravar, a próxima emissão do mesmo documento
 * com o mesmo conteúdo. O conteúdo é o XML assinado sem o que muda sozinho a cada montagem
 * (`PerfilDocumento.conteudoParaRecusa`): quem remonta a nota a cada tentativa, com a hora de agora, também é contado;
 * a nota corrigida passa e recomeça a conta, porque o conteúdo muda. Abaixo do limite, a mesma nota vai de novo: a
 * causa pode ter sido resolvida fora dela (o cadastro do emitente na SEFAZ).
 */
export interface OpcoesRecusaRepetida {
  /** Janela da conta, desde a primeira recusa da sequência, pelo relógio do banco. Padrão: 1 hora, a da regra. */
  readonly janelaMs?: number;
  /**
   * Recusas iguais dentro da janela a partir das quais a próxima é barrada. Padrão: 3 (a 4ª tentativa igual não sai),
   * bem abaixo das 30 da regra, com folga para quem reenvia depois de resolver a causa fora da nota.
   */
  readonly limite?: number;
}

export interface OpcoesTrava {
  /** Prazo da trava. Padrão: 10 minutos, com folga para envio, consulta, reenvio e recibo com o timeout de 60 s. */
  readonly prazoMs?: number;
  /** Renovação enquanto a transmissão roda. Padrão: um terço do prazo. `0` desliga (só para testes). */
  readonly renovarACadaMs?: number;
}

export interface OpcoesEmissor<P = unknown, B = unknown> extends OpcoesGuarda<P, B> {
  /** PFX do certificado A1 (e-CNPJ ou e-CPF), com `senha`. Os bytes não ficam guardados depois de abertos. */
  readonly pfx?: Uint8Array;
  readonly senha?: string;
  /** O certificado já aberto (`abrirCertificado`), no lugar de `pfx` e `senha`. */
  readonly certificado?: CertificadoAberto;
  readonly ambiente: Ambiente;
  /** Obrigatório: persistência dos bytes e trava entre processos. */
  readonly store: TransmissaoStore;
  readonly trava?: OpcoesTrava;
  /**
   * O documento que a consulta acha já cancelado ou encerrado fora deste fluxo (`situacaoAtual`): `guardar` (padrão)
   * devolve `autorizado` com a situação e o entrega ao `aoDecidir`; `divergente` devolve `divergente` com a situação e o
   * `proc`, e os bytes ficam, para quem não quer guardar como ativo um documento que a SEFAZ já cancelou.
   */
  readonly situacaoPosterior?: 'guardar' | 'divergente';
  /**
   * Barreira contra reenviar os mesmos bytes recusados (veja `OpcoesRecusaRepetida`). Ligada por padrão quando o
   * `store` implementa `registrarRecusa` e `recusaRecente`; `false` desliga. Sem esses métodos no store, não há
   * barreira (o store em memória os tem; num store SQL, são opcionais).
   */
  readonly recusaRepetida?: false | OpcoesRecusaRepetida;
  /**
   * Contingência automática (ADR 0013), desligada por padrão: com `automatica: true`, depois de `limiteFalhas` falhas
   * do autorizador normal na janela e a consulta de status sem 107, as notas novas saem em contingência (NF-e na SVC da
   * UF, NFC-e off-line) até a sonda ver o autorizador em operação. Bytes já gravados nunca mudam de tipo de emissão.
   * Só no emissor de NF-e e NFC-e.
   */
  readonly contingencia?: OpcoesContingencia;
  /** Avisa a entrada e a saída da contingência automática (log, alerta, tela do caixa). Se lançar, a emissão segue. */
  readonly aoMudarContingencia?: (mudanca: MudancaContingencia) => void | Promise<void>;
  /** Relógio de emissão; padrão o do sistema. */
  readonly clock?: Relogio;
  readonly logger?: Logger;
  /** Prazo por requisição. Padrão: o do transporte (60 s). */
  readonly timeoutMs?: number;
  /**
   * Cria o transporte a partir das opções padrão (identidade do PFX, allowlist dos hosts do ambiente, `tpAmb` do
   * corpo). Padrão: `createTransport` do `@sinete/transport`. Serve para somar uma AC de teste ou apontar para o
   * `@sinete/sefaz-sim`.
   */
  readonly transporte?: (padrao: CreateTransportOptions) => Transport;
}

/** Opções de `retomar`. */
export interface OpcoesRetomar<P = unknown, B = unknown> extends OpcoesGuarda<P, B> {
  /**
   * Só retoma se os bytes gravados forem desta gravação (`RegistroTransmissao.gravacao`), conferida já com a trava;
   * senão, `undefined` sem enviar nada. A retomada automática usa para não enviar uma gravação que ela não selecionou.
   */
  readonly gravacao?: string;
}

export interface OpcoesEmitir<P = unknown, B = unknown> extends OpcoesGuarda<P, B> {
  /** Dados do integrador gravados com os bytes (`RegistroTransmissao.meta`). Ignorado se já havia bytes gravados. */
  readonly meta?: Readonly<Record<string, unknown>>;
  /**
   * Envia mesmo que os mesmos bytes tenham sido recusados dentro da janela (`OpcoesEmissor.recusaRepetida`). Para
   * depois de resolver fora da nota a causa da recusa, como o cadastro do emitente na SEFAZ (203, 230).
   */
  readonly reenviarRecusado?: boolean;
}

/** O que `preparar` devolve: a entrada e os dados do integrador gravados com os bytes (vale sobre `OpcoesEmitir.meta`). */
export interface EntradaPreparada<Entrada> {
  readonly entrada: Entrada;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/**
 * Prepara a entrada só quando for montar: chamada com a trava, e só sem bytes gravados. Serve para conferir que o
 * documento ainda pode ser emitido e para ler do banco o que vai na montagem, sem esse trabalho (ou essa recusa) numa
 * retomada, que ignora a entrada.
 */
export type PrepararEntrada<Entrada> = () => Promise<EntradaPreparada<Entrada>>;

export interface Emissor<Entrada, Cliente, P = unknown, B = unknown> {
  readonly tipo: TipoDocumento;
  readonly titular: IcpIdentity;
  /**
   * Transmite o documento `ref` (o id dele no sistema do integrador). Com bytes já gravados para `ref`, retoma com eles
   * e ignora `entrada`: o documento nunca é montado de novo. Sem bytes, monta, valida, assina, grava e envia. `entrada`
   * pode ser a própria entrada ou `preparar` (veja `PrepararEntrada`), chamada só quando for montar.
   * `TransmissaoEmAndamentoError` se outro processo tem a trava; `ErroDeValidacao` se a entrada não passa, antes de
   * gravar; `TravaPerdidaError` se a trava venceu antes de guardar o desfecho (os bytes ficam para quem assumiu);
   * `ErroDeConfiguracao` sem `aoDecidir` no emissor nem na chamada.
   */
  emitir(
    ref: string,
    entrada: Entrada | PrepararEntrada<Entrada>,
    opcoes?: OpcoesEmitir<P, B>,
  ): Promise<Desfecho<P, B>>;
  /** Monta, valida e assina, sem gravar nem enviar. Não precisa de rede (roda no browser). */
  assinar(entrada: Entrada): Promise<DocumentoAssinado>;
  /**
   * Retoma pelos bytes gravados de `ref`; `undefined` se não há nada gravado (ou, com `opcoes.gravacao`, se a
   * gravação é outra). Nunca monta.
   */
  retomar(ref: string, opcoes?: OpcoesRetomar<P, B>): Promise<Desfecho<P, B> | undefined>;
  /** Cliente completo do documento, com o mesmo transporte e signer. Criado no primeiro uso. */
  readonly cliente: Cliente;
  /** Fecha o transporte (conexões keep-alive). */
  fechar(): Promise<void>;
}

const PRAZO_PADRAO_MS = 10 * 60 * 1000;
/** MOC 7.0 Anexo I, item 4.3.1: bloqueio de até 1 hora (critério de referência, parametrizável pela UF). */
const JANELA_RECUSA_PADRAO_MS = 60 * 60 * 1000;
const LIMITE_RECUSA_PADRAO = 3;

/** SHA-256 do texto, em hexadecimal: o que o store lembra de uma recusa. */
async function resumo(xml: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * O que a barreira lembra de uma recusa: o resumo do conteúdo (sem o que muda a cada montagem), ou o dos bytes quando a
 * recusa pode ser corrigida justamente num desses campos.
 */
function resumoParaRecusa(
  perfil: { conteudoParaRecusa?(xml: string): string; recusaPorCampoVolatil?(cStat: string): boolean },
  xml: string,
  cStat: string,
): Promise<string> {
  if (perfil.recusaPorCampoVolatil?.(cStat) === true) return resumo(xml);
  return resumo(perfil.conteudoParaRecusa?.(xml) ?? xml);
}

type StoreComRecusas = TransmissaoStore & Required<Pick<TransmissaoStore, 'registrarRecusa' | 'recusaRecente'>>;

/** Janela e limite da barreira de recusa repetida, ou `undefined` sem barreira (desligada ou store sem os métodos). */
function barreiraDaRecusa(
  opcoes: OpcoesEmissor<never, never>,
): { readonly janelaMs: number; readonly limite: number } | undefined {
  const s = opcoes.store;
  const temRegistrar = typeof s.registrarRecusa === 'function';
  if (temRegistrar !== (typeof s.recusaRecente === 'function')) {
    throw new ErroDeConfiguracao('o store implementa registrarRecusa e recusaRecente juntos, ou nenhum dos dois');
  }
  if (opcoes.recusaRepetida === false || !temRegistrar) return undefined;
  const janelaMs = opcoes.recusaRepetida?.janelaMs ?? JANELA_RECUSA_PADRAO_MS;
  if (!Number.isFinite(janelaMs) || janelaMs <= 0)
    throw new ErroDeConfiguracao(`janela da recusa repetida inválida: ${janelaMs}`);
  const limite = opcoes.recusaRepetida?.limite ?? LIMITE_RECUSA_PADRAO;
  if (!Number.isInteger(limite) || limite < 1)
    throw new ErroDeConfiguracao(`limite da recusa repetida inválido: ${limite}`);
  return { janelaMs, limite };
}

function conferirOpcoes(opcoes: OpcoesEmissor<never, never>): { prazoMs: number; renovarACadaMs: number } {
  const s = opcoes.store as Partial<TransmissaoStore> | undefined;
  if (s === undefined || typeof s.travar !== 'function' || typeof s.gravar !== 'function') {
    throw new ErroDeConfiguracao(
      'store é obrigatório: os bytes assinados são gravados antes do envio (TransmissaoStore)',
    );
  }
  if (opcoes.aoDecidir !== undefined && typeof opcoes.aoDecidir !== 'function') {
    throw new ErroDeConfiguracao('aoDecidir precisa ser uma função');
  }
  const comPfx = opcoes.pfx !== undefined || opcoes.senha !== undefined;
  if (comPfx === (opcoes.certificado !== undefined)) {
    throw new ErroDeConfiguracao('informe o certificado aberto ou o pfx com a senha, um dos dois');
  }
  if (comPfx && (opcoes.pfx === undefined || opcoes.senha === undefined)) {
    throw new ErroDeConfiguracao('o pfx vai com a senha');
  }
  const prazoMs = opcoes.trava?.prazoMs ?? PRAZO_PADRAO_MS;
  if (!Number.isFinite(prazoMs) || prazoMs <= 0) throw new ErroDeConfiguracao(`prazo da trava inválido: ${prazoMs}`);
  const renovarACadaMs = opcoes.trava?.renovarACadaMs ?? Math.floor(prazoMs / 3);
  if (!Number.isFinite(renovarACadaMs) || renovarACadaMs < 0 || renovarACadaMs >= prazoMs) {
    throw new ErroDeConfiguracao(`renovação da trava inválida: ${renovarACadaMs} (precisa ficar entre 0 e o prazo)`);
  }
  return { prazoMs, renovarACadaMs };
}

/** O autorizado com `situacaoAtual`, como divergente (opção `situacaoPosterior: 'divergente'`). */
function comoDivergente<P, B>(d: Desfecho<P, B>): Desfecho<P, B> {
  if (d.tipo !== 'autorizado' || d.situacaoAtual === undefined) return d;
  const situacao: SituacaoPosterior = d.situacaoAtual;
  return {
    documento: d.documento,
    tipo: 'divergente',
    id: d.id,
    xMotivo: `a SEFAZ autorizou estes bytes, mas o documento já está ${situacao} fora deste fluxo`,
    situacaoAtual: situacao,
    proc: d.proc,
    bruto: d.bruto,
  };
}

/**
 * Abre o PFX (ou usa o certificado aberto) e devolve o emissor. Nada vai à rede até a primeira operação que precisa
 * dela; o certificado fora da validade é recusado aqui (`CertError`).
 */
export async function createEmissor<Entrada, Cliente, P, B>(
  perfil: PerfilDocumento<Entrada, Cliente, P, B>,
  opcoes: OpcoesEmissor<P, B>,
): Promise<Emissor<Entrada, Cliente, P, B>> {
  const { prazoMs, renovarACadaMs } = conferirOpcoes(opcoes as OpcoesEmissor<never, never>);
  const barreira = barreiraDaRecusa(opcoes as OpcoesEmissor<never, never>);
  const { store, ambiente } = opcoes;
  const recusas = barreira === undefined ? undefined : (store as StoreComRecusas);
  const clock = opcoes.clock ?? relogioDoSistema;
  const logger = opcoes.logger ?? loggerSilencioso;
  const contingencia = criarContingencia<Entrada, ContextoEmissor>({
    opcoes: opcoes.contingencia,
    perfil: perfil.contingencia,
    tipo: perfil.tipo,
    ambiente,
    store,
    clock,
    logger,
    aoMudar: opcoes.aoMudarContingencia,
  });
  const cert: CertificadoAberto =
    opcoes.certificado ??
    (await abrirCertificado({ pfx: opcoes.pfx as Uint8Array, senha: opcoes.senha as string }, { clock }));
  const { signer } = cert;
  let transport: Transport | undefined;
  let client: Cliente | undefined;

  const ctx: ContextoEmissor = {
    ambiente,
    clock,
    signer,
    titular: cert.titular,
    logger: opcoes.logger,
    timeoutMs: opcoes.timeoutMs,
    transporte(): Transport {
      if (transport !== undefined) return transport;
      const padrao: CreateTransportOptions = {
        identity: cert.identidade,
        policy: allowlistPolicy({ hosts: ambienteHosts(ambiente), tpAmb: tpAmbDoAmbiente(ambiente) }),
        ...(opcoes.timeoutMs === undefined ? {} : { timeoutMs: opcoes.timeoutMs }),
        ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }),
      };
      transport = (opcoes.transporte ?? createTransport)(padrao);
      return transport;
    },
  };

  const cliente = (): Cliente => {
    client ??= perfil.criarCliente(ctx);
    return client;
  };

  /** Renova a trava enquanto a transmissão roda; a perda é conferida antes de guardar o desfecho. */
  function renovando(trava: Trava): () => void {
    if (renovarACadaMs === 0) return (): void => {};
    const t = setInterval(() => {
      store.renovar(trava, prazoMs).catch((e: unknown) => {
        // Falha pontual do banco: a próxima renovação tenta de novo, e a conferência antes de guardar decide.
        logger.warn('emissor: renovação da trava falhou', { tipo: trava.tipo, erro: String(e) });
      });
    }, renovarACadaMs);
    (t as unknown as { unref?: () => void }).unref?.();
    return (): void => clearInterval(t);
  }

  async function aplicar(
    trava: Trava,
    registro: RegistroTransmissao,
    d: Desfecho<P, B>,
    aoDecidir: AoDecidir<P, B>,
  ): Promise<void> {
    switch (destinoDosBytes(d, perfil.indefinido)) {
      case 'concluir':
        // Fencing: só quem ainda tem a trava guarda o desfecho.
        if (!(await store.renovar(trava, prazoMs))) {
          throw new TravaPerdidaError('a trava venceu antes de guardar o desfecho; outro processo pode ter assumido');
        }
        if (d.tipo !== 'ja-guardado') await aoDecidir(registro, d as DesfechoDecidido<P, B>, trava);
        await store.concluir(trava);
        return;
      case 'descartar':
        await store.descartar(trava);
        if (
          recusas !== undefined &&
          barreira !== undefined &&
          d.tipo === 'recusado' &&
          perfil.transitorio?.(d.cStat) !== true
        ) {
          // A lembrança só evita um reenvio inútil: se o banco falhar aqui, o desfecho vale e a SEFAZ continua a juíza.
          try {
            const digest = await resumoParaRecusa(perfil, registro.xml, d.cStat);
            await recusas.registrarRecusa(
              perfil.tipo,
              registro.ref,
              { digest, cStat: d.cStat, xMotivo: d.xMotivo },
              barreira.janelaMs,
            );
          } catch (e) {
            logger.warn('emissor: registrar a recusa falhou', { tipo: perfil.tipo, erro: String(e) });
          }
        }
        return;
      case 'manter':
        // Os bytes ficam, mas quem perdeu a trava não responde pela transmissão: quem assumiu a retoma e decide. Se a
        // conferência falha no banco, nada foi gravado e o desfecho vale.
        if (
          !(await store.renovar(trava, prazoMs).catch((e: unknown) => {
            logger.warn('emissor: conferir a trava falhou', { tipo: trava.tipo, erro: String(e) });
            return true;
          }))
        ) {
          throw new TravaPerdidaError('a trava venceu durante a transmissão; outro processo pode ter assumido', {
            detalhes: { desfecho: d.tipo },
          });
        }
        return;
    }
  }

  /** A guarda da chamada, sobre a do emissor; sem `aoDecidir` em nenhuma, recusa antes de travar. */
  function guardaDe(o: OpcoesGuarda<P, B> | undefined): { aoDecidir: AoDecidir<P, B>; jaGuardado?: JaGuardado } {
    const aoDecidir = o?.aoDecidir ?? opcoes.aoDecidir;
    if (typeof aoDecidir !== 'function') {
      throw new ErroDeConfiguracao('aoDecidir é obrigatório, no emissor ou na chamada: guarda o documento decidido');
    }
    const jaGuardado = o?.jaGuardado ?? opcoes.jaGuardado;
    return jaGuardado === undefined ? { aoDecidir } : { aoDecidir, jaGuardado };
  }

  /** NFC-e off-line com o autorizador fora: os bytes ficam gravados, sem envio, para a retomada (ADR 0013). */
  async function emContingencia(
    trava: Trava,
    registro: RegistroTransmissao,
    aoDecidir: AoDecidir<P, B>,
  ): Promise<Desfecho<P, B>> {
    const d: Desfecho<P, B> = {
      documento: perfil.tipo,
      tipo: 'pendente',
      id: registro.id,
      motivo: 'contingencia',
      xMotivo: 'emitida em contingência off-line; a retomada transmite quando o autorizador voltar',
    };
    await aplicar(trava, registro, d, aoDecidir);
    return d;
  }

  async function transmitir(
    ref: string,
    fonte:
      | { readonly entrada: Entrada | PrepararEntrada<Entrada>; readonly meta: Readonly<Record<string, unknown>> }
      | undefined,
    guarda: { aoDecidir: AoDecidir<P, B>; jaGuardado?: JaGuardado },
    gravacao?: string,
    reenviarRecusado = false,
  ): Promise<Desfecho<P, B> | undefined> {
    const trava = await store.travar(perfil.tipo, ref, prazoMs);
    if (trava === undefined) {
      throw new TransmissaoEmAndamentoError('transmissão em andamento para este documento', {
        detalhes: { tipo: perfil.tipo },
      });
    }
    const parar = renovando(trava);
    try {
      let registro = await store.ler(perfil.tipo, ref);
      if (gravacao !== undefined && registro?.gravacao !== gravacao) return undefined;
      let modo: ModoEnvio = 'retomada';
      if (registro === undefined) {
        if (fonte === undefined) return undefined;
        let { entrada } = fonte;
        let { meta } = fonte;
        if (typeof entrada === 'function') {
          const p = await (entrada as PrepararEntrada<Entrada>)();
          entrada = p.entrada;
          meta = p.meta ?? meta;
        }
        let offline = false;
        if (contingencia !== undefined) {
          // A contingência entra só aqui, na montagem de uma nota nova; bytes gravados nunca mudam (ADR 0013).
          const c = await contingencia.naMontagem(entrada as Entrada, ctx);
          entrada = c.entrada;
          offline = c.offline;
        }
        const a = await perfil.assinar(entrada as Entrada, ctx);
        if (recusas !== undefined && barreira !== undefined && !reenviarRecusado) {
          const r = await recusas.recusaRecente(perfil.tipo, ref, barreira.janelaMs);
          if (
            r !== undefined &&
            r.vezes >= barreira.limite &&
            r.digest === (await resumoParaRecusa(perfil, a.xml, r.cStat))
          ) {
            throw new RecusaRepetidaError(
              `a SEFAZ recusou esta mesma nota ${r.vezes} vezes desde ${r.primeiraEm.toISOString()} (${r.cStat}: ${r.xMotivo}); corrija a nota antes de reenviar`,
              {
                detalhes: {
                  tipo: perfil.tipo,
                  cStat: r.cStat,
                  xMotivo: r.xMotivo,
                  recusadaEm: r.recusadaEm.toISOString(),
                  primeiraEm: r.primeiraEm.toISOString(),
                  vezes: r.vezes,
                  limite: barreira.limite,
                  janelaMs: barreira.janelaMs,
                },
              },
            );
          }
        }
        registro = await store.gravar(trava, { xml: a.xml, id: a.id, meta });
        modo = 'primeiro';
        if (offline) return await emContingencia(trava, registro, guarda.aoDecidir);
      } else if (guarda.jaGuardado !== undefined && (await guarda.jaGuardado(registro))) {
        const d: Desfecho<P, B> = { documento: perfil.tipo, tipo: 'ja-guardado', id: registro.id };
        await aplicar(trava, registro, d, guarda.aoDecidir);
        return d;
      } else if (contingencia !== undefined && (await contingencia.seguraOffline(registro.xml, ctx))) {
        return await emContingencia(trava, registro, guarda.aoDecidir);
      }
      let d = await perfil.enviar(cliente(), registro.xml, modo);
      await contingencia?.depoisDoEnvio(registro.xml, d as Desfecho, ctx);
      if (opcoes.situacaoPosterior === 'divergente') d = comoDivergente(d);
      await aplicar(trava, registro, d, guarda.aoDecidir);
      return d;
    } finally {
      parar();
      try {
        await store.soltar(trava);
      } catch (e) {
        // A trava vence sozinha no prazo; o erro que importa é o da transmissão.
        logger.warn('emissor: soltar a trava falhou', { tipo: trava.tipo, erro: String(e) });
      }
    }
  }

  return {
    tipo: perfil.tipo,
    titular: cert.titular,
    async emitir(
      ref: string,
      entrada: Entrada | PrepararEntrada<Entrada>,
      o?: OpcoesEmitir<P, B>,
    ): Promise<Desfecho<P, B>> {
      const d = await transmitir(ref, { entrada, meta: o?.meta ?? {} }, guardaDe(o), undefined, o?.reenviarRecusado);
      // Com a fonte dada, `transmitir` sempre chega a um desfecho.
      return d as Desfecho<P, B>;
    },
    assinar: (entrada: Entrada): Promise<DocumentoAssinado> => perfil.assinar(entrada, ctx),
    retomar: async (ref: string, o?: OpcoesRetomar<P, B>): Promise<Desfecho<P, B> | undefined> =>
      transmitir(ref, undefined, guardaDe(o), o?.gravacao),
    get cliente(): Cliente {
      return cliente();
    },
    async fechar(): Promise<void> {
      const t = transport;
      transport = undefined;
      client = undefined;
      await t?.close();
    },
  };
}
