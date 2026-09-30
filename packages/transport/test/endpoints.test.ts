import { describe, expect, test } from 'bun:test';
import { AMBIENTES, UFS } from '@sinete/core';
import endpointsData from '../src/data/endpoints.json' with { type: 'json' };
import {
  CAPACIDADES_DENO,
  DADOS_DE_ENDPOINTS,
  hostsDoAmbiente,
  mdfeEndpoint,
  motivosNaoSuportado,
  nfceAutorizadorDaUf,
  nfceEndpoint,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
  nfseEndpoint,
  perfilTlsDoHost,
  perfisTls,
  todosOsEndpoints,
  urlsConsultaNfce,
} from '../src/index.ts';

describe('dados de endpoints', () => {
  test('versão e fontes oficiais', () => {
    expect(DADOS_DE_ENDPOINTS.versaoDosEndpoints).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(DADOS_DE_ENDPOINTS.versaoDosPerfisTls).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(endpointsData.nfe.producao.fonte).toStartWith('https://www.nfe.fazenda.gov.br/');
    expect(endpointsData.nfe.homologacao.fonte).toStartWith('https://hom.nfe.fazenda.gov.br/');
    expect(endpointsData.mdfe.fonte).toBe('https://dfe-portal.svrs.rs.gov.br/Mdfe/Servicos');
    expect(endpointsData.nfse.fonte).toStartWith('https://www.gov.br/nfse/');
  });

  test('toda URL é https e todo host de NF-e, MDF-e e NFS-e tem perfil TLS medido', () => {
    for (const amb of AMBIENTES) {
      for (const e of todosOsEndpoints(amb)) {
        expect(e.url).toStartWith('https://');
        // A sondagem do ADR 0004 não cobriu os hosts só de NFC-e: sem perfil, o transporte não recusa por capacidade.
        if (e.documento !== 'nfce') expect(e.tls?.host).toBe(e.host);
        else if (e.tls !== undefined) expect(e.tls.host).toBe(e.host);
      }
    }
    expect(perfisTls()).toHaveLength(35);
  });

  test('toda UF tem autorizador e contingência nos dois ambientes', () => {
    for (const amb of AMBIENTES) {
      for (const { sigla } of UFS) {
        const e = nfeEndpoint({ ambiente: amb, uf: sigla, servico: 'NfeStatusServico' });
        expect(e.url).toStartWith('https://');
        expect(['SVC-AN', 'SVC-RS']).toContain(nfeContingenciaDaUf(sigla, amb));
      }
    }
  });
});

describe('resolução de NF-e', () => {
  test('UF com sefaz própria, SVRS e SVAN', () => {
    expect(nfeAutorizadorDaUf('SP', 'homologacao')).toBe('SP');
    expect(nfeAutorizadorDaUf('SC', 'producao')).toBe('SVRS');
    expect(nfeAutorizadorDaUf('MA', 'producao')).toBe('SVAN');
    const sp = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao' });
    expect(sp).toMatchObject({
      documento: 'nfe',
      autorizador: 'SP',
      host: 'homologacao.nfe.fazenda.sp.gov.br',
      versao: '4.00',
    });
    expect(sp.tls?.certificadoDoCliente).toBe('renegociacao');
  });

  test('contingência é por ambiente (PI: SVC-AN em produção, SVC-RS em homologação)', () => {
    expect(nfeContingenciaDaUf('PI', 'producao')).toBe('SVC-AN');
    expect(nfeContingenciaDaUf('PI', 'homologacao')).toBe('SVC-RS');
    const e = nfeEndpoint({ ambiente: 'producao', uf: 'BA', servico: 'NFeAutorizacao', contingencia: 'svc' });
    expect(e.autorizador).toBe('SVC-RS');
  });

  test('serviços do AN e autorizador explícito', () => {
    expect(nfeEndpoint({ ambiente: 'producao', servico: 'NFeDistribuicaoDFe' }).host).toBe('www1.nfe.fazenda.gov.br');
    const ev = nfeEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', autorizador: 'AN' });
    expect(ev.host).toBe('hom1.nfe.fazenda.gov.br');
    expect(
      nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao', autorizador: 'SVRS' }).autorizador,
    ).toBe('SVRS');
  });

  test('consulta cadastro de toda UF da SVRS vai para a SVRS, listada ou não na linha de consulta cadastro', () => {
    for (const uf of ['SC', 'DF', 'CE'] as const) {
      expect(nfeEndpoint({ ambiente: 'producao', uf, servico: 'NfeConsultaCadastro' }).host).toBe('cad.svrs.rs.gov.br');
    }
  });

  test('a SVC não oferece a inutilização, nem a SVC-AN, que o portal lista (NT 2013.007 v1.03, item 04.5)', () => {
    for (const ambiente of ['producao', 'homologacao'] as const) {
      for (const uf of ['SP', 'PR'] as const) {
        expect(() => nfeEndpoint({ ambiente, uf, servico: 'NfeInutilizacao', contingencia: 'svc' })).toThrow(
          expect.objectContaining({
            code: 'servico_nao_oferecido',
            detalhes: expect.objectContaining({
              servico: 'NfeInutilizacao',
              fonte: endpointsData.nfe.svcSemServicos.fonte,
            }),
          }),
        );
        // No ambiente normal da UF, a inutilização continua.
        expect(nfeEndpoint({ ambiente, uf, servico: 'NfeInutilizacao' }).url).toContain('nutiliza');
      }
      // A SVAN (MA), no mesmo host da SVC-AN, segue com a inutilização.
      expect(nfeEndpoint({ ambiente, uf: 'MA', servico: 'NfeInutilizacao' }).host).toContain(
        'sefazvirtual.fazenda.gov.br',
      );
    }
  });

  test('erros de configuração', () => {
    expect(() => nfeEndpoint({ ambiente: 'producao', servico: 'NfeStatusServico' })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
    expect(() => nfeEndpoint({ ambiente: 'producao', uf: 'XX' as never, servico: 'NfeStatusServico' })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
    expect(() => nfeEndpoint({ ambiente: 'producao', servico: 'NfeConsultaCadastro', autorizador: 'SVAN' })).toThrow(
      expect.objectContaining({
        code: 'servico_nao_oferecido',
        detalhes: expect.objectContaining({ autorizador: 'SVAN', servico: 'NfeConsultaCadastro' }),
      }),
    );
    expect(() => nfeAutorizadorDaUf('EX' as never, 'producao')).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
    expect(() => nfeContingenciaDaUf('EX' as never, 'producao')).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
  });
});

describe('MDF-e e NFS-e', () => {
  test('MDF-e na SVRS', () => {
    const e = mdfeEndpoint({ ambiente: 'homologacao', servico: 'MDFeStatusServico' });
    expect(e).toMatchObject({
      documento: 'mdfe',
      autorizador: 'SVRS',
      host: 'mdfe-homologacao.svrs.rs.gov.br',
      versao: '3.00',
    });
    expect(() => mdfeEndpoint({ ambiente: 'producao', servico: 'Nada' as never })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
  });

  test('NFS-e Nacional: homologação é a produção restrita', () => {
    expect(nfseEndpoint({ ambiente: 'homologacao', api: 'sefin' }).url).toBe(
      'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional',
    );
    expect(nfseEndpoint({ ambiente: 'producao', api: 'adn' }).host).toBe('adn.nfse.gov.br');
    expect(() => nfseEndpoint({ ambiente: 'producao', api: 'nada' as never })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
  });

  test('hosts de homologação não incluem produção', () => {
    const hosts = hostsDoAmbiente('homologacao');
    expect(hosts).toContain('hom1.nfe.fazenda.gov.br');
    expect(hosts).toContain('sefin.producaorestrita.nfse.gov.br');
    expect(hosts).not.toContain('nfe.fazenda.sp.gov.br');
    expect(hosts).not.toContain('sefin.nfse.gov.br');
  });
});

describe('capacidade do Deno pelos perfis (ADR 0004, decisão 4)', () => {
  test('hosts recusados no Deno são exatamente os que renegociam ou só têm CBC/DHE', () => {
    const blocked = perfisTls()
      .filter((p) => motivosNaoSuportado(p, CAPACIDADES_DENO).length > 0)
      .map((p) => p.host)
      .sort();
    expect(blocked).toEqual(
      [
        'nfe.sefaz.ba.gov.br',
        'nfe.sefaz.go.gov.br',
        'nfe.sefa.pr.gov.br',
        'nfe.fazenda.sp.gov.br',
        'www.sefazvirtual.fazenda.gov.br',
        'www1.nfe.fazenda.gov.br',
        'www.nfe.fazenda.gov.br',
        'hnfe.sefaz.ba.gov.br',
        'homologacao.sefaz.mt.gov.br',
        'homologacao.nfe.sefa.pr.gov.br',
        'homologacao.nfe.fazenda.sp.gov.br',
        'hom.sefazvirtual.fazenda.gov.br',
        'hom1.nfe.fazenda.gov.br',
        'sefin.producaorestrita.nfse.gov.br',
        'sefin.nfse.gov.br',
      ].sort(),
    );
    expect(motivosNaoSuportado(undefined, CAPACIDADES_DENO)).toEqual([]);
    expect(motivosNaoSuportado(perfilTlsDoHost('nfe.sefaz.go.gov.br'), CAPACIDADES_DENO)[0]).toContain('DHE');
    expect(perfilTlsDoHost('NFE.SVRS.RS.GOV.BR')?.ecdheAead).toBe(true);
  });
});

describe('resolução de NFC-e', () => {
  test('fontes oficiais e data da coleta', () => {
    expect(endpointsData.nfce.fonte).toBe('https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos');
    expect(endpointsData.nfce.fontes.MG).toStartWith('https://portalsped.fazenda.mg.gov.br/');
    expect(endpointsData.nfce.coletadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('toda UF tem autorizador de NFC-e com autorização, recibo, consulta, status, eventos e inutilização', () => {
    for (const amb of AMBIENTES) {
      for (const { sigla } of UFS) {
        for (const servico of [
          'NFeAutorizacao',
          'NFeRetAutorizacao',
          'NfeConsultaProtocolo',
          'NfeStatusServico',
          'RecepcaoEvento',
          'NfeInutilizacao',
        ] as const) {
          const e = nfceEndpoint({ ambiente: amb, uf: sigla, servico });
          expect(e.documento).toBe('nfce');
          expect(e.url).toStartWith('https://');
          expect(e.autorizador).toBe(nfceAutorizadorDaUf(sigla, amb));
        }
      }
    }
  });

  test('host próprio da NFC-e em SP, MG e na SVRS; SVRS para UF sem autorizador próprio', () => {
    const sp = nfceEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao' });
    expect(sp).toMatchObject({ documento: 'nfce', autorizador: 'SP', host: 'homologacao.nfce.fazenda.sp.gov.br' });
    expect(sp.host).not.toBe(nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao' }).host);
    const mg = nfceEndpoint({ ambiente: 'producao', uf: 'MG', servico: 'RecepcaoEvento' });
    expect(mg).toMatchObject({ autorizador: 'MG', host: 'nfce.fazenda.mg.gov.br' });
    expect(mg.fonte).toBe(endpointsData.nfce.fontes.MG);
    expect(nfceAutorizadorDaUf('BA', 'producao')).toBe('SVRS');
    expect(nfceAutorizadorDaUf('CE', 'homologacao')).toBe('SVRS');
    expect(nfceEndpoint({ ambiente: 'producao', uf: 'SC', servico: 'NfeStatusServico' }).host).toBe(
      'nfce.svrs.rs.gov.br',
    );
    expect(nfceEndpoint({ ambiente: 'producao', autorizador: 'RS', servico: 'NfeStatusServico' }).fonte).toBe(
      endpointsData.nfce.fonte,
    );
  });

  test('serviço fora da tabela é ErroServicoNaoOferecido; UF ausente ou inválida é ErroDeConfiguracao', () => {
    expect(() => nfceEndpoint({ ambiente: 'producao', uf: 'SP', servico: 'NFeDistribuicaoDFe' })).toThrow(
      'SP não oferece NFeDistribuicaoDFe da NFC-e em producao',
    );
    expect(() => nfceEndpoint({ ambiente: 'producao', uf: 'SP', servico: 'NFeDistribuicaoDFe' })).toThrow(
      expect.objectContaining({ code: 'servico_nao_oferecido', detalhes: expect.objectContaining({ uf: 'SP' }) }),
    );
    expect(() => nfceEndpoint({ ambiente: 'producao', servico: 'NfeStatusServico' })).toThrow('informe a UF');
    expect(() => nfceAutorizadorDaUf('XX' as never, 'producao')).toThrow('UF inválida');
  });

  test('QR Code e consulta por chave só onde a tabela de web services os publica', () => {
    expect(urlsConsultaNfce('MG', 'homologacao')).toEqual({
      qrCode: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
      consultaChave: 'https://hportalsped.fazenda.mg.gov.br/portalnfce',
      fonte: endpointsData.nfce.fonteDasConsultas,
    });
    expect(urlsConsultaNfce('SP', 'producao')).toBeUndefined();
  });

  test('hosts da NFC-e entram na allowlist do ambiente', () => {
    expect(hostsDoAmbiente('homologacao')).toContain('homologacao.nfce.fazenda.sp.gov.br');
    expect(hostsDoAmbiente('producao')).toContain('nfce.svrs.rs.gov.br');
  });
});
