import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { abrirPfx, pemDoCertificado } from '@sinete/cert';
import { relogioFixo, relogioManual } from '@sinete/core';
import type { Pki } from '../../transport/test/lab/pki.ts';
import { createPki, findOpenssl } from '../../transport/test/lab/pki.ts';
import { wwwServer } from '../../transport/test/lab/servers.ts';
import { chainMessage, resolveEndpoint } from '../src/doctor.ts';
import type { DoctorCheck, DoctorOptions } from '../src/index.ts';
import { formatCnpj, formatReport, maskCpf, maskCpfs, parseHttpDate, runDoctor } from '../src/index.ts';

const fixtures = path.join(import.meta.dir, '../../cert/test/fixtures');
const pfx = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(fixtures, name)));
const clock = relogioFixo('2026-09-25T12:00:00Z');
const byId = (checks: readonly DoctorCheck[], id: string): DoctorCheck | undefined => checks.find((c) => c.id === id);

describe('runDoctor sem rede', () => {
  test('e-CNPJ válido: titular, CPF mascarado e cadeia sintética', async () => {
    const r = await runDoctor({ pfx: pfx('ecnpj-3des-cadeia.pfx'), password: 'sinete-teste', clock });
    expect(r.ok).toBe(true);
    const p = byId(r.checks, 'pfx');
    expect(p?.status).toBe('ok');
    expect(p?.message).toContain('e-CNPJ 11.222.333/0001-81');
    expect(p?.message).toContain('***.444.777-**');
    expect(p?.message).not.toContain('11144477735');
    expect(p?.details).toMatchObject({ daysLeft: 97, certificadosNoPfx: 3 });
    expect(byId(r.checks, 'cadeia')?.status).toBe('aviso');
    expect(byId(r.checks, 'relogio')?.status).toBe('pulado');
    expect(byId(r.checks, 'tls')?.status).toBe('pulado');
    expect(r.checks.map((c) => c.id)).toEqual(['pfx', 'cadeia', 'relogio', 'tls', 'status']);
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE|sinete-teste/);
  });

  test('PFX só com a folha: cadeia incompleta; com --cadeia, sobe até a raiz', async () => {
    const r = await runDoctor({ pfx: pfx('ecnpj-legacy.pfx'), password: 'sinete-teste', clock });
    expect(byId(r.checks, 'cadeia')).toMatchObject({ status: 'aviso' });
    expect(byId(r.checks, 'cadeia')?.message).toContain('AC SINTETICA SINETE v1');
    const full = await abrirPfx(pfx('ecnpj-3des-cadeia.pfx'), { senha: 'sinete-teste', relogio: clock });
    const extraChainPem = full.certificadosExtras.map((c) => pemDoCertificado(c)).join('');
    const r2 = await runDoctor({ pfx: pfx('ecnpj-legacy.pfx'), password: 'sinete-teste', clock, extraChainPem });
    expect(byId(r2.checks, 'cadeia')?.details).toMatchObject({ status: 'raiz_desconhecida' });
  });

  test('e-CPF: o CPF não aparece em lugar nenhum da saída', async () => {
    const r = await runDoctor({ pfx: pfx('ecpf-legacy-acentuada.pfx'), password: 'Açaí#2026', clock });
    expect(byId(r.checks, 'pfx')?.message).toContain('e-CPF ***.444.777-**');
    expect(JSON.stringify(r)).not.toContain('11144477735');
    expect(byId(r.checks, 'cadeia')?.details).toMatchObject({ chain: ['FULANO SINTETICO DE TESTE:***.444.777-**'] });
    const vencido = await runDoctor({
      pfx: pfx('ecpf-legacy-acentuada.pfx'),
      password: 'Açaí#2026',
      clock: relogioFixo('2041-01-01T00:00:00Z'),
      allowExpired: true,
    });
    expect(JSON.stringify(vencido)).not.toContain('11144477735');
  });

  test('vencido, perto de vencer e ainda não válido', async () => {
    const venc = await runDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      password: 'sinete-teste',
      clock: relogioFixo('2027-02-01T00:00:00Z'),
    });
    expect(venc.ok).toBe(false);
    expect(byId(venc.checks, 'pfx')).toMatchObject({ status: 'falha' });
    expect(byId(venc.checks, 'pfx')?.message).toContain('VENCIDO');
    const lax = await runDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      password: 'sinete-teste',
      clock: relogioFixo('2027-02-01T00:00:00Z'),
      allowExpired: true,
    });
    expect(byId(lax.checks, 'pfx')?.status).toBe('aviso');
    const perto = await runDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      password: 'sinete-teste',
      clock: relogioFixo('2026-12-20T00:00:00Z'),
    });
    expect(byId(perto.checks, 'pfx')?.status).toBe('aviso');
    for (const allowExpired of [false, true]) {
      const cedo = await runDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        password: 'sinete-teste',
        clock: relogioFixo('2025-06-01T00:00:00Z'),
        allowExpired,
      });
      expect(byId(cedo.checks, 'pfx')?.status).toBe(allowExpired ? 'aviso' : 'falha');
      expect(byId(cedo.checks, 'relogio')?.status).toBe('aviso');
    }
  });

  test('senha errada e arquivo inválido: falha tipada e o resto pulado', async () => {
    const r = await runDoctor({ pfx: pfx('ecnpj-legacy.pfx'), password: 'errada', clock });
    expect(r.ok).toBe(false);
    expect(byId(r.checks, 'pfx')?.details).toEqual({ code: 'pfx_senha_incorreta' });
    expect(r.checks.filter((c) => c.status === 'pulado')).toHaveLength(4);
    const lixo = await runDoctor({ pfx: new Uint8Array([1, 2, 3]), password: 'x', clock });
    expect(byId(lixo.checks, 'pfx')?.details).toEqual({ code: 'pfx_invalido' });
  });

  test('status só com NF-e e UF ou MDF-e', async () => {
    const r = await runDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      password: 'sinete-teste',
      clock,
      endpoint: { url: 'https://127.0.0.1:1/' },
      documento: 'nfse',
      status: true,
      timeoutMs: 2000,
    });
    expect(byId(r.checks, 'tls')?.details).toMatchObject({ code: 'conexao_recusada' });
    expect(byId(r.checks, 'status')?.status).toBe('pulado');
  });

  test('relógio por --relogio-url', async () => {
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: (req) =>
        new Response('', { headers: req.url.endsWith('/sem-date') ? {} : { date: new Date().toUTCString() } }),
    });
    try {
      const url = `http://127.0.0.1:${server.port}/`;
      const real = relogioManual(Date.now());
      const ok = await runDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        password: 'sinete-teste',
        clock: real,
        clockUrl: url,
        allowExpired: true,
      });
      expect(byId(ok.checks, 'relogio')?.status).toBe('ok');
      real.avancar(120_000);
      const adiantado = await runDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        password: 'sinete-teste',
        clock: real,
        clockUrl: url,
        allowExpired: true,
      });
      expect(byId(adiantado.checks, 'relogio')).toMatchObject({
        status: 'aviso',
        details: { skewSeconds: expect.any(Number) },
      });
      expect(byId(adiantado.checks, 'relogio')?.message).toContain('adiantado');
      real.avancar(-1_000_000);
      const atrasado = await runDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        password: 'sinete-teste',
        clock: real,
        clockUrl: url,
        allowExpired: true,
      });
      expect(byId(atrasado.checks, 'relogio')?.status).toBe('falha');
      expect(atrasado.ok).toBe(false);
      const semDate = await runDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        password: 'sinete-teste',
        clock: real,
        clockUrl: `${url}sem-date`,
        allowExpired: true,
      });
      expect(byId(semDate.checks, 'relogio')?.message).toContain('não mandou Date');
    } finally {
      server.stop(true);
    }
    const sem = await runDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      password: 'sinete-teste',
      clock,
      clockUrl: 'http://127.0.0.1:1/',
      timeoutMs: 2000,
    });
    expect(byId(sem.checks, 'relogio')?.status).toBe('aviso');
  });
});

describe.skipIf(!findOpenssl())('runDoctor contra servidor TLS local', () => {
  let pki: Pki;
  let tlsOpts: { cert: string; key: string };
  const stops: (() => void)[] = [];
  beforeAll(() => {
    pki = createPki();
    tlsOpts = { cert: readFileSync(pki.files.srv, 'utf8'), key: readFileSync(pki.files.srvKey, 'utf8') };
  });
  afterAll(() => {
    for (const s of stops) s();
    pki?.cleanup();
  });
  const serve = (fetch: (req: Request) => Response | Promise<Response>): string => {
    const s = Bun.serve({ hostname: '127.0.0.1', port: 0, tls: tlsOpts, fetch });
    stops.push(() => s.stop(true));
    return `https://127.0.0.1:${s.port}/ws`;
  };
  const soap = (cStat: string, date?: string): Response =>
    new Response(
      `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg><retConsStatServ><cStat>${cStat}</cStat><xMotivo>Servico em Operacao</xMotivo></retConsStatServ></nfeResultMsg></soap:Body></soap:Envelope>`,
      { headers: date ? { date } : {} },
    );
  const base = (): Pick<DoctorOptions, 'pfx' | 'password' | 'clock' | 'extraCaPem' | 'timeoutMs'> => ({
    pfx: pfx('ecnpj-aes.pfx'),
    password: 'sinete-teste',
    clock,
    extraCaPem: pki.caPem,
    timeoutMs: 5000,
  });

  test('só handshake por padrão: certificado de cliente carregado, sem requisição', async () => {
    let requests = 0;
    const url = serve(() => {
      requests++;
      return soap('107');
    });
    const r = await runDoctor({ ...base(), endpoint: { url }, uf: 'SP' });
    expect(byId(r.checks, 'tls')).toMatchObject({
      status: 'ok',
      details: { protocol: expect.stringMatching(/^TLSv1\.[23]$/) },
    });
    expect(byId(r.checks, 'tls')?.message).toContain('certificado de cliente carregado');
    expect(byId(r.checks, 'status')?.status).toBe('pulado');
    expect(requests).toBe(0);
  });

  test('endpoint IPv6 literal: sem colchetes no socket e sem SNI', async () => {
    const s = Bun.serve({ hostname: '::1', port: 0, tls: tlsOpts, fetch: () => soap('107') });
    stops.push(() => s.stop(true));
    const r = await runDoctor({ ...base(), endpoint: { url: `https://[::1]:${s.port}/ws` }, uf: 'SP' });
    expect(byId(r.checks, 'tls')?.status).toBe('ok');
  });

  test('--status: cStat 107 e relógio pelo Date da resposta', async () => {
    const url = serve((req) => {
      expect(req.headers.get('content-type')).toContain(
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
      );
      return soap('107', 'Fri, 25 Sep 2026 12:00:10 GMT');
    });
    const r = await runDoctor({ ...base(), endpoint: { url }, uf: 'SP', status: true });
    expect(byId(r.checks, 'status')).toMatchObject({ status: 'ok', details: { cStat: '107' } });
    expect(byId(r.checks, 'relogio')).toMatchObject({ status: 'ok', details: { skewSeconds: -10 } });
  });

  test('--status: cStat diferente de 107 é aviso; 403 é falha tipada; MDF-e monta a mensagem própria', async () => {
    const r = await runDoctor({ ...base(), endpoint: { url: serve(() => soap('108')) }, uf: 'SP', status: true });
    expect(byId(r.checks, 'status')?.status).toBe('aviso');
    const f = await runDoctor({
      ...base(),
      endpoint: { url: serve(() => new Response('', { status: 403 })) },
      uf: 'SP',
      status: true,
    });
    expect(byId(f.checks, 'status')).toMatchObject({
      status: 'falha',
      details: { code: 'certificado_ausente_ou_recusado' },
    });
    let body = '';
    const m = await runDoctor({
      ...base(),
      endpoint: {
        url: serve(async (req) => {
          body = await req.text();
          return new Response('erro', { status: 500 });
        }),
      },
      documento: 'mdfe',
      status: true,
    });
    expect(body).toContain('<consStatServMDFe versao="3.00"');
    expect(byId(m.checks, 'status')).toMatchObject({ status: 'aviso', message: 'HTTP 500 sem cStat' });
  });

  test('--cadeia entra também na identidade TLS: servidor que exige a intermediária aceita', async () => {
    const full = await abrirPfx(pfx('ecnpj-3des-cadeia.pfx'), { senha: 'sinete-teste', relogio: clock });
    const root = full.certificadosExtras.find((c) => c.selfIssued);
    const inter = full.certificadosExtras.find((c) => !c.selfIssued);
    if (!root || !inter) throw new Error('fixture sem cadeia');
    const rootFile = path.join(pki.dir, 'raiz-sintetica.pem');
    await Bun.write(rootFile, pemDoCertificado(root));
    // -attime fixa a conferência do certificado de cliente no relógio dos testes (a fixture vale em 2026).
    const args = [
      '-tls1_2',
      '-Verify',
      '2',
      '-verify_return_error',
      '-CAfile',
      rootFile,
      '-attime',
      '1790337600',
      '-naccept',
      '1',
    ];
    const semCadeia = await wwwServer(pki, args);
    const r1 = await runDoctor({ ...base(), pfx: pfx('ecnpj-legacy.pfx'), endpoint: { url: semCadeia.url } });
    await semCadeia.finished(500);
    expect(byId(r1.checks, 'tls')?.status).toBe('falha');
    const comCadeia = await wwwServer(pki, args);
    const r2 = await runDoctor({
      ...base(),
      pfx: pfx('ecnpj-legacy.pfx'),
      extraChainPem: pemDoCertificado(inter),
      endpoint: { url: comCadeia.url },
    });
    await comCadeia.finished(500);
    expect(byId(r2.checks, 'tls')?.status).toBe('ok');
  });

  test('servidor fora da confiança', async () => {
    const url = serve(() => soap('107'));
    const r = await runDoctor({ ...base(), extraCaPem: undefined as never, endpoint: { url } });
    expect(byId(r.checks, 'tls')).toMatchObject({
      status: 'falha',
      details: { code: 'cadeia_servidor_nao_confiavel' },
    });
  });
});

describe('utilitários', () => {
  test('resolução do endpoint pelos dados', () => {
    expect(resolveEndpoint({ pfx: new Uint8Array(), password: '', uf: 'SP' })?.url).toContain(
      'homologacao.nfe.fazenda.sp.gov.br',
    );
    expect(
      resolveEndpoint({ pfx: new Uint8Array(), password: '', documento: 'mdfe', ambiente: 'producao' })?.url,
    ).toContain('mdfe.svrs.rs.gov.br');
    expect(resolveEndpoint({ pfx: new Uint8Array(), password: '', documento: 'nfse' })?.url).toBe(
      'https://adn.producaorestrita.nfse.gov.br',
    );
    expect(resolveEndpoint({ pfx: new Uint8Array(), password: '' })).toBeUndefined();
  });

  test('Date HTTP sem o global Date', () => {
    for (const s of [
      'Sun, 06 Nov 1994 08:49:37 GMT',
      'Tue, 29 Feb 2028 23:59:59 GMT',
      'Thu, 01 Jan 1970 00:00:00 GMT',
    ]) {
      expect(parseHttpDate(s)).toBe(Date.parse(s));
    }
    expect(parseHttpDate('ontem')).toBeUndefined();
    expect(parseHttpDate('Sun, 06 Xyz 1994 08:49:37 GMT')).toBeUndefined();
    expect(parseHttpDate(undefined)).toBeUndefined();
  });

  test('--allow-expired não conta de novo a validade do titular na cadeia; emissor vencido ainda falha', () => {
    const cert = (cn: string) => ({ subject: { commonName: cn, texto: `CN=${cn}` } }) as never;
    const leaf = cert('folha');
    const inter = cert('AC');
    const root = cert('raiz');
    const base = {
      situacao: 'confiavel' as const,
      cadeia: [leaf, inter, root],
      ancora: root,
      emissorAusente: undefined,
    };
    expect(chainMessage({ ...base, vencidos: [leaf] }, false).status).toBe('falha');
    expect(chainMessage({ ...base, vencidos: [leaf] }, true).status).toBe('ok');
    const r = chainMessage({ ...base, vencidos: [leaf, inter] }, true);
    expect(r.status).toBe('falha');
    expect(r.message).toBe('elos vencidos: AC');
    for (const status of ['incompleta', 'raiz_desconhecida'] as const) {
      const c = chainMessage({ ...base, situacao: status, ancora: undefined, vencidos: [leaf, inter] }, true);
      expect(c.status).toBe('falha');
      expect(c.message.startsWith('elos vencidos: AC; ')).toBe(true);
    }
    expect(chainMessage({ ...base, situacao: 'incompleta', vencidos: [leaf] }, true).status).toBe('aviso');
  });

  test('extensão crítica não suportada na cadeia é falha e cita o OID', () => {
    const leaf = {
      subject: { commonName: 'folha', texto: 'CN=folha' },
      extensoesCriticasNaoSuportadas: ['2.5.29.30'],
    } as never;
    const r = chainMessage(
      {
        situacao: 'extensao_critica_nao_suportada',
        cadeia: [leaf],
        ancora: undefined,
        emissorAusente: undefined,
        vencidos: [],
      },
      false,
    );
    expect(r.status).toBe('falha');
    expect(r.message).toContain('2.5.29.30');
  });

  test('máscaras', () => {
    expect(maskCpfs('FULANO:11144477735, CN=X 111444777351')).toBe('FULANO:***.444.777-**, CN=X 111444777351');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskCpf('11144477735')).toBe('***.444.777-**');
  });

  test('relatório em texto', () => {
    const lines = formatReport({
      ok: false,
      checks: [
        { id: 'pfx', status: 'falha', message: 'x' },
        { id: 'tls', status: 'pulado', message: 'y' },
      ],
    });
    expect(lines).toEqual(['FALHA  pfx      x', 'pulado tls      y', 'doctor: há falhas']);
  });
});
