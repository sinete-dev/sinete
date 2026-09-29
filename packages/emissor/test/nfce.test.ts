/**
 * NFC-e (modelo 65) pelo `createNfeEmissor` contra o `@sinete/sefaz-sim` em HTTPS com mTLS: a montagem com o QR Code
 * (versão 3, padrão, e versão 2 com um CSC de teste inventado), o DANFE NFC-e a partir do `nfeProc` e do QR Code, e a
 * contingência off-line (tpEmis 9), em que a nota é gravada e impressa antes de a SEFAZ responder e vai depois pela
 * retomada, com os mesmos bytes (Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, itens 4.3 e 4.4; NT 2025.001
 * v1.03). Nada é certificado ou CSC real: AC, e-CNPJ, servidor e CSC são inventados na hora.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { ManualClock } from '@sinete/core';
import { manualClock } from '@sinete/core';
import type { QrOp } from '@sinete/da';
import { qrMatrix } from '@sinete/da';
import * as da from '@sinete/da/nfce';
import * as daNfe from '@sinete/da/nfe';
import type { NfeInput } from '@sinete/nfe';
import { urlsNfce } from '@sinete/nfe';
import type { SefazSim, SyntheticCertificate } from '@sinete/sefaz-sim';
import {
  createSefazSim,
  redirectToSim,
  startSefazSimServer,
  syntheticCertificate,
  syntheticPfx,
} from '@sinete/sefaz-sim';
import { createTransport, TransportError } from '@sinete/transport';
import type { Desfecho } from '../src/index.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';
import type { DesfechoNfe, NfeEmissor, NfeEmissorOptions } from '../src/nfe.ts';
import { createNfeEmissor } from '../src/nfe.ts';
import { CNPJ_EMIT, EMISSAO, IE_SP, item, nota } from './helpers/nota.ts';

const SENHA = 'senha-sintetica';
/** CSC de teste, inventado: não existe em SEFAZ nenhuma. */
const CSC_DE_TESTE = 'CSC-INVENTADO-SINETE-TESTE-0001';

let ac: SyntheticCertificate;
let servidor: SyntheticCertificate;
let pfx: Uint8Array;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = manualClock(EMISSAO);
  ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const emitente = await syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_EMIT, issuer: ac });
  servidor = await syntheticCertificate({ clock, role: 'servidor', issuer: ac });
  pfx = syntheticPfx(emitente, SENHA, { chain: [ac] });
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

/** Venda ao consumidor sem destinatário, paga em dinheiro com troco. */
const nfce = (nNF: number, extra: Partial<NfeInput> = {}): NfeInput => {
  const { destinatario: _semDestinatario, ...base } = nota({
    modelo: '65',
    cNF: '31415926',
    serie: 1,
    nNF,
    itens: [item()],
    pagamento: { detPag: [{ tPag: '01', vPag: '20.00' }] },
    ...extra,
  });
  return base;
};

interface Cenario {
  readonly clock: ManualClock;
  readonly sim: SefazSim;
  readonly emissor: NfeEmissor;
  readonly store: ReturnType<typeof createMemoriaStore>;
  novoEmissor(extra?: Partial<NfeEmissorOptions>): Promise<NfeEmissor>;
}

async function cenario(extra: Partial<NfeEmissorOptions> = {}): Promise<Cenario> {
  const clock = manualClock(EMISSAO);
  const sim = createSefazSim({
    clock,
    uf: 'SP',
    cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
  });
  const server = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
  const banco = createBancoMemoria();
  const emissores: NfeEmissor[] = [];
  const novoEmissor = async (mais: Partial<NfeEmissorOptions> = {}): Promise<NfeEmissor> => {
    const e = await createNfeEmissor({
      pfx,
      senha: SENHA,
      uf: 'SP',
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock, banco }),
      da: daNfe,
      aoDecidir: () => undefined,
      transporte: (o) => {
        // A política padrão é a allowlist dos hosts reais; o simulador em 127.0.0.1 fica fora dela.
        const { policy: _policy, ...semPolitica } = o;
        return redirectToSim(createTransport({ ...semPolitica, additionalCa: [ac.pem] }), server.baseUrl);
      },
      ...extra,
      ...mais,
    });
    emissores.push(e);
    return e;
  };
  const emissor = await novoEmissor();
  fechar.push(async () => {
    for (const e of emissores) await e.fechar();
    await server.close();
  });
  return { clock, sim, emissor, store: createMemoriaStore({ clock, banco }), novoEmissor };
}

function autorizado(d: Desfecho | undefined): Extract<DesfechoNfe, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
  return d as Extract<DesfechoNfe, { tipo: 'autorizado' }>;
}

const qrCodeDe = (xml: string): string => /<qrCode>([^<]+)<\/qrCode>/.exec(xml)?.[1]?.replaceAll('&amp;', '&') ?? '';

/** Matrizes dos QR Codes desenhados no documento. */
const qrsDo = (doc: da.Doc): (readonly (readonly boolean[])[])[] =>
  doc.pages.flatMap((p) => p.ops.filter((o): o is QrOp => o.t === 'qr').map((o) => o.modules));

describe('NFC-e pelo createNfeEmissor', () => {
  test('QR Code versão 3: autorizada, e o DANFE NFC-e sai do nfeProc com o QR Code da nota', async () => {
    const c = await cenario();
    const d = autorizado(await c.emissor.emitir('cupom-1', nfce(1)));
    expect(d.cStat).toBe('100');
    const qr = qrCodeDe(d.proc);
    const urls = urlsNfce('SP', 'homologacao', '2026-09-26');
    expect(qr).toBe(`${urls.qrCode}?p=${d.id}|3|2`);
    expect(d.proc).toContain(`<urlChave>${urls.urlChave}</urlChave>`);
    expect(d.proc).toContain('<tpImp>4</tpImp>');
    expect(d.proc).toContain('<vTroco>5.00</vTroco>');

    const doc = da.danfce(d.proc);
    expect(qrsDo(doc)).toEqual([qrMatrix(qr, { ecc: 'M' })]);
    const pdf = await c.emissor.pdf(d.proc);
    expect(pdf).toEqual(da.toPdf(doc));

    // Determinístico: outra SEFAZ simulada, com o mesmo relógio, dá os mesmos bytes do XML e do PDF.
    const outra = await cenario();
    const d2 = autorizado(await outra.emissor.emitir('cupom-1', nfce(1)));
    expect(d2.proc).toBe(d.proc);
    expect(await outra.emissor.pdf(d2.proc)).toEqual(pdf);
  });

  test('QR Code versão 2 com CSC: o hash vai no QR Code, o CSC nunca vai no XML', async () => {
    const c = await cenario({ montagem: { qrCode: { versao: '2', idCSC: '1', CSC: CSC_DE_TESTE } } });
    const d = autorizado(await c.emissor.emitir('cupom-2', nfce(2)));
    expect(qrCodeDe(d.proc)).toMatch(new RegExp(`\\?p=${d.id}\\|2\\|2\\|1\\|[0-9A-F]{40}$`));
    expect(d.proc).not.toContain(CSC_DE_TESTE);
  });

  test('contingência off-line: gravada e impressa sem a SEFAZ, transmitida depois pela retomada com os mesmos bytes', async () => {
    const c = await cenario();
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NFeAutorizacao', times: Infinity });
    const offline = nfce(3, {
      contingencia: { tpEmis: '9', dhCont: new Date(EMISSAO), xJust: 'FALHA DE COMUNICACAO COM A SEFAZ AUTORIZADORA' },
    });
    const d = await c.emissor.emitir('cupom-3', offline);
    if (d.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${d.tipo}`);
    expect(d.motivo).toBe('sem-resposta');
    expect(d.causa).toBeInstanceOf(TransportError);

    // Os bytes gravados já são a nota: QR Code com o dia, o valor e a assinatura (versão 3 off-line).
    const gravado = await c.store.ler('nfe', 'cupom-3');
    if (gravado === undefined) throw new Error('nada gravado');
    expect(gravado.xml).toContain('<tpEmis>9</tpEmis>');
    expect(qrCodeDe(gravado.xml)).toMatch(
      new RegExp(`\\?p=${gravado.id}\\|3\\|2\\|26\\|15\\.00\\|\\|\\|[A-Za-z0-9+/=]+$`),
    );
    // O DANFE NFC-e da contingência sai do NFe gravado, antes da autorização.
    const doc = da.danfce(gravado.xml);
    expect(qrsDo(doc)).toEqual([qrMatrix(qrCodeDe(gravado.xml), { ecc: 'M' })]);
    expect(da.toHtml(doc)).toContain('EMITIDA EM CONTINGÊNCIA');

    // A rede volta: a retomada, num emissor novo, transmite os mesmos bytes.
    c.sim.clearFaults();
    c.clock.advance(30 * 60_000);
    const depois = await c.novoEmissor();
    const r = autorizado(await depois.retomar('cupom-3'));
    expect(r.id).toBe(gravado.id);
    expect(r.proc).toContain(gravado.xml.replace(/^<\?xml[^>]*\?>/, ''));
    expect(await c.store.ler('nfe', 'cupom-3')).toBeUndefined();
  });
});
