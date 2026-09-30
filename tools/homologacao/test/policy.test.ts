import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPfx } from '@sinete/cert';
import { relogioFixo } from '@sinete/core';
import type { HostPolicy, PolicyRequest } from '@sinete/transport';
import {
  allEndpoints,
  ambienteHosts,
  createTransport,
  mdfeEndpoint,
  nfeEndpoint,
  nfseEndpoint,
  PolicyError,
  pemIdentity,
} from '@sinete/transport';
import { ledger } from '../src/ledger.ts';
import {
  EVENTOS_DF,
  HOSTS_HOMOLOGACAO,
  HOSTS_HOMOLOGACAO_DF,
  homologacaoDfPolicy,
  homologacaoPolicy,
  SERVICOS_DF,
} from '../src/policy.ts';

const req = (url: string, body?: string): PolicyRequest => ({
  url: new URL(url),
  method: body === undefined ? 'GET' : 'POST',
  body,
  endpoint: undefined,
});

async function recusa(p: HostPolicy, r: PolicyRequest): Promise<unknown> {
  try {
    await p.check(r);
  } catch (e) {
    return e;
  }
  return undefined;
}

const SP = 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx';
const status = (tpAmb: string): string =>
  `<nfeDadosMsg><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg>`;

describe('homologacaoPolicy', () => {
  const p = homologacaoPolicy();

  test('cada host da allowlist existe nos dados de homologação do transporte', () => {
    const hom = new Set(ambienteHosts('homologacao'));
    for (const h of HOSTS_HOMOLOGACAO.keys()) expect(hom.has(h)).toBe(true);
    expect(HOSTS_HOMOLOGACAO.size).toBe(15);
  });

  test('todo endpoint de NF-e e MDF-e de homologação passa, com tpAmb 2', async () => {
    const eps = allEndpoints('homologacao').filter(
      (e) => (e.documento === 'nfe' || e.documento === 'mdfe') && HOSTS_HOMOLOGACAO.has(e.host),
    );
    expect(eps.length).toBeGreaterThan(80);
    for (const e of eps) expect(await recusa(p, req(e.url, status('2')))).toBeUndefined();
    expect(await recusa(p, req(mdfeEndpoint({ ambiente: 'homologacao', servico: 'MDFeStatusServico' }).url))).toBe(
      undefined,
    );
  });

  test('nenhum endpoint de produção passa', async () => {
    const eps = allEndpoints('producao');
    expect(eps.length).toBeGreaterThan(90);
    for (const e of eps) expect(await recusa(p, req(e.url, status('2')))).toBeInstanceOf(PolicyError);
    for (const h of ['nfe.fazenda.sp.gov.br', 'www1.nfe.fazenda.gov.br', 'nfe.svrs.rs.gov.br', 'mdfe.svrs.rs.gov.br']) {
      expect(await recusa(p, req(`https://${h}/ws`))).toBeInstanceOf(PolicyError);
    }
  });

  test('NFC-e e NFS-e (mesmo de homologação ou produção restrita) ficam fora', async () => {
    const fora = allEndpoints('homologacao').filter((e) => !HOSTS_HOMOLOGACAO.has(e.host));
    expect(fora.some((e) => e.documento === 'nfce')).toBe(true);
    for (const e of fora) expect(await recusa(p, req(e.url))).toBeInstanceOf(PolicyError);
    const adn = nfseEndpoint({ ambiente: 'homologacao', api: 'adn' });
    expect(await recusa(p, req(adn.url))).toBeInstanceOf(PolicyError);
  });

  test('tpAmb diferente de 2 no corpo é recusado, inclusive com prefixo, atributo ou vazio', async () => {
    expect(await recusa(p, req(SP, status('1')))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SP, `${status('2')}<x:tpAmb a="b">1</x:tpAmb>`))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SP, '<tpAmb/>'))).toBeInstanceOf(PolicyError);
    // comentário não esconde nem simula tpAmb
    expect(await recusa(p, req(SP, `<!-- <tpAmb>2</tpAmb> -->${status('1')}`))).toBeInstanceOf(PolicyError);
    // ConsCad não tem tpAmb: passa pelo host
    expect(await recusa(p, req(SP.replace('nfestatusservico4', 'cadconsultacadastro4'), '<ConsCad/>'))).toBe(undefined);
  });

  test('porta diferente de 443 e sufixo enganoso são recusados', async () => {
    expect(await recusa(p, req(SP.replace('.gov.br/', '.gov.br:8443/')))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req('https://homologacao.nfe.fazenda.sp.gov.br.exemplo.com/ws'))).toBeInstanceOf(
      PolicyError,
    );
    expect(await recusa(p, req('https://xhomologacao.nfe.fazenda.sp.gov.br/ws'))).toBeInstanceOf(PolicyError);
  });

  test('o transporte real aplica a guarda antes do socket e sem usar a identidade', async () => {
    // e-CNPJ sintético dos testes do @sinete/cert; uma requisição que chegasse ao socket falharia no audit.
    const pfx = new Uint8Array(
      readFileSync(join(import.meta.dir, '../../../packages/cert/test/fixtures/ecnpj-aes.pfx')),
    );
    const ks = await openPfx(pfx, { password: 'sinete-teste', clock: relogioFixo('2026-09-25T12:00:00Z') });
    const eventos: unknown[] = [];
    const t = createTransport({
      identity: pemIdentity(ks),
      policy: homologacaoPolicy(),
      audit: (e) => eventos.push(e),
    });
    const prod = nfeEndpoint({ ambiente: 'producao', uf: 'SP', servico: 'NfeStatusServico' });
    await expect(t.send({ url: prod.url, endpoint: prod, body: status('1') })).rejects.toBeInstanceOf(PolicyError);
    const hom = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
    await expect(t.send({ url: hom.url, endpoint: hom, body: status('1') })).rejects.toBeInstanceOf(PolicyError);
    await expect(t.send({ url: hom.url.replace('https:', 'http:'), body: status('2') })).rejects.toThrow(/https/);
    expect(eventos).toHaveLength(0);
    await t.close();
  });
});

describe('homologacaoDfPolicy', () => {
  const p = homologacaoDfPolicy();
  const SVRS = nfeEndpoint({ ambiente: 'homologacao', uf: 'DF', servico: 'NfeStatusServico' }).url;
  const evento = (tp: string): string =>
    `<envEvento versao="1.00"><idLote>1</idLote><evento versao="1.00"><infEvento><cOrgao>53</cOrgao><tpAmb>2</tpAmb><tpEvento>${tp}</tpEvento></infEvento></evento></envEvento>`;

  test('só SVRS, SVC-AN e AN, todos nos dados de homologação e dentro da allowlist geral', () => {
    const hom = new Set(ambienteHosts('homologacao'));
    expect([...HOSTS_HOMOLOGACAO_DF.keys()].sort()).toEqual([
      'hom.sefazvirtual.fazenda.gov.br',
      'hom1.nfe.fazenda.gov.br',
      'nfe-homologacao.svrs.rs.gov.br',
    ]);
    for (const h of HOSTS_HOMOLOGACAO_DF.keys()) {
      expect(hom.has(h)).toBe(true);
      expect(HOSTS_HOMOLOGACAO.has(h)).toBe(true);
    }
  });

  test('os endpoints do DF que a rodada usa passam, com tpAmb 2', async () => {
    const df = (servico: Parameters<typeof nfeEndpoint>[0]['servico'], svc = false): string =>
      nfeEndpoint({ ambiente: 'homologacao', uf: 'DF', servico, ...(svc ? { contingencia: 'svc' as const } : {}) }).url;
    for (const s of ['NfeStatusServico', 'NFeAutorizacao', 'NfeConsultaProtocolo', 'RecepcaoEvento'] as const) {
      expect(await recusa(p, req(df(s), status('2')))).toBeUndefined();
      expect(await recusa(p, req(df(s, true), status('2')))).toBeUndefined();
    }
    expect(await recusa(p, req(df('NFeDistribuicaoDFe'), status('2')))).toBeUndefined();
    expect(await recusa(p, req(df('RecepcaoEvento'), evento('110110')))).toBeUndefined();
    expect(await recusa(p, req(df('RecepcaoEvento'), evento('110111')))).toBeUndefined();
    expect(EVENTOS_DF.size).toBe(2);
  });

  test('todo outro host de homologação e todo endpoint de produção são recusados', async () => {
    const fora = allEndpoints('homologacao').filter((e) => !HOSTS_HOMOLOGACAO_DF.has(e.host));
    expect(fora.length).toBeGreaterThan(100);
    for (const e of fora) expect(await recusa(p, req(e.url, status('2')))).toBeInstanceOf(PolicyError);
    for (const e of allEndpoints('producao')) {
      expect(await recusa(p, req(e.url, status('2')))).toBeInstanceOf(PolicyError);
    }
  });

  test('inutilização, cadastro e serviço fora da lista são recusados mesmo no host permitido', async () => {
    const naoUsados = allEndpoints('homologacao').filter(
      (e) => HOSTS_HOMOLOGACAO_DF.has(e.host) && !SERVICOS_DF.has(e.servico),
    );
    expect(naoUsados.some((e) => e.servico === 'NfeInutilizacao')).toBe(true);
    for (const e of naoUsados) expect(await recusa(p, req(e.url, status('2')))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SVRS.replace('NfeStatusServico4', 'Outro4'), status('2')))).toBeInstanceOf(PolicyError);
  });

  test('tpAmb 1, ausente ou escondido é recusado', async () => {
    expect(await recusa(p, req(SVRS, status('1')))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SVRS, '<consStatServ/>'))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SVRS, `<!-- <tpAmb>2</tpAmb> --><consStatServ/>`))).toBeInstanceOf(PolicyError);
    expect(await recusa(p, req(SVRS, `${status('2')}<a:tpAmb>1</a:tpAmb>`))).toBeInstanceOf(PolicyError);
  });

  test('evento fora de CC-e e cancelamento é recusado, inclusive manifestação e evento vazio', async () => {
    const ev = nfeEndpoint({ ambiente: 'homologacao', uf: 'DF', servico: 'RecepcaoEvento' }).url;
    for (const tp of ['210200', '210210', '110112', '110140', '']) {
      expect(await recusa(p, req(ev, evento(tp)))).toBeInstanceOf(PolicyError);
    }
    expect(await recusa(p, req(ev, `${evento('110110')}${evento('210200')}`))).toBeInstanceOf(PolicyError);
  });
});

describe('ledger', () => {
  test('uma linha por uso, sem quebra de linha nem tabulação vinda dos campos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sinete-ledger-'));
    try {
      const l = ledger(join(dir, 'sub/cert-usage.log'), () => new Date('2026-09-26T12:00:00Z'));
      l.registrar('homologacao.nfe.fazenda.sp.gov.br', 'NfeStatusServico', 'HTTP 200\nauthorized\tcStat=107');
      l.registrar('h', 's', 'ERRO politica_recusou');
      const linhas = readFileSync(l.path, 'utf8').trimEnd().split('\n');
      expect(linhas).toHaveLength(2);
      expect(linhas[0]?.split('\t')).toEqual([
        '2026-09-26T12:00:00.000Z',
        'bun',
        'homologacao.nfe.fazenda.sp.gov.br',
        'NfeStatusServico',
        'HTTP 200 authorized cStat=107',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
