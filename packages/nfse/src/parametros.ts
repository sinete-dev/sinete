/**
 * Parâmetros municipais do ADN (API de parametrização): convênio do município, alíquota e histórico de alíquotas por
 * código de serviço, regimes especiais, retenções e benefícios. Consultas GET com mTLS, com cache por URL no relógio
 * injetado, porque os parâmetros mudam raramente e a mesma consulta se repete a cada DPS.
 *
 * Caminhos (base `nfseEndpoint({ api: 'parametrizacao' })`):
 * - `/{cMun}/convenio` e `/{cMun}/{codigo}/{AAAA-MM-DD}/aliquota` e `/{cMun}/{codigo}/historicoaliquotas`: usados no
 *   spike S2 na produção restrita (ADR 0004, rodadas 1 e 3), com o formato de resposta observado. O caminho do manual
 *   de contribuintes v1.0 na Sefin (`/parametros_municipais/...`) respondeu 404.
 * - `/{cMun}/{codigo}/{AAAA-MM-DD}/regimes_especiais`, `/{cMun}/{AAAA-MM-DD}/retencoes` e
 *   `/{cMun}/{nBM}/{AAAA-MM-DD}/beneficio`: da documentação da API de parametrização, não sondados no spike. A
 *   resposta vem como JSON bruto (`RespostaParametrizacao.dados`).
 *
 * O código de serviço vai com pontos e o código municipal (`01.01.01.000`): sem os pontos, o ADN responde 400.
 */

import type { Logger, Relogio } from '@sinete/core';
import { ErroDeConfiguracao, ErroRespostaInvalida, loggerSilencioso } from '@sinete/core';
import type { EndpointResolvido, Transporte } from '@sinete/transport';
import { codigoServicoParametrizacao } from './codigos.ts';
import { lerJson } from './respostas.ts';

/** Resposta crua guardada no cache. */
export interface EntradaCache {
  readonly status: number;
  readonly corpo: string;
  /** Epoch em ms (relógio injetado) a partir do qual a entrada não vale mais. */
  readonly expiraEm: number;
}

/** Cache das consultas de parametrização. O padrão é `cacheEmMemoria()`; troque por um compartilhado entre processos. */
export interface CacheParametros {
  get(chave: string): EntradaCache | undefined | Promise<EntradaCache | undefined>;
  set(chave: string, entrada: EntradaCache): void | Promise<void>;
  clear(): void | Promise<void>;
}

/** Cache em memória com limite de entradas (sai a mais antiga). */
export function cacheEmMemoria(maxEntradas: number = 500): CacheParametros {
  if (!Number.isInteger(maxEntradas) || maxEntradas < 1)
    throw new ErroDeConfiguracao('maxEntradas precisa ser inteiro >= 1');
  const m = new Map<string, EntradaCache>();
  return {
    get: (chave: string): EntradaCache | undefined => m.get(chave),
    set(chave: string, entrada: EntradaCache): void {
      m.delete(chave);
      m.set(chave, entrada);
      while (m.size > maxEntradas) m.delete(m.keys().next().value as string);
    },
    clear: (): void => m.clear(),
  };
}

/** Convênio do município com o Sistema Nacional NFS-e. */
export interface ConvenioMunicipal {
  readonly aderenteAmbienteNacional: boolean;
  readonly aderenteEmissorNacional: boolean;
  /** Situação da emissão pelo padrão nacional dos contribuintes da RFB (valor numérico do ADN). */
  readonly situacaoEmissaoPadraoContribuintesRFB: number | undefined;
  /** Adesão ao Módulo de Apuração Nacional. */
  readonly aderenteMAN: boolean;
  readonly permiteAproveitamentoDeCreditos: boolean | undefined;
  /** O objeto `parametrosConvenio` como veio. */
  readonly bruto: Readonly<Record<string, unknown>>;
}

/** Uma alíquota vigente ou do histórico de um código de serviço. */
export interface AliquotaServico {
  /** `SIM` quando o serviço tem incidência de ISSQN no município. */
  readonly incidencia: string;
  /** Alíquota em %, com 2 casas (`2.90`). */
  readonly aliquota: string;
  /** Início da vigência, `AAAA-MM-DD`. */
  readonly inicio: string;
  /** Fim da vigência, `AAAA-MM-DD`, quando houver. */
  readonly fim: string | undefined;
}

/** Resposta de uma consulta cujo formato não foi observado: a mensagem e o JSON como veio. */
export interface RespostaParametrizacao {
  readonly mensagem: string | undefined;
  readonly dados: Readonly<Record<string, unknown>>;
}

export interface ParametrosMunicipais {
  /** Convênio do município, ou `undefined` se o ADN responder 404. */
  convenio(cMun: string): Promise<ConvenioMunicipal | undefined>;
  /** Alíquotas do código de serviço na competência (`AAAA-MM-DD`); `undefined` sem alíquota vigente (404). */
  aliquota(cMun: string, codigoServico: string, competencia: string): Promise<readonly AliquotaServico[] | undefined>;
  historicoAliquotas(cMun: string, codigoServico: string): Promise<readonly AliquotaServico[] | undefined>;
  regimesEspeciais(
    cMun: string,
    codigoServico: string,
    competencia: string,
  ): Promise<RespostaParametrizacao | undefined>;
  retencoes(cMun: string, competencia: string): Promise<RespostaParametrizacao | undefined>;
  beneficio(cMun: string, nBM: string, competencia: string): Promise<RespostaParametrizacao | undefined>;
  /** Esvazia o cache (o de memória padrão ou o injetado). */
  limparCache(): Promise<void>;
}

export interface ParametrosOptions {
  readonly transport: Transporte;
  readonly endpoint: EndpointResolvido;
  readonly clock: Relogio;
  /** `false` desliga. Padrão: `cacheEmMemoria()`. */
  readonly cache?: CacheParametros | false;
  /** Validade de uma resposta 200. Padrão: 6 horas. */
  readonly ttlMs?: number;
  /** Validade de um 404 (parâmetro inexistente). Padrão: 30 minutos. */
  readonly ttlNaoEncontradoMs?: number;
  readonly timeoutMs?: number;
  readonly logger?: Logger;
}

function conferirMunicipio(cMun: string): void {
  if (!/^\d{7}$/.test(cMun)) throw new ErroDeConfiguracao(`código de município inválido: ${cMun}`);
}

function conferirData(d: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ErroDeConfiguracao(`competência fora do formato AAAA-MM-DD: ${d}`);
}

/** `01.01.01.000` a partir de `010101`, `01.01.01` ou do próprio código de 9 dígitos com pontos. */
function codigoServico(c: string): string {
  const nove = /^(\d{2}\.\d{2}\.\d{2})\.(\d{3})$/.exec(c.trim());
  return nove === null ? codigoServicoParametrizacao(c) : `${nove[1]}.${nove[2]}`;
}

function dia(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined;
}

function aliquotas(json: Record<string, unknown>, operacao: string): AliquotaServico[] {
  const mapa = json.aliquotas;
  if (typeof mapa !== 'object' || mapa === null) throw new ErroRespostaInvalida(`${operacao}: resposta sem aliquotas`);
  const out: AliquotaServico[] = [];
  for (const lista of Object.values(mapa)) {
    if (!Array.isArray(lista)) continue;
    for (const a of lista as Record<string, unknown>[]) {
      const aliq = a.Aliq ?? a.aliq;
      const inicio = dia(a.DtIni ?? a.dtIni);
      if (typeof aliq !== 'number' || inicio === undefined) {
        throw new ErroRespostaInvalida(`${operacao}: alíquota fora do formato`, { detalhes: { operacao } });
      }
      out.push({
        incidencia: String(a.Incidencia ?? a.incidencia ?? ''),
        aliquota: aliq.toFixed(2),
        inicio,
        fim: dia(a.DtFim ?? a.dtFim),
      });
    }
  }
  return out;
}

function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

/** Cliente da parametrização municipal. `createNfseClient` já cria um em `client.parametros`. */
export function createParametrosMunicipais(o: ParametrosOptions): ParametrosMunicipais {
  const cache = o.cache === false ? undefined : (o.cache ?? cacheEmMemoria());
  const ttl = o.ttlMs ?? 6 * 3_600_000;
  const ttlNaoEncontrado = o.ttlNaoEncontradoMs ?? 30 * 60_000;
  const logger = o.logger ?? loggerSilencioso;
  const emVoo = new Map<string, Promise<EntradaCache>>();
  const base = o.endpoint.url.replace(/\/+$/, '');

  /** Lê a entrada (404 é `undefined`); JSON inválido ou HTTP fora de 200 e 404 é `ErroRespostaInvalida`. */
  function lerEntrada<T>(r: EntradaCache, operacao: string, ler: (body: Record<string, unknown>) => T): T | undefined {
    if (r.status === 404) return undefined;
    const body = lerJson(r.corpo);
    if (r.status !== 200 || body === undefined) {
      throw new ErroRespostaInvalida(`${operacao}: HTTP ${r.status}`, {
        detalhes: { operacao, status: r.status, mensagem: body?.mensagem },
      });
    }
    return ler(body);
  }

  /**
   * GET com cache pela URL e consultas simultâneas juntadas numa só. A resposta só entra no cache depois de lida com
   * sucesso por `ler`: resposta fora do formato (HTML de erro, JSON sem o grupo esperado) vira `ErroRespostaInvalida` e não
   * envenena as consultas seguintes durante o TTL.
   */
  async function consultar<T>(
    caminho: string,
    operacao: string,
    ler: (body: Record<string, unknown>) => T,
  ): Promise<T | undefined> {
    const url = `${base}${caminho}`;
    const guardada = await cache?.get(url);
    if (guardada !== undefined && guardada.expiraEm > o.clock.agora().getTime()) {
      return lerEntrada(guardada, operacao, ler);
    }
    let pendente = emVoo.get(url);
    if (pendente === undefined) {
      pendente = (async (): Promise<EntradaCache> => {
        const res = await o.transport.enviar({
          url,
          metodo: 'GET',
          cabecalhos: { accept: 'application/json' },
          endpoint: o.endpoint,
          ...(o.timeoutMs === undefined ? {} : { timeoutMs: o.timeoutMs }),
        });
        logger.debug('nfse.parametros', { caminho, status: res.status });
        return {
          status: res.status,
          corpo: res.texto(),
          expiraEm: o.clock.agora().getTime() + (res.status === 404 ? ttlNaoEncontrado : ttl),
        };
      })();
      emVoo.set(url, pendente);
      try {
        const entrada = await pendente;
        const valor = lerEntrada(entrada, operacao, ler);
        await cache?.set(url, entrada);
        return valor;
      } finally {
        emVoo.delete(url);
      }
    }
    return lerEntrada(await pendente, operacao, ler);
  }

  const bruta = (caminho: string, operacao: string): Promise<RespostaParametrizacao | undefined> =>
    consultar(caminho, operacao, (body): RespostaParametrizacao => {
      const { mensagem, ...dados } = body;
      return { mensagem: typeof mensagem === 'string' ? mensagem : undefined, dados };
    });

  return {
    async convenio(cMun: string): Promise<ConvenioMunicipal | undefined> {
      conferirMunicipio(cMun);
      return consultar(`/${cMun}/convenio`, 'convenio', (body): ConvenioMunicipal => {
        const p = body.parametrosConvenio;
        if (typeof p !== 'object' || p === null)
          throw new ErroRespostaInvalida('convenio: resposta sem parametrosConvenio');
        const c = p as Record<string, unknown>;
        // O ADN escreve "Aproveitameto" (sem o n) na produção restrita; aceita as duas grafias.
        const creditos = c.permiteAproveitamentoDeCreditos ?? c.permiteAproveitametoDeCreditos;
        return {
          aderenteAmbienteNacional: flag(c.aderenteAmbienteNacional),
          aderenteEmissorNacional: flag(c.aderenteEmissorNacional),
          situacaoEmissaoPadraoContribuintesRFB:
            typeof c.situacaoEmissaoPadraoContribuintesRFB === 'number'
              ? c.situacaoEmissaoPadraoContribuintesRFB
              : undefined,
          aderenteMAN: flag(c.aderenteMAN),
          permiteAproveitamentoDeCreditos: typeof creditos === 'boolean' ? creditos : undefined,
          bruto: c,
        };
      });
    },
    async aliquota(cMun: string, codigo: string, competencia: string): Promise<readonly AliquotaServico[] | undefined> {
      conferirMunicipio(cMun);
      conferirData(competencia);
      return consultar(`/${cMun}/${codigoServico(codigo)}/${competencia}/aliquota`, 'aliquota', (body) =>
        aliquotas(body, 'aliquota'),
      );
    },
    async historicoAliquotas(cMun: string, codigo: string): Promise<readonly AliquotaServico[] | undefined> {
      conferirMunicipio(cMun);
      return consultar(`/${cMun}/${codigoServico(codigo)}/historicoaliquotas`, 'historicoaliquotas', (body) =>
        aliquotas(body, 'historicoaliquotas'),
      );
    },
    async regimesEspeciais(
      cMun: string,
      codigo: string,
      competencia: string,
    ): Promise<RespostaParametrizacao | undefined> {
      conferirMunicipio(cMun);
      conferirData(competencia);
      return bruta(`/${cMun}/${codigoServico(codigo)}/${competencia}/regimes_especiais`, 'regimes_especiais');
    },
    async retencoes(cMun: string, competencia: string): Promise<RespostaParametrizacao | undefined> {
      conferirMunicipio(cMun);
      conferirData(competencia);
      return bruta(`/${cMun}/${competencia}/retencoes`, 'retencoes');
    },
    async beneficio(cMun: string, nBM: string, competencia: string): Promise<RespostaParametrizacao | undefined> {
      conferirMunicipio(cMun);
      conferirData(competencia);
      if (!/^\d{14}$/.test(nBM)) throw new ErroDeConfiguracao(`número de benefício inválido (14 dígitos): ${nBM}`);
      return bruta(`/${cMun}/${nBM}/${competencia}/beneficio`, 'beneficio');
    },
    async limparCache(): Promise<void> {
      await cache?.clear();
    },
  };
}
