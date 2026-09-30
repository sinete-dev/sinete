/**
 * Certificado A3 de ponta a ponta: o `@sinete/emissor` recebe um `CertificadoAberto` montado pelo
 * `@sinete/transport/signer` a partir de um token PKCS#11 (SoftHSM, com o par gerado dentro do token) e emite contra o
 * `@sinete/sefaz-sim` em HTTPS com mTLS. O mTLS sai pelo helper `sinete-signer -p11` e o XML é assinado pelo
 * `dfe.sign`, que o helper valida antes de usar a chave. Nada é certificado real: AC, servidor e tokens nascem na hora.
 * Sem Go com cgo, SoftHSM ou OpenSSL, a suíte é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { relogioManual } from '@sinete/core';
import type { SyntheticCertificate } from '@sinete/sefaz-sim';
import {
  createNfseSim,
  createSefazSim,
  redirectNfseToSim,
  redirectToSim,
  startSefazSimServer,
  startSimServer,
  syntheticCertificate,
} from '@sinete/sefaz-sim';
import type { CriarTransporteOpcoes, Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import type { ConexaoSigner, IdentidadeSigner } from '@sinete/transport/signer';
import { certificadoAberto, iniciarSigner } from '@sinete/transport/signer';
import type { SignerBinaries } from '../../transport/test/lab/signer-bin.ts';
import { signerBinaries } from '../../transport/test/lab/signer-bin.ts';
import { createMdfeEmissor } from '../src/mdfe.ts';
import { createMemoriaStore } from '../src/memoria.ts';
import { createNfeEmissor } from '../src/nfe.ts';
import { createNfseEmissor } from '../src/nfse.ts';
import { CPF_EMIT, cargaPropria, EMISSAO as EMISSAO_MDFE } from './helpers/mdfe.ts';
import { dps, EMISSAO as EMISSAO_NFSE, MUNICIPIOS } from './helpers/nfse.ts';
import { CNPJ_EMIT, EMISSAO, IE_SP, nota } from './helpers/nota.ts';

const bins = await signerBinaries();
const pronto = bins?.p11 !== undefined && bins.p11lab !== undefined && bins.softhsmModule !== undefined;

describe.skipIf(!pronto)('A3 em token PKCS#11 pelo sinete-signer, emissor contra a SEFAZ simulada', () => {
  const b = bins as SignerBinaries;
  let dir: string;
  let ac: SyntheticCertificate;
  let servidor: SyntheticCertificate;
  let signer: ConexaoSigner;
  let eCnpj: IdentidadeSigner;
  let eCpf: IdentidadeSigner;

  /** Um token por titular, com o certificado emitido pela AC do simulador e validade que cobre as emissões. */
  const token = (label: string, doc: ['--cnpj' | '--cpf', string]): void => {
    execFileSync(
      b.p11lab as string,
      [
        '--dir',
        dir,
        '--token',
        label,
        '--pin',
        '2468',
        '--ca-cert',
        path.join(dir, 'ac.pem'),
        '--ca-key',
        path.join(dir, 'ac.key'),
        ...doc,
        '--not-before',
        '2026-09-01T00:00:00Z',
        '--days',
        '400',
      ],
      { stdio: 'ignore' },
    );
  };

  const viaSim =
    (redirect: (t: Transporte) => Transporte) =>
    ({ politica: _p, ...o }: CriarTransporteOpcoes): Transporte =>
      redirect(criarTransporte(o));

  beforeAll(async () => {
    const clock = relogioManual(EMISSAO);
    ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
    servidor = await syntheticCertificate({ clock, role: 'servidor', issuer: ac });
    dir = mkdtempSync(path.join(tmpdir(), 'sinete-a3-'));
    writeFileSync(path.join(dir, 'ac.pem'), ac.pem);
    writeFileSync(path.join(dir, 'ac.key'), ac.keyPem);
    token('a3-cnpj', ['--cnpj', CNPJ_EMIT]);
    token('a3-cpf', ['--cpf', CPF_EMIT]);
    rmSync(path.join(dir, 'ac.key'));
    signer = await iniciarSigner({
      binario: b.p11 as string,
      lab: true,
      env: { SOFTHSM2_CONF: path.join(dir, 'softhsm2.conf') },
    });
    const abrir = (tok: string): Promise<IdentidadeSigner> =>
      signer.abrirPkcs11({
        modulo: b.softhsmModule as string,
        token: tok,
        rotulo: 'certificado-a3',
        pin: async () => '2468',
        acsAdicionais: [ac.pem],
      });
    eCnpj = await abrir('a3-cnpj');
    eCpf = await abrir('a3-cpf');
  }, 120_000);

  afterAll(async () => {
    await signer?.fechar();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('NF-e: emite, corrige e cancela com o XML assinado no token', async () => {
    const clock = relogioManual(EMISSAO);
    const sim = createSefazSim({
      clock,
      uf: 'SP',
      cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
    });
    const server = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
    const certificado = certificadoAberto(eCnpj);
    expect(certificado.titular.cnpj).toBe(CNPJ_EMIT);
    const emissor = await createNfeEmissor({
      certificado,
      uf: 'SP',
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock }),
      aoDecidir: () => {},
      transporte: viaSim((t) => redirectToSim(t, server.baseUrl)),
    });
    try {
      const d = await emissor.emitir('a3-1', nota({ nNF: 1 }));
      if (d.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
      expect(d.cStat).toBe('100');
      // O XML guardado leva o certificado do token no KeyInfo.
      const leaf = Buffer.from(eCnpj.cadeia[0] as Uint8Array).toString('base64');
      expect(d.proc).toContain(`<X509Certificate>${leaf}</X509Certificate>`);
      clock.avancar(60_000);
      const cce = await emissor.cartaCorrecao({ chave: d.id, xCorrecao: 'CORRECAO PELO TOKEN A3', nSeqEvento: 1 });
      expect([cce.tipo, cce.cStat]).toEqual(['autorizado', '135']);
      const canc = await emissor.cancelar({
        chave: d.id,
        nProt: d.protocolo.nProt,
        xJust: 'CANCELAMENTO PELO TOKEN A3',
      });
      expect(canc.tipo).toBe('registrado');
      // Assinaturas no token: a do handshake (keep-alive depois) e três de documento.
      const n = (await signer.estatisticas())[eCnpj.id]?.signatures ?? 0;
      expect(n).toBeGreaterThanOrEqual(4);
    } finally {
      await emissor.fechar();
      await server.close();
    }
  });

  test('MDF-e: emitente pessoa física, Id com o CPF, assinado no token do e-CPF', async () => {
    const clock = relogioManual(EMISSAO_MDFE);
    const sim = createSefazSim({ clock, uf: 'MT' });
    const server = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
    const emissor = await createMdfeEmissor({
      certificado: certificadoAberto(eCpf),
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock }),
      aoDecidir: () => {},
      transporte: viaSim((t) => redirectToSim(t, server.baseUrl)),
    });
    try {
      const d = await emissor.emitir('a3-mdfe-1', cargaPropria());
      if (d.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
      expect(d.cStat).toBe('100');
    } finally {
      await emissor.fechar();
      await server.close();
    }
  });

  test('NFS-e Nacional: a DPS e o cancelamento assinados no token, JSON pelo helper', async () => {
    const clock = relogioManual(EMISSAO_NFSE);
    const sim = createNfseSim({ clock, signer: servidor.signer, municipios: MUNICIPIOS });
    const server = await startSimServer({ handle: (r) => sim.handle(r) }, { cert: servidor.pem, key: servidor.keyPem });
    const emissor = await createNfseEmissor({
      certificado: certificadoAberto(eCnpj),
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock }),
      aoDecidir: () => {},
      transporte: viaSim((t) => redirectNfseToSim(t, server.baseUrl)),
    });
    try {
      const d = await emissor.emitir('a3-nfse-1', dps());
      if (d.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
      const canc = await emissor.cancelar({
        chave: d.protocolo.chaveAcesso,
        cMotivo: '1',
        xMotivo: 'Erro na emissão da nota de teste',
      });
      expect(canc.tipo).toBe('registrado');
    } finally {
      await emissor.fechar();
      await server.close();
    }
  });
});
