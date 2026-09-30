/**
 * `criarNfseSim`: a Sefin Nacional e o ADN da NFS-e simulados, com estado e relógio injetado. Recebe o mesmo
 * `PedidoSim` do simulador da NF-e e devolve `RespostaSim`, então serve pelo `transporteSim` em processo e pelo servidor
 * HTTPS com mTLS (`startNfseSimServer`).
 *
 * Rotas (prefixo por API, ver `NFSE_SIM_PREFIXOS` e `redirecionarNfseParaSim`):
 * - Sefin: `POST /sefin/nfse`, `GET /sefin/nfse/{chave}`, `GET /sefin/dps/{id}`, `POST /sefin/nfse/{chave}/eventos`,
 *   `GET /sefin/nfse/{chave}/eventos/{tipo}/{seq}` (405 sem o tipo e 404 sem a sequência, como a Sefin real);
 * - ADN: `GET /parametrizacao/{cMun}/convenio` e as consultas de alíquota, histórico, regimes especiais, retenções e
 *   benefício. O DANFSe não é simulado: a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026).
 *
 * Mensagens no formato observado na produção restrita (ADR 0004): sucesso em JSON com o documento em gzip e base64,
 * rejeição em HTTP 400 com `{"erros":[{"Codigo","Descricao","Complemento"}]}`.
 */

import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { codificarBase64, elementosFilhos, lerXml, primeiroFilho } from '@sinete/core/xml';
import type { NfseApi } from '@sinete/transport';
import type { IdentidadeDoCertificado } from '../certs.ts';
import { conferirAssinaturaDoDocumento, conferirTransmissor } from '../certs.ts';
import type { AlvoDaFalha, FalhaSim, PedidoSim, RespostaSim } from '../sim.ts';
import { formatInstant, parseDateTime } from '../time.ts';
import type { NfseSimOpcoes } from './dados.ts';
import { aliquotaEm, codigoServico, convenioDe, resolverConfig, servicoDo } from './dados.ts';
import { gerarEvento, gerarNfse, gunzipB64, gzipB64, montarChave, semDeclaracao } from './documentos.ts';
import { leiauteNfseEm } from './leiaute.ts';
import type { DpsFatos, EventoNfseFatos, EventoNfseRegistro, NfseRegistro, NfseSimRegras } from './regras.ts';
import { mensagemDe, NFSE_REGRAS_PADRAO } from './regras.ts';

/** Prefixo de cada API da NFS-e no simulador. */
export const NFSE_SIM_PREFIXOS: Readonly<Record<NfseApi, string>> = {
  sefin: '/sefin',
  adn: '/adn',
  adnContribuintes: '/adn/contribuintes',
  parametrizacao: '/parametrizacao',
  cnc: '/cnc',
};

/** Rota do simulador, para mirar falhas. */
export type NfseRota = 'emitir' | 'consultarNfse' | 'consultarDps' | 'evento' | 'consultarEventos' | 'parametrizacao';

export interface AlvoDaFalhaNfseSim {
  readonly rota?: NfseRota;
  readonly vezes?: AlvoDaFalha['vezes'];
}

export interface InspecaoNfseSim {
  nfse(chave: string): NfseRegistro | undefined;
  nfses(): readonly NfseRegistro[];
  eventos(chave?: string): readonly EventoNfseRegistro[];
}

export interface NfseSimOpcoesCompletas extends NfseSimOpcoes {
  /** Regras de negócio. Padrão: `NFSE_REGRAS_PADRAO`. */
  readonly regras?: NfseSimRegras;
}

export interface NfseSim {
  atender(pedido: PedidoSim): Promise<RespostaSim>;
  /** Agenda uma falha de rede para os próximos pedidos da rota (todas, sem `rota`). */
  injetarFalha(falha: FalhaSim, alvo?: AlvoDaFalhaNfseSim): void;
  limparFalhas(): void;
  readonly inspecao: InspecaoNfseSim;
}

const JSON_CT = 'application/json; charset=utf-8';
/** Páginas de erro do IIS, na forma das que a Sefin devolve para rota sem handler. */
const IIS_404 =
  '<!DOCTYPE html><html><head><title>404 - File or directory not found.</title></head><body></body></html>';
const IIS_405 =
  '<!DOCTYPE html><html><head><title>405 - HTTP verb used to access this page is not allowed.</title></head><body></body></html>';
const BRASILIA = -180;

interface Erro {
  readonly codigo: string;
  readonly complemento?: string;
  readonly troca?: Readonly<Record<string, string>>;
}

function resposta(status: number, corpo: unknown): RespostaSim {
  return {
    status,
    cabecalhos: { 'content-type': JSON_CT },
    corpo: JSON.stringify(corpo),
    efeito: 'responder',
    atrasoMs: 0,
  };
}

function texto(status: number, corpo: string, ct = 'text/plain; charset=utf-8'): RespostaSim {
  return { status, cabecalhos: { 'content-type': ct }, corpo: corpo, efeito: 'responder', atrasoMs: 0 };
}

const filho = (el: ElementoXml | undefined, nome: string): ElementoXml | undefined =>
  el === undefined ? undefined : elementosFilhos(el).find((c) => c.local === nome);

/** Mapeia os códigos das regras de certificado do simulador da NF-e para os da NFS-e. */
const CERT_TRANSMISSOR: Readonly<Record<string, string>> = { '280': 'E1200', '281': 'E1203', '282': 'E1209' };

interface Assinaturas {
  readonly ausente: string;
  readonly invalida: string;
  readonly certificado: string;
  readonly foraDoPadrao: string;
  readonly outroTitular: string;
}

const ASSINATURA_DPS: Assinaturas = {
  ausente: 'E0717',
  invalida: 'E0714',
  certificado: 'E0715',
  foraDoPadrao: 'E0716',
  outroTitular: 'E0718',
};
const ASSINATURA_EVENTO: Assinaturas = {
  ausente: 'E1989',
  invalida: 'E1980',
  certificado: 'E1983',
  foraDoPadrao: 'E1986',
  outroTitular: 'E1991',
};

type Doc = { readonly CNPJ?: string | undefined; readonly CPF?: string | undefined };

/** Mesmo ator: CNPJ pela base (matriz e filiais, como na assinatura) ou CPF igual. */
function mesmoAtor(a: Doc, b: Doc): boolean {
  if (a.CNPJ !== undefined && b.CNPJ !== undefined) return a.CNPJ.slice(0, 8) === b.CNPJ.slice(0, 8);
  return a.CPF !== undefined && a.CPF === b.CPF;
}

/**
 * Certificado do canal de outro ator que não o emitente da DPS ou o autor do evento: a API da NFS-e Nacional não tem
 * transmissor terceiro nem procuração e responde 403 (observado e documentado na pesquisa de certificados; o Anexo I
 * não tem código de rejeição para isso). Sem certificado no canal (`exigirCertificado: false`), não há o que conferir.
 */
function canalDeOutroAtor(canal: IdentidadeDoCertificado | undefined, ator: Doc): RespostaSim | undefined {
  if (canal === undefined || mesmoAtor(canal, ator)) return undefined;
  return texto(403, 'certificado do canal não pertence ao emitente ou autor do documento');
}

function codigoAssinatura(cStat: string, a: Assinaturas): string {
  switch (cStat) {
    case '291':
      return a.certificado;
    case '290':
    case '292':
      return a.foraDoPadrao;
    case '213':
    case '227':
      return a.outroTitular;
    default:
      return a.invalida;
  }
}

/** Cria a NFS-e simulada. Cada instância tem estado próprio. */
export function criarNfseSim(opcoes: NfseSimOpcoesCompletas): NfseSim {
  const config = resolverConfig(opcoes);
  const regras = opcoes.regras ?? NFSE_REGRAS_PADRAO;
  const nfses = new Map<string, NfseRegistro>();
  const porDps = new Map<string, string>();
  const eventos: EventoNfseRegistro[] = [];
  const numeros = new Map<string, number>();
  let nDFSe = 0;
  const faults: { fault: FalhaSim; target: AlvoDaFalhaNfseSim; remaining: number }[] = [];
  let fila: Promise<unknown> = Promise.resolve();
  function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
    const run = fila.then(fn, fn);
    fila = run.catch(() => undefined);
    return run;
  }

  const agora = (): number => config.clock.agora().getTime();
  const dh = (ms: number): string => formatInstant(ms, BRASILIA);

  function falhas(rota: NfseRota): FalhaSim | undefined {
    const i = faults.findIndex((f) => f.target.rota === undefined || f.target.rota === rota);
    if (i < 0) return undefined;
    const armed = faults[i] as (typeof faults)[number];
    armed.remaining -= 1;
    if (armed.remaining <= 0) faults.splice(i, 1);
    return armed.fault;
  }

  function erros(status: number, lista: readonly Erro[], extra: Record<string, unknown> = {}): RespostaSim {
    return resposta(status, {
      tipoAmbiente: Number(config.tpAmb),
      versaoAplicativo: 'sefaz-sim',
      dataHoraProcessamento: dh(agora()),
      ...extra,
      erros: lista.map((e) => ({
        Codigo: e.codigo,
        Descricao: mensagemDe(e.codigo, e.troca),
        ...(e.complemento === undefined ? {} : { Complemento: e.complemento }),
      })),
    });
  }

  /** Recepção comum da DPS e do pedido de evento: corpo JSON, base64, gzip, UTF-8 e declaração, XML, namespace. */
  async function recepcao(
    request: PedidoSim,
    campo: string,
  ): Promise<{ ok: true; xml: string; doc: DocumentoXml } | { ok: false; res: RespostaSim }> {
    const corpo = typeof request.corpo === 'string' ? request.corpo : new TextDecoder().decode(request.corpo);
    let b64: unknown;
    try {
      b64 = (JSON.parse(corpo) as Record<string, unknown>)[campo];
    } catch {
      b64 = undefined;
    }
    if (typeof b64 !== 'string')
      return { ok: false, res: erros(400, [{ codigo: 'E1225', complemento: `campo ${campo} ausente` }]) };
    const bytes = await gunzipB64(b64);
    if (!bytes.ok) return { ok: false, res: erros(400, [{ codigo: bytes.etapa === 'base64' ? 'E1225' : 'E1226' }]) };
    let xml: string;
    try {
      xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes.bytes);
    } catch {
      return { ok: false, res: erros(400, [{ codigo: 'E1229' }]) };
    }
    if (!/^<\?xml[^?]*encoding=["']UTF-8["']/i.test(xml)) return { ok: false, res: erros(400, [{ codigo: 'E1229' }]) };
    let doc: DocumentoXml;
    try {
      doc = lerXml(xml);
    } catch {
      return { ok: false, res: erros(400, [{ codigo: 'E1226' }]) };
    }
    if (/<[A-Za-z_][\w.-]*:(?:DPS|pedRegEvento|infDPS|infPedReg)\b/.test(xml)) {
      return { ok: false, res: erros(400, [{ codigo: 'E1228' }]) };
    }
    return { ok: true, xml, doc };
  }

  function transmissor(
    request: PedidoSim,
    now: number,
  ): { ok: true; id: IdentidadeDoCertificado | undefined } | { ok: false; res: RespostaSim } {
    if (request.certificadoDoCliente === undefined) {
      if (config.exigirCertificado) return { ok: false, res: texto(403, 'certificado de cliente obrigatório') };
      return { ok: true, id: undefined };
    }
    const c = conferirTransmissor(request.certificadoDoCliente, now);
    if (!c.ok) return { ok: false, res: erros(400, [{ codigo: CERT_TRANSMISSOR[c.cStat] ?? 'E1200' }]) };
    return { ok: true, id: c.identidade };
  }

  async function emitir(request: PedidoSim): Promise<RespostaSim> {
    const now = agora();
    const t = transmissor(request, now);
    if (!t.ok) return t.res;
    const r = await recepcao(request, 'dpsXmlGZipB64');
    if (!r.ok) return r.res;
    const { doc, xml } = r;
    const leiaute = leiauteNfseEm(config.ambiente, now);
    if (doc.raiz.local !== 'DPS') return erros(400, [{ codigo: 'E1242' }]);
    const schema = leiaute.validar('dps', doc);
    if (schema.length > 0) return erros(400, [{ codigo: 'E1235', complemento: schema.slice(0, 3).join('; ') }]);
    const dps = leiaute.lerDps(doc);
    const inf = dps.infDPS;
    const emitente: { readonly CNPJ?: string; readonly CPF?: string } =
      (inf.tpEmit === '1' ? inf.prest : inf.tpEmit === '2' ? inf.toma : inf.interm) ?? {};
    const doc14 = {
      ...(emitente.CNPJ === undefined ? {} : { CNPJ: emitente.CNPJ }),
      ...(emitente.CPF === undefined ? {} : { CPF: emitente.CPF }),
    };
    const sig = await conferirAssinaturaDoDocumento({
      documento: doc,
      id: inf.Id,
      elemento: 'infDPS',
      agora: now,
      titular: doc14,
    });
    if (!sig.ok) {
      const temAssinatura = primeiroFilho(doc.raiz, 'Signature', 'http://www.w3.org/2000/09/xmldsig#') !== undefined;
      return erros(400, [
        { codigo: temAssinatura ? codigoAssinatura(sig.cStat, ASSINATURA_DPS) : ASSINATURA_DPS.ausente },
      ]);
    }
    const outroAtor = canalDeOutroAtor(t.id, doc14);
    if (outroAtor !== undefined) return outroAtor;
    const dhEmi = parseDateTime(inf.dhEmi) ?? now;
    const municipioEmissor = config.municipios.get(inf.cLocEmi);
    const tribISSQN = inf.valores.trib.tribMun.tribISSQN;
    const municipioIncidencia = tribISSQN === '1' ? municipioEmissor : undefined;
    const servico = servicoDo(
      municipioIncidencia,
      inf.serv.cServ.cTribNac + (inf.serv.cServ.cTribMun === undefined ? '' : `.${inf.serv.cServ.cTribMun}`),
    );
    const aliquota = aliquotaEm(servico, inf.dCompet);
    const chaveDup = porDps.get(inf.Id);
    const subst = inf.subst === undefined ? undefined : nfses.get(inf.subst.chSubstda);
    const fatos: DpsFatos = {
      configuracao: config,
      dps,
      inf,
      agora: now,
      dhEmi,
      diaEmissao: formatInstant(dhEmi, BRASILIA).slice(0, 10),
      municipioEmissor,
      municipioIncidencia,
      servico,
      aliquota,
      duplicada: chaveDup === undefined ? undefined : nfses.get(chaveDup),
      substituida:
        subst !== undefined && (subst.emitente.CNPJ ?? subst.emitente.CPF) === (doc14.CNPJ ?? doc14.CPF)
          ? subst
          : undefined,
    };
    for (const regra of regras.dps) {
      if (regra.violada(fatos)) {
        return erros(
          400,
          [{ codigo: regra.codigo, ...(regra.complemento ? { troca: regra.complemento(fatos) } : {}) }],
          {
            idDPS: inf.Id,
          },
        );
      }
    }
    const insc = doc14.CNPJ ?? `000${doc14.CPF}`;
    const chaveEmitente = `${inf.cLocEmi}${insc}`;
    const nNFSe = (numeros.get(chaveEmitente) ?? 0) + 1;
    numeros.set(chaveEmitente, nNFSe);
    nDFSe += 1;
    const dhProc = dh(now);
    const chave = montarChave({
      cMun: inf.cLocEmi,
      tpInsc: doc14.CNPJ === undefined ? '1' : '2',
      inscricao: insc,
      nNFSe,
      anoMes: `${dhProc.slice(2, 4)}${dhProc.slice(5, 7)}`,
      cNum: nDFSe,
    });
    const municipio = (c: string | undefined): string =>
      c === undefined ? '' : (config.municipios.get(c)?.nome ?? `MUNICIPIO ${c}`);
    const local = inf.serv.locPrest.cLocPrestacao;
    const nfseXml = await gerarNfse({
      chave,
      nNFSe,
      nDFSe,
      dhProc,
      dps,
      dpsXml: semDeclaracao(xml),
      xLocEmi: municipio(inf.cLocEmi),
      xLocPrestacao: local === undefined ? `EXTERIOR ${inf.serv.locPrest.cPaisPrestacao ?? ''}` : municipio(local),
      cLocIncid: municipioIncidencia?.cMun,
      xLocIncid: municipioIncidencia?.nome,
      xTribNac: servico?.descricao ?? `Serviço ${codigoServico(inf.serv.cServ.cTribNac)}`,
      aliquota: aliquota?.aliquota,
      documento: doc14,
      emitente: config.contribuintes.find((c) => (c.CNPJ ?? c.CPF) === (doc14.CNPJ ?? doc14.CPF)),
      aliquotasIbsCbs: config.aliquotasIbsCbs,
      signer: config.signer,
    });
    const registro: NfseRegistro = {
      chave,
      idDps: inf.Id,
      xml: nfseXml,
      emitente: doc14,
      cLocEmi: inf.cLocEmi,
      serie: inf.serie,
      nDPS: inf.nDPS,
      processadaEm: now,
      situacao: 'normal',
    };
    nfses.set(chave, registro);
    porDps.set(inf.Id, chave);
    if (fatos.substituida !== undefined) {
      fatos.substituida.situacao = 'substituida';
      await eventoDaSefin(
        fatos.substituida,
        '105102',
        {
          chSubstituta: chave,
          cMotivo: inf.subst?.cMotivo ?? '99',
          ...(inf.subst?.xMotivo === undefined ? {} : { xMotivo: inf.subst.xMotivo }),
        },
        now,
      );
    }
    return resposta(201, {
      tipoAmbiente: Number(config.tpAmb),
      versaoAplicativo: 'sefaz-sim',
      dataHoraProcessamento: dhProc,
      idDps: inf.Id,
      chaveAcesso: chave,
      nfseXmlGZipB64: await gzipB64(nfseXml),
      alertas: [],
    });
  }

  function seqDe(chave: string, tpEvento: string): number {
    return eventos.filter((e) => e.chave === chave && e.tpEvento === tpEvento).length + 1;
  }

  /** O e105102 que a Sefin registra na substituída: o pedido é da própria Sefin, com a assinatura do simulador. */
  async function eventoDaSefin(
    nfse: NfseRegistro,
    tpEvento: '105102',
    detalhe: { readonly chSubstituta: string; readonly cMotivo: string; readonly xMotivo?: string },
    now: number,
  ): Promise<void> {
    const leiaute = leiauteNfseEm(config.ambiente, now);
    const seq = seqDe(nfse.chave, tpEvento);
    const pedidoXml = await leiaute.pedidoDaSefin({
      chave: nfse.chave,
      autor: nfse.emitente,
      detalhe,
      dhEvento: dh(now),
      tpAmb: config.tpAmb,
      signer: config.signer,
    });
    const pedido = leiaute.lerPedido(lerXml(pedidoXml));
    await registrarEvento(nfse, tpEvento, seq, pedidoXml, pedido, now);
  }

  async function registrarEvento(
    nfse: NfseRegistro,
    tpEvento: string,
    seq: number,
    pedidoXml: string,
    pedido: Parameters<typeof gerarEvento>[0]['pedido'],
    now: number,
  ): Promise<EventoNfseRegistro> {
    nDFSe += 1;
    const id = `EVT${nfse.chave}${tpEvento}${String(seq).padStart(3, '0')}`;
    const xml = await gerarEvento({
      id,
      nSeqEvento: seq,
      nDFSe,
      dhProc: dh(now),
      pedidoXml,
      pedido,
      signer: config.signer,
    });
    const ev: EventoNfseRegistro = { chave: nfse.chave, tpEvento, nSeqEvento: seq, id, xml, recebidoEm: now };
    eventos.push(ev);
    return ev;
  }

  async function evento(request: PedidoSim, chaveRota: string): Promise<RespostaSim> {
    const now = agora();
    const t = transmissor(request, now);
    if (!t.ok) return t.res;
    const r = await recepcao(request, 'pedidoRegistroEventoXmlGZipB64');
    if (!r.ok) return r.res;
    const { doc, xml } = r;
    const leiaute = leiauteNfseEm(config.ambiente, now);
    if (doc.raiz.local !== 'pedRegEvento') return erros(400, [{ codigo: 'E1242' }]);
    const schema = leiaute.validar('pedRegEvento', doc);
    if (schema.length > 0) return erros(400, [{ codigo: 'E1235', complemento: schema.slice(0, 3).join('; ') }]);
    const pedido = leiaute.lerPedido(doc);
    const inf = pedido.infPedReg;
    const autor = inf.CNPJAutor !== undefined ? { CNPJ: inf.CNPJAutor } : { CPF: inf.CPFAutor };
    const sig = await conferirAssinaturaDoDocumento({
      documento: doc,
      id: inf.Id,
      elemento: 'infPedReg',
      agora: now,
      titular: autor,
    });
    if (!sig.ok) {
      const temAssinatura = primeiroFilho(doc.raiz, 'Signature', 'http://www.w3.org/2000/09/xmldsig#') !== undefined;
      if (!temAssinatura) return erros(400, [{ codigo: ASSINATURA_EVENTO.ausente }]);
      if (sig.cStat === '213') return erros(400, [{ codigo: 'E0812' }]);
      if (sig.cStat === '227') return erros(400, [{ codigo: 'E0815' }]);
      return erros(400, [{ codigo: codigoAssinatura(sig.cStat, ASSINATURA_EVENTO) }]);
    }
    const outroAtor = canalDeOutroAtor(t.id, autor);
    if (outroAtor !== undefined) return outroAtor;
    const grupo = elementosFilhos(filho(doc.raiz, 'infPedReg') as ElementoXml).find((e) => /^e\d{6}$/.test(e.local));
    const tpEvento = grupo === undefined ? '' : grupo.local.slice(1);
    const nfse = nfses.get(inf.chNFSe);
    const fatos: EventoNfseFatos = {
      configuracao: config,
      pedido,
      tpEvento,
      agora: now,
      nfse: inf.chNFSe === chaveRota ? nfse : undefined,
      eventos: eventos.filter((e) => e.chave === inf.chNFSe),
      municipioEmissor: nfse === undefined ? undefined : config.municipios.get(nfse.cLocEmi),
    };
    for (const regra of regras.evento) {
      if (regra.violada(fatos)) {
        return erros(400, [
          { codigo: regra.codigo, ...(regra.complemento ? { troca: regra.complemento(fatos) } : {}) },
        ]);
      }
    }
    const alvo = fatos.nfse as NfseRegistro;
    if (tpEvento === '101101') alvo.situacao = 'cancelada';
    const ev = await registrarEvento(alvo, tpEvento, seqDe(alvo.chave, tpEvento), semDeclaracao(xml), pedido, now);
    return resposta(201, {
      tipoAmbiente: Number(config.tpAmb),
      versaoAplicativo: 'sefaz-sim',
      dataHoraProcessamento: dh(now),
      eventoXmlGZipB64: await gzipB64(ev.xml),
    });
  }

  /**
   * Consulta de eventos como a Sefin da produção restrita (28/09/2026): 405 sem o tipo, 404 com a página HTML do IIS
   * sem a sequência, 200 com `eventos[].arquivoXml` (base64 do gzip em base64) e 404 com JSON vazio sem o evento.
   */
  async function consultarEventos(
    chave: string,
    tp: string | undefined,
    seq: string | undefined,
  ): Promise<RespostaSim> {
    if (tp === undefined) return texto(405, IIS_405, 'text/html');
    if (seq === undefined) return texto(404, IIS_404, 'text/html');
    if (!nfses.has(chave)) return resposta(404, {});
    const e = eventos.find((x) => x.chave === chave && x.tpEvento === tp && String(x.nSeqEvento) === seq);
    if (e === undefined) return resposta(404, {});
    return resposta(200, {
      dataHoraProcessamento: dh(agora()),
      tipoAmbiente: Number(config.tpAmb),
      versaoAplicativo: 'sefaz-sim',
      eventos: [
        {
          chaveAcesso: e.chave,
          tipoEvento: e.tpEvento,
          numeroPedidoRegistroEvento: String(e.nSeqEvento),
          dataHoraRecebimento: `${formatInstant(e.recebidoEm, BRASILIA).slice(0, 19)}.${String(e.recebidoEm % 1000).padStart(3, '0')}`,
          arquivoXml: codificarBase64(new TextEncoder().encode(await gzipB64(e.xml))),
        },
      ],
    });
  }

  function parametrizacao(partes: readonly string[]): RespostaSim {
    const [cMun = '', ...resto] = partes;
    const m = config.municipios.get(cMun);
    if (m === undefined) return resposta(404, { mensagem: 'Município não encontrado.' });
    const ok = (dados: Record<string, unknown>, mensagem: string): RespostaSim => resposta(200, { ...dados, mensagem });
    const nao = (mensagem: string): RespostaSim => resposta(404, { mensagem });
    if (resto.length === 1 && resto[0] === 'convenio') {
      return ok({ parametrosConvenio: convenioDe(m) }, 'Parâmetros do convênio recuperados com sucesso.');
    }
    const codigo = resto[0] ?? '';
    const codigoValido = /^\d{2}\.\d{2}\.\d{2}\.\d{3}$/.test(codigo);
    const mapa = (lista: readonly { aliquota: string; inicio: string; fim?: string }[]): Record<string, unknown> => ({
      aliquotas: {
        [codigo]: lista.map((a) => ({
          Incidencia: 'SIM',
          Aliq: Number(a.aliquota),
          DtIni: `${a.inicio}T00:00:00`,
          DtFim: a.fim === undefined ? null : `${a.fim}T00:00:00`,
        })),
      },
    });
    if (resto.length === 2 && resto[1] === 'historicoaliquotas') {
      if (!codigoValido)
        return resposta(400, {
          aliquotas: null,
          mensagem: 'Chamada mal formada. O código do serviço deve ser composto por nove dígitos.',
        });
      const s = servicoDo(m, codigo);
      return s === undefined || s.aliquotas.length === 0
        ? nao('Histórico de alíquotas não encontrado')
        : ok(mapa(s.aliquotas), 'Histórico de alíquotas recuperadas com sucesso.');
    }
    if (resto.length === 3 && resto[2] === 'aliquota') {
      if (!codigoValido)
        return resposta(400, {
          aliquotas: null,
          mensagem: 'Chamada mal formada. O código do serviço deve ser composto por nove dígitos.',
        });
      const a = aliquotaEm(servicoDo(m, codigo), resto[1] ?? '');
      return a === undefined ? nao('Alíquotas não encontradas.') : ok(mapa([a]), 'Alíquotas recuperadas com sucesso.');
    }
    const bruto = (
      tabela: Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined,
      chave: string,
    ): RespostaSim => {
      const d = tabela?.[chave];
      return d === undefined ? nao('Parâmetros não encontrados.') : ok({ ...d }, 'Parâmetros recuperados com sucesso.');
    };
    if (resto.length === 3 && resto[2] === 'regimes_especiais')
      return bruto(m.regimesEspeciais, `${codigo}/${resto[1]}`);
    if (resto.length === 2 && resto[1] === 'retencoes') return bruto(m.retencoes, resto[0] ?? '');
    if (resto.length === 3 && resto[2] === 'beneficio') return bruto(m.beneficios, `${codigo}/${resto[1]}`);
    return texto(404, 'rota não encontrada');
  }

  async function atender(request: PedidoSim): Promise<RespostaSim> {
    const method = (request.metodo ?? 'GET').toUpperCase();
    const path = request.caminho.split('?')[0] ?? '';
    const partes = path.split('/').filter(Boolean).map(decodeURIComponent);
    const [api, ...resto] = partes;
    let rota: NfseRota | undefined;
    let run: (() => Promise<RespostaSim>) | undefined;
    const exigirCert =
      (fn: () => Promise<RespostaSim>): (() => Promise<RespostaSim>) =>
      async (): Promise<RespostaSim> => {
        const t = transmissor(request, agora());
        return t.ok ? fn() : t.res;
      };
    if (api === 'sefin') {
      const [a, chave, b, tp, seq] = resto;
      if (a === 'nfse' && chave === undefined && method === 'POST') {
        rota = 'emitir';
        run = (): Promise<RespostaSim> => emitir(request);
      } else if (a === 'nfse' && chave !== undefined && b === undefined && method === 'GET') {
        rota = 'consultarNfse';
        run = exigirCert(async () => {
          const n = nfses.get(chave);
          return n === undefined
            ? resposta(404, { mensagem: 'NFS-e não encontrada' })
            : resposta(200, {
                tipoAmbiente: Number(config.tpAmb),
                versaoAplicativo: 'sefaz-sim',
                dataHoraProcessamento: dh(agora()),
                chaveAcesso: chave,
                nfseXmlGZipB64: await gzipB64(n.xml),
              });
        });
      } else if (a === 'dps' && chave !== undefined && b === undefined && method === 'GET') {
        rota = 'consultarDps';
        run = exigirCert(async () => {
          const c = porDps.get(chave);
          return c === undefined
            ? resposta(404, { mensagem: 'DPS não encontrada' })
            : resposta(200, {
                tipoAmbiente: Number(config.tpAmb),
                versaoAplicativo: 'sefaz-sim',
                dataHoraProcessamento: dh(agora()),
                idDps: chave,
                chaveAcesso: c,
              });
        });
      } else if (a === 'nfse' && chave !== undefined && b === 'eventos' && method === 'POST' && tp === undefined) {
        rota = 'evento';
        run = (): Promise<RespostaSim> => evento(request, chave);
      } else if (a === 'nfse' && chave !== undefined && b === 'eventos' && method === 'GET') {
        rota = 'consultarEventos';
        run = exigirCert(() => consultarEventos(chave, tp, seq));
      }
    } else if (api === 'parametrizacao' && method === 'GET') {
      rota = 'parametrizacao';
      run = exigirCert(async () => parametrizacao(resto));
    }
    if (rota === undefined || run === undefined) return texto(404, 'rota não encontrada');
    const fault = falhas(rota);
    if (fault?.tipo === 'http') return texto(fault.status, `HTTP ${fault.status}`);
    if ((fault?.tipo === 'derrubar' || fault?.tipo === 'travar') && fault.fase === 'antes') {
      return { ...texto(0, ''), efeito: fault.tipo };
    }
    const res = await run();
    if (fault?.tipo === 'derrubar' || fault?.tipo === 'travar') return { ...res, efeito: fault.tipo };
    return fault?.tipo === 'atraso' ? { ...res, atrasoMs: fault.ms } : res;
  }

  return {
    atender: (request: PedidoSim): Promise<RespostaSim> => exclusivo(() => atender(request)),
    injetarFalha(fault: FalhaSim, target: AlvoDaFalhaNfseSim = {}): void {
      faults.push({ fault, target, remaining: target.vezes ?? 1 });
    },
    limparFalhas(): void {
      faults.length = 0;
    },
    inspecao: {
      nfse: (chave: string): NfseRegistro | undefined => nfses.get(chave),
      nfses: (): readonly NfseRegistro[] => [...nfses.values()],
      eventos: (chave?: string): readonly EventoNfseRegistro[] =>
        chave === undefined ? [...eventos] : eventos.filter((e) => e.chave === chave),
    },
  };
}
