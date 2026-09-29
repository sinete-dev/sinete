/**
 * As páginas vigiadas. Cada uma é a lista oficial de onde saem os dados versionados do sinete: esquemas XSD
 * (`tools/xsd-codegen/xsd/`), notas técnicas, tabelas do IBS/CBS (`tools/ibs-cbs-dados/sources.json`) e a
 * Calculadora da RFB. Página nova aqui entra no `estado.json` na próxima gravação.
 */

export type Extrator = 'portal-nfe' | 'portal-dfe' | 'gov-br' | 'calculadora';

export interface Fonte {
  readonly id: string;
  readonly titulo: string;
  readonly url: string;
  readonly extrator: Extrator;
  /** O que olhar quando esta fonte mudar. */
  readonly afeta: string;
}

const NFE = 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=';
const NFSE = 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica';

export const FONTES: readonly Fonte[] = [
  {
    id: 'nfe-esquemas',
    titulo: 'Portal da NF-e: Esquemas XML',
    url: `${NFE}BMPFMBoln3w=`,
    extrator: 'portal-nfe',
    afeta: '`tools/xsd-codegen` (PL novo é minor do `@sinete/schemas`, ADR 0002)',
  },
  {
    id: 'nfe-notas-tecnicas',
    titulo: 'Portal da NF-e: Notas Técnicas',
    url: `${NFE}04BIflQt1aY=`,
    extrator: 'portal-nfe',
    afeta: 'regras de validação, `@sinete/nfe`, `@sinete/rejeicoes` e, com schema junto, `tools/xsd-codegen`',
  },
  {
    id: 'nfe-informes-tecnicos',
    titulo: 'Portal da NF-e: Informes Técnicos',
    url: `${NFE}hXzemuyNHW4=`,
    extrator: 'portal-nfe',
    afeta: 'tabelas do IT 2025.002 (`tools/ibs-cbs-dados/sources.json`) e demais informes',
  },
  {
    id: 'nfe-atos-tecnicos-rfb-cgibs',
    titulo: 'Portal da NF-e: Atos Técnicos RFB/CGIBS',
    url: `${NFE}hXHrw4cadF8=`,
    extrator: 'portal-nfe',
    afeta: '`@sinete/ibs-cbs` e `@sinete/ibs-cbs-dados`',
  },
  {
    id: 'nfe-manuais',
    titulo: 'Portal da NF-e: Manuais',
    url: `${NFE}ndIjl+iEFdE=`,
    extrator: 'portal-nfe',
    afeta: 'MOC e manuais de contingência (`@sinete/nfe`, `@sinete/da`)',
  },
  {
    id: 'dfe-mdfe-documentos',
    titulo: 'Portal DF-e da SVRS: documentos do MDF-e',
    url: 'https://dfe-portal.svrs.rs.gov.br/Mdfe/Documentos',
    extrator: 'portal-dfe',
    afeta: '`tools/xsd-codegen` (MDF-e), `@sinete/mdfe` e as tabelas compartilhadas do IBS/CBS',
  },
  {
    id: 'nfse-documentacao-atual',
    titulo: 'NFS-e Nacional: documentação atual',
    url: `${NFSE}/documentacao-atual`,
    extrator: 'gov-br',
    afeta: '`tools/xsd-codegen` (NFS-e) e `@sinete/nfse`',
  },
  {
    id: 'nfse-producao-restrita',
    titulo: 'NFS-e Nacional: produção restrita',
    url: `${NFSE}/producao-restrita`,
    extrator: 'gov-br',
    afeta: 'leiaute que ainda vai para produção (`tools/xsd-codegen`, `@sinete/nfse`)',
  },
  {
    id: 'nfse-rtc',
    titulo: 'NFS-e Nacional: reforma tributária',
    url: `${NFSE}/rtc`,
    extrator: 'gov-br',
    afeta: 'grupo IBS/CBS da DPS (`@sinete/nfse`, `@sinete/ibs-cbs`)',
  },
  {
    id: 'calculadora-rfb',
    titulo: 'Calculadora de Tributos da RFB, módulo offline',
    url: 'https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/download/url?platform=default',
    extrator: 'calculadora',
    afeta: '`tools/ibs-cbs-dados` (novo pin em `sources.json`, extração e oráculo, ADR 0007)',
  },
];
