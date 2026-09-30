import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { abrirPfx, pemDoCertificado } from '@sinete/cert';
import { relogioFixo, relogioManual } from '@sinete/core';
import type { Pki } from '../../transport/test/lab/pki.ts';
import { createPki, findOpenssl } from '../../transport/test/lab/pki.ts';
import { wwwServer } from '../../transport/test/lab/servers.ts';
import { chainMessage, resolveEndpoint } from '../src/doctor.ts';
import type { DoctorOpcoes, VerificacaoDoDoctor } from '../src/index.ts';
import { formatarCnpj, formatarRelatorio, lerDataHttp, mascararCpf, mascararCpfs, rodarDoctor } from '../src/index.ts';

const fixtures = path.join(import.meta.dir, '../../cert/test/fixtures');
const pfx = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(fixtures, name)));
const clock = relogioFixo('2026-09-25T12:00:00Z');
const byId = (checks: readonly VerificacaoDoDoctor[], id: string): VerificacaoDoDoctor | undefined =>
  checks.find((c) => c.id === id);

describe('rodarDoctor sem rede', () => {
  test('e-CNPJ válido: titular, CPF mascarado e cadeia sintética', async () => {
    const r = await rodarDoctor({ pfx: pfx('ecnpj-3des-cadeia.pfx'), senha: 'sinete-teste', relogio: clock });
    expect(r.ok).toBe(true);
    const p = byId(r.verificacoes, 'pfx');
    expect(p?.situacao).toBe('ok');
    expect(p?.mensagem).toContain('e-CNPJ 11.222.333/0001-81');
    expect(p?.mensagem).toContain('***.444.777-**');
    expect(p?.mensagem).not.toContain('11144477735');
    expect(p?.detalhes).toMatchObject({ diasRestantes: 97, certificadosNoPfx: 3 });
    expect(byId(r.verificacoes, 'cadeia')?.situacao).toBe('aviso');
    expect(byId(r.verificacoes, 'relogio')?.situacao).toBe('pulado');
    expect(byId(r.verificacoes, 'tls')?.situacao).toBe('pulado');
    expect(r.verificacoes.map((c) => c.id)).toEqual(['pfx', 'cadeia', 'relogio', 'tls', 'status']);
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE|sinete-teste/);
  });

  test('PFX só com a folha: cadeia incompleta; com --cadeia, sobe até a raiz', async () => {
    const r = await rodarDoctor({ pfx: pfx('ecnpj-legacy.pfx'), senha: 'sinete-teste', relogio: clock });
    expect(byId(r.verificacoes, 'cadeia')).toMatchObject({ situacao: 'aviso' });
    expect(byId(r.verificacoes, 'cadeia')?.mensagem).toContain('AC SINTETICA SINETE v1');
    const full = await abrirPfx(pfx('ecnpj-3des-cadeia.pfx'), { senha: 'sinete-teste', relogio: clock });
    const extraChainPem = full.certificadosExtras.map((c) => pemDoCertificado(c)).join('');
    const r2 = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: clock,
      cadeiaAdicionalPem: extraChainPem,
    });
    expect(byId(r2.verificacoes, 'cadeia')?.detalhes).toMatchObject({ situacao: 'raiz_desconhecida' });
  });

  test('e-CPF: o CPF não aparece em lugar nenhum da saída', async () => {
    const r = await rodarDoctor({ pfx: pfx('ecpf-legacy-acentuada.pfx'), senha: 'Açaí#2026', relogio: clock });
    expect(byId(r.verificacoes, 'pfx')?.mensagem).toContain('e-CPF ***.444.777-**');
    expect(JSON.stringify(r)).not.toContain('11144477735');
    expect(byId(r.verificacoes, 'cadeia')?.detalhes).toMatchObject({
      cadeia: ['FULANO SINTETICO DE TESTE:***.444.777-**'],
    });
    const vencido = await rodarDoctor({
      pfx: pfx('ecpf-legacy-acentuada.pfx'),
      senha: 'Açaí#2026',
      relogio: relogioFixo('2041-01-01T00:00:00Z'),
      aceitarVencido: true,
    });
    expect(JSON.stringify(vencido)).not.toContain('11144477735');
  });

  test('vencido, perto de vencer e ainda não válido', async () => {
    const venc = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: relogioFixo('2027-02-01T00:00:00Z'),
    });
    expect(venc.ok).toBe(false);
    expect(byId(venc.verificacoes, 'pfx')).toMatchObject({ situacao: 'falha' });
    expect(byId(venc.verificacoes, 'pfx')?.mensagem).toContain('VENCIDO');
    const lax = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: relogioFixo('2027-02-01T00:00:00Z'),
      aceitarVencido: true,
    });
    expect(byId(lax.verificacoes, 'pfx')?.situacao).toBe('aviso');
    const perto = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: relogioFixo('2026-12-20T00:00:00Z'),
    });
    expect(byId(perto.verificacoes, 'pfx')?.situacao).toBe('aviso');
    for (const allowExpired of [false, true]) {
      const cedo = await rodarDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        senha: 'sinete-teste',
        relogio: relogioFixo('2025-06-01T00:00:00Z'),
        aceitarVencido: allowExpired,
      });
      expect(byId(cedo.verificacoes, 'pfx')?.situacao).toBe(allowExpired ? 'aviso' : 'falha');
      expect(byId(cedo.verificacoes, 'relogio')?.situacao).toBe('aviso');
    }
  });

  test('senha errada e arquivo inválido: falha tipada e o resto pulado', async () => {
    const r = await rodarDoctor({ pfx: pfx('ecnpj-legacy.pfx'), senha: 'errada', relogio: clock });
    expect(r.ok).toBe(false);
    expect(byId(r.verificacoes, 'pfx')?.detalhes).toEqual({ code: 'pfx_senha_incorreta' });
    expect(r.verificacoes.filter((c) => c.situacao === 'pulado')).toHaveLength(4);
    const lixo = await rodarDoctor({ pfx: new Uint8Array([1, 2, 3]), senha: 'x', relogio: clock });
    expect(byId(lixo.verificacoes, 'pfx')?.detalhes).toEqual({ code: 'pfx_invalido' });
  });

  test('status só com NF-e e UF ou MDF-e', async () => {
    const r = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: clock,
      endpoint: { url: 'https://127.0.0.1:1/' },
      documento: 'nfse',
      consultarStatus: true,
      timeoutMs: 2000,
    });
    expect(byId(r.verificacoes, 'tls')?.detalhes).toMatchObject({ code: 'conexao_recusada' });
    expect(byId(r.verificacoes, 'status')?.situacao).toBe('pulado');
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
      const ok = await rodarDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        senha: 'sinete-teste',
        relogio: real,
        urlDoRelogio: url,
        aceitarVencido: true,
      });
      expect(byId(ok.verificacoes, 'relogio')?.situacao).toBe('ok');
      real.avancar(120_000);
      const adiantado = await rodarDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        senha: 'sinete-teste',
        relogio: real,
        urlDoRelogio: url,
        aceitarVencido: true,
      });
      expect(byId(adiantado.verificacoes, 'relogio')).toMatchObject({
        situacao: 'aviso',
        detalhes: { desvioSegundos: expect.any(Number) },
      });
      expect(byId(adiantado.verificacoes, 'relogio')?.mensagem).toContain('adiantado');
      real.avancar(-1_000_000);
      const atrasado = await rodarDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        senha: 'sinete-teste',
        relogio: real,
        urlDoRelogio: url,
        aceitarVencido: true,
      });
      expect(byId(atrasado.verificacoes, 'relogio')?.situacao).toBe('falha');
      expect(atrasado.ok).toBe(false);
      const semDate = await rodarDoctor({
        pfx: pfx('ecnpj-legacy.pfx'),
        senha: 'sinete-teste',
        relogio: real,
        urlDoRelogio: `${url}sem-date`,
        aceitarVencido: true,
      });
      expect(byId(semDate.verificacoes, 'relogio')?.mensagem).toContain('não mandou Date');
    } finally {
      server.stop(true);
    }
    const sem = await rodarDoctor({
      pfx: pfx('ecnpj-legacy.pfx'),
      senha: 'sinete-teste',
      relogio: clock,
      urlDoRelogio: 'http://127.0.0.1:1/',
      timeoutMs: 2000,
    });
    expect(byId(sem.verificacoes, 'relogio')?.situacao).toBe('aviso');
  });
});

describe.skipIf(!findOpenssl())('rodarDoctor contra servidor TLS local', () => {
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
  const base = (): Pick<DoctorOpcoes, 'pfx' | 'senha' | 'relogio' | 'acsAdicionaisPem' | 'timeoutMs'> => ({
    pfx: pfx('ecnpj-aes.pfx'),
    senha: 'sinete-teste',
    relogio: clock,
    acsAdicionaisPem: pki.caPem,
    timeoutMs: 5000,
  });

  test('só handshake por padrão: certificado de cliente carregado, sem requisição', async () => {
    let requests = 0;
    const url = serve(() => {
      requests++;
      return soap('107');
    });
    const r = await rodarDoctor({ ...base(), endpoint: { url }, uf: 'SP' });
    expect(byId(r.verificacoes, 'tls')).toMatchObject({
      situacao: 'ok',
      detalhes: { protocolo: expect.stringMatching(/^TLSv1\.[23]$/) },
    });
    expect(byId(r.verificacoes, 'tls')?.mensagem).toContain('certificado de cliente carregado');
    expect(byId(r.verificacoes, 'status')?.situacao).toBe('pulado');
    expect(requests).toBe(0);
  });

  test('endpoint IPv6 literal: sem colchetes no socket e sem SNI', async () => {
    const s = Bun.serve({ hostname: '::1', port: 0, tls: tlsOpts, fetch: () => soap('107') });
    stops.push(() => s.stop(true));
    const r = await rodarDoctor({ ...base(), endpoint: { url: `https://[::1]:${s.port}/ws` }, uf: 'SP' });
    expect(byId(r.verificacoes, 'tls')?.situacao).toBe('ok');
  });

  test('--status: cStat 107 e relógio pelo Date da resposta', async () => {
    const url = serve((req) => {
      expect(req.headers.get('content-type')).toContain(
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
      );
      return soap('107', 'Fri, 25 Sep 2026 12:00:10 GMT');
    });
    const r = await rodarDoctor({ ...base(), endpoint: { url }, uf: 'SP', consultarStatus: true });
    expect(byId(r.verificacoes, 'status')).toMatchObject({ situacao: 'ok', detalhes: { cStat: '107' } });
    expect(byId(r.verificacoes, 'relogio')).toMatchObject({ situacao: 'ok', detalhes: { desvioSegundos: -10 } });
  });

  test('--status: cStat diferente de 107 é aviso; 403 é falha tipada; MDF-e monta a mensagem própria', async () => {
    const r = await rodarDoctor({
      ...base(),
      endpoint: { url: serve(() => soap('108')) },
      uf: 'SP',
      consultarStatus: true,
    });
    expect(byId(r.verificacoes, 'status')?.situacao).toBe('aviso');
    const f = await rodarDoctor({
      ...base(),
      endpoint: { url: serve(() => new Response('', { status: 403 })) },
      uf: 'SP',
      consultarStatus: true,
    });
    expect(byId(f.verificacoes, 'status')).toMatchObject({
      situacao: 'falha',
      detalhes: { code: 'certificado_ausente_ou_recusado' },
    });
    let body = '';
    const m = await rodarDoctor({
      ...base(),
      endpoint: {
        url: serve(async (req) => {
          body = await req.text();
          return new Response('erro', { status: 500 });
        }),
      },
      documento: 'mdfe',
      consultarStatus: true,
    });
    expect(body).toContain('<consStatServMDFe versao="3.00"');
    expect(byId(m.verificacoes, 'status')).toMatchObject({ situacao: 'aviso', mensagem: 'HTTP 500 sem cStat' });
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
    const r1 = await rodarDoctor({ ...base(), pfx: pfx('ecnpj-legacy.pfx'), endpoint: { url: semCadeia.url } });
    await semCadeia.finished(500);
    expect(byId(r1.verificacoes, 'tls')?.situacao).toBe('falha');
    const comCadeia = await wwwServer(pki, args);
    const r2 = await rodarDoctor({
      ...base(),
      pfx: pfx('ecnpj-legacy.pfx'),
      cadeiaAdicionalPem: pemDoCertificado(inter),
      endpoint: { url: comCadeia.url },
    });
    await comCadeia.finished(500);
    expect(byId(r2.verificacoes, 'tls')?.situacao).toBe('ok');
  });

  test('servidor fora da confiança', async () => {
    const url = serve(() => soap('107'));
    const r = await rodarDoctor({ ...base(), acsAdicionaisPem: undefined as never, endpoint: { url } });
    expect(byId(r.verificacoes, 'tls')).toMatchObject({
      situacao: 'falha',
      detalhes: { code: 'cadeia_servidor_nao_confiavel' },
    });
  });
});

describe('utilitários', () => {
  test('resolução do endpoint pelos dados', () => {
    expect(resolveEndpoint({ pfx: new Uint8Array(), senha: '', uf: 'SP' })?.url).toContain(
      'homologacao.nfe.fazenda.sp.gov.br',
    );
    expect(
      resolveEndpoint({ pfx: new Uint8Array(), senha: '', documento: 'mdfe', ambiente: 'producao' })?.url,
    ).toContain('mdfe.svrs.rs.gov.br');
    expect(resolveEndpoint({ pfx: new Uint8Array(), senha: '', documento: 'nfse' })?.url).toBe(
      'https://adn.producaorestrita.nfse.gov.br',
    );
    expect(resolveEndpoint({ pfx: new Uint8Array(), senha: '' })).toBeUndefined();
  });

  test('Date HTTP sem o global Date', () => {
    for (const s of [
      'Sun, 06 Nov 1994 08:49:37 GMT',
      'Tue, 29 Feb 2028 23:59:59 GMT',
      'Thu, 01 Jan 1970 00:00:00 GMT',
    ]) {
      expect(lerDataHttp(s)).toBe(Date.parse(s));
    }
    expect(lerDataHttp('ontem')).toBeUndefined();
    expect(lerDataHttp('Sun, 06 Xyz 1994 08:49:37 GMT')).toBeUndefined();
    expect(lerDataHttp(undefined)).toBeUndefined();
  });

  test('--aceitar-vencido não conta de novo a validade do titular na cadeia; emissor vencido ainda falha', () => {
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
    expect(chainMessage({ ...base, vencidos: [leaf] }, false).situacao).toBe('falha');
    expect(chainMessage({ ...base, vencidos: [leaf] }, true).situacao).toBe('ok');
    const r = chainMessage({ ...base, vencidos: [leaf, inter] }, true);
    expect(r.situacao).toBe('falha');
    expect(r.mensagem).toBe('elos vencidos: AC');
    for (const status of ['incompleta', 'raiz_desconhecida'] as const) {
      const c = chainMessage({ ...base, situacao: status, ancora: undefined, vencidos: [leaf, inter] }, true);
      expect(c.situacao).toBe('falha');
      expect(c.mensagem.startsWith('elos vencidos: AC; ')).toBe(true);
    }
    expect(chainMessage({ ...base, situacao: 'incompleta', vencidos: [leaf] }, true).situacao).toBe('aviso');
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
    expect(r.situacao).toBe('falha');
    expect(r.mensagem).toContain('2.5.29.30');
  });

  test('máscaras', () => {
    expect(mascararCpfs('FULANO:11144477735, CN=X 111444777351')).toBe('FULANO:***.444.777-**, CN=X 111444777351');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascararCpf('11144477735')).toBe('***.444.777-**');
  });

  test('relatório em texto', () => {
    const lines = formatarRelatorio({
      ok: false,
      verificacoes: [
        { id: 'pfx', situacao: 'falha', mensagem: 'x' },
        { id: 'tls', situacao: 'pulado', mensagem: 'y' },
      ],
    });
    expect(lines).toEqual(['FALHA  pfx      x', 'pulado tls      y', 'doctor: há falhas']);
  });
});
