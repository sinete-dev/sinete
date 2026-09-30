/**
 * NFC-e (modelo 65) pelo `criarEmissorNfe` contra o `@sinete/sefaz-sim` em HTTPS com mTLS: a montagem com o QR Code
 * (versão 3, padrão, e versão 2 com um CSC de teste inventado), o DANFE NFC-e a partir do `nfeProc` e do QR Code, e a
 * contingência off-line (tpEmis 9), em que a nota é gravada e impressa antes de a SEFAZ responder e vai depois pela
 * retomada, com os mesmos bytes (Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, itens 4.3 e 4.4; NT 2025.001
 * v1.03). Nada é certificado ou CSC real: AC, e-CNPJ, servidor e CSC são inventados na hora.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { relogioManual } from '@sinete/core';
import type { OpQr } from '@sinete/da';
import { matrizQr } from '@sinete/da';
import * as da from '@sinete/da/nfce';
import * as daNfe from '@sinete/da/nfe';
import type { DadosNfe } from '@sinete/nfe';
import { urlsNfce } from '@sinete/nfe';
import type { CertificadoSintetico, SefazSim } from '@sinete/sefaz-sim';
import {
  certificadoSintetico,
  criarSefazSim,
  iniciarServidorSefazSim,
  pfxSintetico,
  redirecionarParaSim,
} from '@sinete/sefaz-sim';
import { criarTransporte, ErroTransporte } from '@sinete/transport';
import type { Desfecho } from '../src/index.ts';
import { criarBancoMemoria, criarMemoriaStore } from '../src/memoria.ts';
import type { DesfechoNfe, EmissorNfe, EmissorNfeOpcoes } from '../src/nfe.ts';
import { criarEmissorNfe } from '../src/nfe.ts';
import { CNPJ_EMIT, EMISSAO, IE_SP, item, nota } from './helpers/nota.ts';

const SENHA = 'senha-sintetica';
/** CSC de teste, inventado: não existe em SEFAZ nenhuma. */
const CSC_DE_TESTE = 'CSC-INVENTADO-SINETE-TESTE-0001';

let ac: CertificadoSintetico;
let servidor: CertificadoSintetico;
let pfx: Uint8Array;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  const emitente = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ_EMIT, emissor: ac });
  servidor = await certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac });
  pfx = pfxSintetico(emitente, SENHA, { cadeia: [ac] });
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

/** Venda ao consumidor sem destinatário, paga em dinheiro com troco. */
const nfce = (nNF: number, extra: Partial<DadosNfe> = {}): DadosNfe => {
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
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  readonly emissor: EmissorNfe;
  readonly store: ReturnType<typeof criarMemoriaStore>;
  novoEmissor(extra?: Partial<EmissorNfeOpcoes>): Promise<EmissorNfe>;
}

async function cenario(extra: Partial<EmissorNfeOpcoes> = {}): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = criarSefazSim({
    relogio: clock,
    uf: 'SP',
    cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
  });
  const server = await iniciarServidorSefazSim(sim, { certificado: servidor.pem, chave: servidor.chavePem });
  const banco = criarBancoMemoria();
  const emissores: EmissorNfe[] = [];
  const novoEmissor = async (mais: Partial<EmissorNfeOpcoes> = {}): Promise<EmissorNfe> => {
    const e = await criarEmissorNfe({
      pfx,
      senha: SENHA,
      uf: 'SP',
      ambiente: 'homologacao',
      relogio: clock,
      store: criarMemoriaStore({ relogio: clock, banco }),
      da: daNfe,
      aoDecidir: () => undefined,
      transporte: (o) => {
        // A política padrão é a allowlist dos hosts reais; o simulador em 127.0.0.1 fica fora dela.
        const { politica: _policy, ...semPolitica } = o;
        return redirecionarParaSim(criarTransporte({ ...semPolitica, acsAdicionais: [ac.pem] }), server.urlBase);
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
    await server.fechar();
  });
  return { clock, sim, emissor, store: criarMemoriaStore({ relogio: clock, banco }), novoEmissor };
}

function autorizado(d: Desfecho | undefined): Extract<DesfechoNfe, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
  return d as Extract<DesfechoNfe, { tipo: 'autorizado' }>;
}

const qrCodeDe = (xml: string): string => /<qrCode>([^<]+)<\/qrCode>/.exec(xml)?.[1]?.replaceAll('&amp;', '&') ?? '';

/** Matrizes dos QR Codes desenhados no documento. */
const qrsDo = (doc: da.Documento): (readonly (readonly boolean[])[])[] =>
  doc.paginas.flatMap((p) => p.ops.filter((o): o is OpQr => o.t === 'qr').map((o) => o.modulos));

describe('NFC-e pelo criarEmissorNfe', () => {
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
    expect(qrsDo(doc)).toEqual([matrizQr(qr, { nivelDeCorrecao: 'M' })]);
    const pdf = await c.emissor.pdf(d.proc);
    expect(pdf).toEqual(da.gerarPdf(doc));

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
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'NFeAutorizacao', vezes: Infinity });
    const offline = nfce(3, {
      contingencia: { tpEmis: '9', dhCont: new Date(EMISSAO), xJust: 'FALHA DE COMUNICACAO COM A SEFAZ AUTORIZADORA' },
    });
    const d = await c.emissor.emitir('cupom-3', offline);
    if (d.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${d.tipo}`);
    expect(d.motivo).toBe('sem-resposta');
    expect(d.causa).toBeInstanceOf(ErroTransporte);

    // Os bytes gravados já são a nota: QR Code com o dia, o valor e a assinatura (versão 3 off-line).
    const gravado = await c.store.ler('nfe', 'cupom-3');
    if (gravado === undefined) throw new Error('nada gravado');
    expect(gravado.xml).toContain('<tpEmis>9</tpEmis>');
    expect(qrCodeDe(gravado.xml)).toMatch(
      new RegExp(`\\?p=${gravado.id}\\|3\\|2\\|26\\|15\\.00\\|\\|\\|[A-Za-z0-9+/=]+$`),
    );
    // O DANFE NFC-e da contingência sai do NFe gravado, antes da autorização.
    const doc = da.danfce(gravado.xml);
    expect(qrsDo(doc)).toEqual([matrizQr(qrCodeDe(gravado.xml), { nivelDeCorrecao: 'M' })]);
    expect(da.gerarHtml(doc)).toContain('EMITIDA EM CONTINGÊNCIA');

    // A rede volta: a retomada, num emissor novo, transmite os mesmos bytes.
    c.sim.limparFalhas();
    c.clock.avancar(30 * 60_000);
    const depois = await c.novoEmissor();
    const r = autorizado(await depois.retomar('cupom-3'));
    expect(r.id).toBe(gravado.id);
    expect(r.proc).toContain(gravado.xml.replace(/^<\?xml[^>]*\?>/, ''));
    expect(await c.store.ler('nfe', 'cupom-3')).toBeUndefined();
  });
});
