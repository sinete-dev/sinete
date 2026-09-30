/**
 * Os módulos gerados: saída idêntica à do gerador (o CI confere), proveniência, raízes e os recursos que só aparecem
 * em alguns schemas (xs:any ligado, xs:any skip, anyAttribute, sequência repetível zipada).
 */
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { $ } from 'bun';
import type { DescricaoModuloSchema, ElementoRaiz } from '../src/index.ts';
import { decodificarXml, serializar, serializarRaiz, validarRaiz } from '../src/index.ts';
import * as mdfe from '../src/mdfe/3.00b.ts';
import * as mdfeEventos from '../src/mdfe/eventos/3.00b.ts';
import * as mdfeServicos from '../src/mdfe/servicos/3.00b.ts';
import * as cadastro from '../src/nfe/consulta-cadastro/PL_010d.ts';
import * as protocolo from '../src/nfe/consulta-protocolo/PL_010d.ts';
import * as dist from '../src/nfe/dist-dfe/PL_NFeDistDFe_104.ts';
import * as canc from '../src/nfe/evento-cancelamento/PL_010d.ts';
import * as cancSubst from '../src/nfe/evento-cancelamento-substituicao/PL_010d.ts';
import * as cce from '../src/nfe/evento-cce/PL_010d.ts';
import * as ciencia from '../src/nfe/evento-ciencia-operacao/PL_010d.ts';
import * as confirmacao from '../src/nfe/evento-confirmacao-operacao/PL_010d.ts';
import * as desconhecimento from '../src/nfe/evento-desconhecimento-operacao/PL_010d.ts';
import * as naoRealizada from '../src/nfe/evento-operacao-nao-realizada/PL_010d.ts';
import * as inut from '../src/nfe/inutilizacao/PL_010d.ts';
import * as nfe010e from '../src/nfe/PL_010e.ts';
import * as nfe010f from '../src/nfe/PL_010f.ts';
import * as status from '../src/nfe/status-servico/PL_009q.ts';
import * as nfse0209 from '../src/nfse/1.01-20260209.ts';
import * as nfse0727 from '../src/nfse/1.01-20260727.ts';

const repo = path.resolve(import.meta.dir, '../../..');
const NFE = 'http://www.portalfiscal.inf.br/nfe';
const MDFE = 'http://www.portalfiscal.inf.br/mdfe';

const MODULES: Record<string, { schema: DescricaoModuloSchema }> = {
  'nfe/PL_010f': nfe010f,
  'nfe/PL_010e': nfe010e,
  'mdfe/3.00b': mdfe,
  'mdfe/eventos/3.00b': mdfeEventos,
  'mdfe/servicos/3.00b': mdfeServicos,
  'nfe/evento-cancelamento/PL_010d': canc,
  'nfe/evento-cce/PL_010d': cce,
  'nfe/evento-cancelamento-substituicao/PL_010d': cancSubst,
  'nfe/evento-confirmacao-operacao/PL_010d': confirmacao,
  'nfe/evento-ciencia-operacao/PL_010d': ciencia,
  'nfe/evento-desconhecimento-operacao/PL_010d': desconhecimento,
  'nfe/evento-operacao-nao-realizada/PL_010d': naoRealizada,
  'nfe/inutilizacao/PL_010d': inut,
  'nfe/consulta-protocolo/PL_010d': protocolo,
  'nfe/consulta-cadastro/PL_010d': cadastro,
  'nfe/status-servico/PL_009q': status,
  'nfe/dist-dfe/PL_NFeDistDFe_104': dist,
  'nfse/1.01-20260209': nfse0209,
  'nfse/1.01-20260727': nfse0727,
};

describe('módulos gerados', () => {
  test('saída versionada é idêntica à do gerador e os XSD batem com o sha256 do SOURCE.md', async () => {
    const r = await $`bun tools/xsd-codegen/src/cli.ts --check`.cwd(repo).nothrow().quiet();
    expect(r.stderr.toString()).toBe('');
    expect(r.exitCode).toBe(0);
  });

  test('todo subpath exportado tem módulo com proveniência', async () => {
    const pkg = (await Bun.file(path.join(import.meta.dir, '../package.json')).json()) as {
      exports: Record<string, unknown>;
    };
    const subpaths = Object.keys(pkg.exports)
      .filter((k) => k !== '.' && k !== './package.json')
      .map((k) => k.slice(2));
    expect(subpaths.sort()).toEqual(Object.keys(MODULES).sort());
    for (const [subpath, m] of Object.entries(MODULES)) {
      expect(m.schema.subpath).toBe(subpath);
      expect(m.schema.fontes.length).toBeGreaterThan(0);
      for (const f of m.schema.fontes) {
        expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(f.url.startsWith('https://')).toBe(true);
      }
    }
  });

  test('status do serviço: pedido serializado e validado', () => {
    const xml = serializarRaiz(status.consStatServElement, {
      versao: '4.00',
      tpAmb: '2',
      cUF: '35',
      xServ: 'STATUS',
    });
    expect(xml).toBe(
      `<consStatServ xmlns="${NFE}" versao="4.00"><tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ>`,
    );
    expect(validarRaiz(status.consStatServElement, xml)).toEqual([]);
  });

  test('consulta cadastro e inutilização: pedidos válidos', () => {
    const cons = serializarRaiz(cadastro.ConsCadElement, {
      versao: '2.00',
      infCons: { xServ: 'CONS-CAD', UF: 'SP', CNPJ: '00000000000000' },
    });
    expect(validarRaiz(cadastro.ConsCadElement, cons)).toEqual([]);
    // Sem Signature (o tipo exige): é o estado antes de assinar, então o cast é deliberado.
    const i = serializarRaiz(inut.inutNFeElement, {
      versao: '4.00',
      infInut: {
        Id: 'ID35260000000000000055001000000001000000001',
        tpAmb: '2',
        xServ: 'INUTILIZAR',
        cUF: '35',
        ano: '26',
        CNPJ: '00000000000000',
        mod: '55',
        serie: '1',
        nNFIni: '1',
        nNFFin: '1',
        xJust: 'JUSTIFICATIVA SINTETICA DE TESTE',
      },
    } as Omit<inut.TInutNFe, 'Signature'> as inut.TInutNFe);
    expect(validarRaiz(inut.inutNFeElement, i).map((x) => x.code)).toEqual(['modelo_de_conteudo']);
  });

  test('retConsSitNFe: detEvento xs:any fica bruto em $any e anyAttribute em $attrs, e volta igual', () => {
    const det =
      '<descEvento>Cancelamento</descEvento><nProt>135260000000001</nProt><xJust>JUSTIFICATIVA SINTETICA</xJust>';
    const xml = `<retConsSitNFe xmlns="${NFE}" versao="4.00"><tpAmb>2</tpAmb><verAplic>SP</verAplic><cStat>101</cStat><xMotivo>Cancelamento homologado</xMotivo><cUF>35</cUF><dhRecbto>2026-09-25T10:00:00-03:00</dhRecbto><chNFe>35260900000000000000550010000000011000000011</chNFe><procEventoNFe versao="1.00"><evento versao="1.00"><infEvento Id="ID1101113526090000000000000055001000000001100000001101"><cOrgao>35</cOrgao><tpAmb>2</tpAmb><CNPJ>00000000000000</CNPJ><chNFe>35260900000000000000550010000000011000000011</chNFe><dhEvento>2026-09-25T10:00:00-03:00</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00" extra="x">${det}</detEvento></infEvento></evento></procEventoNFe></retConsSitNFe>`;
    const d = decodificarXml(protocolo.retConsSitNFeElement, xml);
    expect(d.ocorrencias).toEqual([]);
    const detEvento = d.valor.procEventoNFe?.[0]?.evento.infEvento.detEvento;
    expect(detEvento?.$any).toEqual([
      '<descEvento>Cancelamento</descEvento>',
      '<nProt>135260000000001</nProt>',
      '<xJust>JUSTIFICATIVA SINTETICA</xJust>',
    ]);
    expect(detEvento?.$attrs).toEqual({ versao: '1.00', extra: 'x' });
    const back = serializar(protocolo.TEvento_infEvento_detEvento, 'detEvento', detEvento ?? {}, NFE);
    expect(back).toBe(`<detEvento extra="x" versao="1.00">${det}</detEvento>`);
  });

  test('evento de cancelamento: detEvento tipado pelo e110111', () => {
    // Evento ainda sem Signature: cast deliberado do estado antes de assinar.
    const env = {
      versao: '1.00',
      idLote: '1',
      evento: [
        {
          versao: '1.00',
          infEvento: {
            Id: 'ID1101113526090000000000000055001000000001100000001101',
            cOrgao: '35',
            tpAmb: '2',
            CNPJ: '00000000000000',
            chNFe: '35260900000000000000550010000000011000000011',
            dhEvento: '2026-09-25T10:00:00-03:00',
            tpEvento: '110111',
            nSeqEvento: '1',
            verEvento: '1.00',
            detEvento: {
              versao: '1.00',
              descEvento: 'Cancelamento',
              nProt: '135260000000001',
              xJust: 'JUSTIFICATIVA SINTETICA',
            },
          },
        },
      ],
    } as unknown as canc.TEnvEvento;
    const xml = serializarRaiz(canc.envEventoElement, env);
    // Sem Signature o evento está incompleto; o detEvento em si está conforme o e110111.
    expect(validarRaiz(canc.envEventoElement, xml).map((i) => i.caminho)).toEqual(['/envEvento/evento']);
    const bad = xml.replace('<descEvento>Cancelamento</descEvento>', '<descEvento>Outro</descEvento>');
    expect(validarRaiz(canc.envEventoElement, bad).map((i) => `${i.code} ${i.caminho}`)).toContain(
      'enumeracao /envEvento/evento/infEvento/detEvento/descEvento',
    );
    expect(validarRaiz(cce.envEventoElement, xml).map((i) => i.code)).toContain('modelo_de_conteudo');
  });

  test('sequência repetível do infProt (cMsg, xMsg) serializa zipada por índice', () => {
    const inf: nfe010f.TProtNFe_infProt = {
      tpAmb: '2',
      verAplic: 'SP',
      chNFe: '35260900000000000000550010000000011000000011',
      dhRecbto: '2026-09-25T10:00:00-03:00',
      cStat: '100',
      xMotivo: 'Autorizado',
      cMsg: ['1', '2'],
      xMsg: ['um', 'dois'],
    };
    const xml = serializar(nfe010f.TProtNFe_infProt, 'infProt', inf, NFE);
    expect(xml).toBe(
      '<infProt><tpAmb>2</tpAmb><verAplic>SP</verAplic><chNFe>35260900000000000000550010000000011000000011</chNFe><dhRecbto>2026-09-25T10:00:00-03:00</dhRecbto><cStat>100</cStat><xMotivo>Autorizado</xMotivo><cMsg>1</cMsg><xMsg>um</xMsg><cMsg>2</cMsg><xMsg>dois</xMsg></infProt>',
    );
  });

  test('MDF-e: infModal ligado a rodo pela tabela de xs:any', () => {
    const xml = `<rodo xmlns="${MDFE}"><infANTT><RNTRC>12345678</RNTRC></infANTT><veicTracao><placa>ABC1D23</placa><tara>1000</tara><condutor><xNome>CONDUTOR SINTETICO</xNome><CPF>00000000000</CPF></condutor><tpRod>01</tpRod><tpCar>02</tpCar><UF>SP</UF></veicTracao></rodo>`;
    const root = { nome: 'rodo', ns: MDFE, tipo: mdfe.rodo } as ElementoRaiz<unknown>;
    expect(validarRaiz(root, xml)).toEqual([]);
    expect(validarRaiz(root, xml.replace('ABC1D23', 'ZZZZZZZZZ')).map((i) => i.code)).toEqual(['padrao']);
    expect(decodificarXml(root, xml).ocorrencias).toEqual([]);
  });

  test('MDF-e: retMDFe com o tpAmb sem tipo no XSD aceito como texto', () => {
    const xml = `<retMDFe xmlns="${MDFE}" versao="3.00"><tpAmb>2</tpAmb><cUF>51</cUF><verAplic>SVRS</verAplic><cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo></retMDFe>`;
    expect(validarRaiz(mdfe.retMDFeElement, xml)).toEqual([]);
    expect(decodificarXml(mdfe.retMDFeElement, xml).valor.tpAmb).toBe('2');
    expect(validarRaiz(mdfe.retMDFeElement, xml.replace('<tpAmb>2</tpAmb>', '<tpAmb><x/></tpAmb>')).length).toBe(1);
  });

  test('MDF-e: detEvento ligado aos schemas específicos dos eventos', () => {
    const ch = '51260900000000000000589200000000110000000110';
    const inf = `<infEvento Id="ID110112${ch}01"><cOrgao>51</cOrgao><tpAmb>2</tpAmb><CPF>00000000000</CPF><chMDFe>51260900000000000000589200000000110000000110</chMDFe><dhEvento>2026-09-26T10:00:00-04:00</dhEvento><tpEvento>110112</tpEvento><nSeqEvento>1</nSeqEvento><detEvento versaoEvento="3.00"><evEncMDFe><descEvento>Encerramento</descEvento><nProt>951260000000001</nProt><dtEnc>2026-09-26</dtEnc><cUF>51</cUF><cMun>5103403</cMun></evEncMDFe></detEvento></infEvento>`;
    const el = { nome: 'infEvento', ns: MDFE, tipo: mdfeEventos.TEvento_infEvento } as ElementoRaiz<unknown>;
    const doc = `<infEvento xmlns="${MDFE}"${inf.slice('<infEvento'.length)}`;
    expect(validarRaiz(el, doc)).toEqual([]);
    const d = decodificarXml(el, doc).valor as mdfeEventos.TEvento_infEvento;
    expect(d.detEvento.evEncMDFe?.dtEnc).toBe('2026-09-26');
    const bad = doc.replace('<descEvento>Encerramento</descEvento>', '<descEvento>Outro</descEvento>');
    expect(validarRaiz(el, bad).map((i) => i.code)).toContain('enumeracao');
  });

  test('MDF-e: consultas de status, situação e não encerrados', () => {
    const cons = serializarRaiz(mdfeServicos.consMDFeNaoEncElement, {
      versao: '3.00',
      tpAmb: '2',
      xServ: 'CONSULTAR NÃO ENCERRADOS',
      CPF: '00000000000',
    });
    expect(validarRaiz(mdfeServicos.consMDFeNaoEncElement, cons)).toEqual([]);
    const ret = `<retConsMDFeNaoEnc xmlns="${MDFE}" versao="3.00"><tpAmb>2</tpAmb><verAplic>SVRS</verAplic><cStat>111</cStat><xMotivo>Consulta nao encerrados localizou MDF-e nessa situacao</xMotivo><cUF>51</cUF><infMDFe><chMDFe>51260900000000000000589200000000110000000110</chMDFe><nProt>951260000000001</nProt></infMDFe></retConsMDFeNaoEnc>`;
    expect(validarRaiz(mdfeServicos.retConsMDFeNaoEncElement, ret)).toEqual([]);
    const sit = serializarRaiz(mdfeServicos.consSitMDFeElement, {
      versao: '3.00',
      tpAmb: '2',
      xServ: 'CONSULTAR',
      chMDFe: '51260900000000000000589200000000110000000110',
    });
    expect(validarRaiz(mdfeServicos.consSitMDFeElement, sit)).toEqual([]);
    const st = serializarRaiz(mdfeServicos.consStatServMDFeElement, { versao: '3.00', tpAmb: '2', xServ: 'STATUS' });
    expect(validarRaiz(mdfeServicos.consStatServMDFeElement, st)).toEqual([]);
  });

  test('distribuição DF-e: lote com docZip e atributos de simpleContent', () => {
    const xml = `<retDistDFeInt xmlns="${NFE}" versao="1.01"><tpAmb>2</tpAmb><verAplic>AN</verAplic><cStat>138</cStat><xMotivo>Documento localizado</xMotivo><dhResp>2026-09-25T10:00:00-03:00</dhResp><ultNSU>000000000000001</ultNSU><maxNSU>000000000000001</maxNSU><loteDistDFeInt><docZip NSU="000000000000001" schema="resNFe_v1.01.xsd">H4sIAAAAAAAAAwMAAAAAAAAAAAA=</docZip></loteDistDFeInt></retDistDFeInt>`;
    expect(validarRaiz(dist.retDistDFeIntElement, xml)).toEqual([]);
    const d = decodificarXml(dist.retDistDFeIntElement, xml);
    expect(d.valor.loteDistDFeInt?.docZip[0]).toEqual({
      NSU: '000000000000001',
      schema: 'resNFe_v1.01.xsd',
      $text: 'H4sIAAAAAAAAAwMAAAAAAAAAAAA=',
    });
    expect(serializarRaiz(dist.retDistDFeIntElement, d.valor)).toBe(xml);
  });
});
