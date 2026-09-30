/**
 * Quais módulos o `@sinete/schemas` publica, de quais pacotes oficiais e com quais raízes. É dado revisado junto com
 * o XSD: NT nova é baixar o zip para `xsd/<doc>/<pacote>/` com `SOURCE.md`, acrescentar ou ajustar a entrada aqui,
 * regenerar e revisar o diff da IR.
 */
import type { BuildOptions, RootSpec } from './xsd.ts';

export interface ModuleSpec {
  /** Subpath do export (`nfe/PL_010f`); o módulo vai para `packages/schemas/src/<subpath>.ts`. */
  readonly subpath: string;
  readonly documento: 'nfe' | 'mdfe' | 'nfse';
  /** Identificador do pacote de liberação que dá nome ao módulo. */
  readonly pl: string;
  /** Pastas de `xsd/` de onde vêm os arquivos (cada uma tem SOURCE.md). */
  readonly pacotes: readonly string[];
  /** Arquivos de entrada relativos a `xsd/`, na ordem de carga (primeiro carregado vence em nome repetido). */
  readonly entries: readonly string[];
  readonly roots: readonly RootSpec[];
  readonly anyBindings?: BuildOptions['anyBindings'];
  /** Relativo a `xsd/`, como `entries`. */
  readonly overrides?: Readonly<Record<string, { readonly entry: string; readonly element: string }>>;
  /** Import que o pacote não redistribui: nome do arquivo para o caminho relativo a `xsd/`. */
  readonly missingImports?: Readonly<Record<string, string>>;
  /** Elementos sem tipo no XSD aceitos como texto (`BuildOptions.untypedAsText`). */
  readonly untypedAsText?: readonly string[];
  /**
   * Import que o pacote traz mas o parser não lê (DTD interno), trocado por um arquivo de conteúdo equivalente de outro
   * pacote: nome do arquivo para o caminho relativo a `xsd/`, e o motivo. O SOURCE.md continua listando o original.
   */
  /** Elementos referenciados (`{ns}nome`) gerados como wildcard `$any` (ver `BuildOptions.opaqueElements`). */
  readonly opaqueElements?: readonly string[];
  readonly replaceImports?: Readonly<Record<string, { readonly por: string; readonly motivo: string }>>;
  /**
   * Correções de pattern de um XSD oficial que nenhum validador conforme aceita, aplicadas na IR (o arquivo em `xsd/`
   * continua byte a byte o oficial). Cada uma tem o motivo e a fonte da correção, e sai no `schema.ajustes` do módulo.
   */
  readonly patches?: readonly PatternPatch[];
  readonly description: string;
}

export interface PatternPatch {
  /** Tipo simples global onde está o pattern. */
  readonly tipo: string;
  /** Pattern como está no XSD oficial. */
  readonly de: string;
  /** Pattern usado na geração. */
  readonly para: string;
  readonly motivo: string;
}

const PL_010D_EVENTO = 'nfe/PL_010d_v1.03/Evento';
const EVENTO_ENTRIES = [
  `${PL_010D_EVENTO}/envEvento_v1.00.xsd`,
  `${PL_010D_EVENTO}/retEnvEvento_v1.00.xsd`,
  `${PL_010D_EVENTO}/procEventoNFe_v1.00.xsd`,
];
const EVENTO_ROOTS: readonly RootSpec[] = [
  { element: 'envEvento' },
  { element: 'retEnvEvento' },
  { element: 'procEventoNFe' },
];

function evento(nome: string, pacote: string, arquivo: string, descricao: string): ModuleSpec {
  const entry = `${pacote}/${arquivo}`;
  return {
    subpath: `nfe/evento-${nome}/PL_010d`,
    documento: 'nfe',
    pl: 'PL_010d_v1.03',
    pacotes: ['nfe/PL_010d_v1.03', pacote],
    entries: [...EVENTO_ENTRIES, entry],
    roots: EVENTO_ROOTS,
    overrides: { 'TEvento.infEvento.detEvento': { entry, element: 'detEvento' } },
    description: `${descricao} Envelope genérico do evento do PL_010d_v1.03 (CNPJ alfanumérico) com o detEvento ligado ao ${arquivo}, como a SEFAZ valida: primeiro o envelope, depois o detEvento pelo schema do tipo de evento. Tipos básicos repetidos entre os dois pacotes vêm do PL_010d (o mais novo).`,
  };
}

const MDFE_300B = 'mdfe/PL_MDFe_300b_NT012025_1.05';
/** Schemas específicos dos eventos do MDF-e no PL (MOC 3.00b Visão Geral, item 3.7.1). */
const MDFE_EVENTOS: readonly { readonly arquivo: string; readonly elemento: string }[] = [
  { arquivo: 'evCancMDFe_v3.00.xsd', elemento: 'evCancMDFe' },
  { arquivo: 'evEncMDFe_v3.00.xsd', elemento: 'evEncMDFe' },
  { arquivo: 'evIncCondutorMDFe_v3.00.xsd', elemento: 'evIncCondutorMDFe' },
  { arquivo: 'evInclusaoDFeMDFe_v3.00.xsd', elemento: 'evIncDFeMDFe' },
  { arquivo: 'evPagtoOperMDFe_v3.00.xsd', elemento: 'evPagtoOperMDFe' },
  { arquivo: 'evConfirmaServMDFe_v3.00.xsd', elemento: 'evConfirmaServMDFe' },
  { arquivo: 'evAlteracaoPagtoServMDFe_v3.00.xsd', elemento: 'evAlteracaoPagtoServMDFe' },
];

const NFE_ROOTS: readonly RootSpec[] = [
  { element: 'NFe' },
  { element: 'nfeProc', type: 'TNfeProc' },
  { element: 'enviNFe', type: 'TEnviNFe' },
  { element: 'retEnviNFe', type: 'TRetEnviNFe' },
  { element: 'consReciNFe', type: 'TConsReciNFe' },
  { element: 'retConsReciNFe', type: 'TRetConsReciNFe' },
];

const NFSE_ROOTS: readonly RootSpec[] = [
  { element: 'DPS' },
  { element: 'NFSe' },
  { element: 'pedRegEvento' },
  { element: 'evento' },
];

function nfse(pacote: string): Pick<ModuleSpec, 'documento' | 'pacotes' | 'entries' | 'roots' | 'opaqueElements'> {
  const dir = `nfse/${pacote}`;
  return {
    documento: 'nfse',
    // O xmldsig da NFS-e é o schema completo do W3C (conteúdo misto, xs:any lax): a Signature fica como XML bruto em
    // $any e quem confere a assinatura é o verificador do @sinete/core/xml.
    opaqueElements: ['{http://www.w3.org/2000/09/xmldsig#}Signature'],
    pacotes: [dir],
    entries: [
      `${dir}/DPS_v1.01.xsd`,
      `${dir}/NFSe_v1.01.xsd`,
      `${dir}/pedRegEvento_v1.01.xsd`,
      `${dir}/evento_v1.01.xsd`,
    ],
    roots: NFSE_ROOTS,
  };
}

export const MODULES: readonly ModuleSpec[] = [
  {
    subpath: 'nfe/PL_010f',
    documento: 'nfe',
    pl: 'PL_010f_v1.04',
    pacotes: ['nfe/PL_010f_v1.04'],
    entries: ['nfe/PL_010f_v1.04/nfe_v4.00.xsd'],
    roots: NFE_ROOTS,
    description:
      'NF-e 4.00 (NT 2025.002 v1.50 e NT 2026.007 v1.00): NFe, nfeProc, enviNFe, retEnviNFe, consReciNFe e retConsReciNFe.',
  },
  {
    subpath: 'nfe/PL_010e',
    documento: 'nfe',
    pl: 'PL_010e_v1.02',
    pacotes: ['nfe/PL_010e_v1.02'],
    entries: ['nfe/PL_010e_v1.02/NFe/nfe_v4.00.xsd'],
    roots: NFE_ROOTS,
    description:
      'NF-e 4.00 (NT 2025.002 v1.40, NT 2026.002 e NT 2026.003): NFe, nfeProc, enviNFe, retEnviNFe, consReciNFe e retConsReciNFe.',
  },
  {
    subpath: 'mdfe/3.00b',
    documento: 'mdfe',
    pl: 'PL_MDFe_300b_NT012025_1.05',
    pacotes: ['mdfe/PL_MDFe_300b_NT012025_1.05'],
    entries: [
      'mdfe/PL_MDFe_300b_NT012025_1.05/procMDFe_v3.00.xsd',
      'mdfe/PL_MDFe_300b_NT012025_1.05/mdfeModalRodoviario_v3.00.xsd',
      'mdfe/PL_MDFe_300b_NT012025_1.05/mdfeModalAereo_v3.00.xsd',
      'mdfe/PL_MDFe_300b_NT012025_1.05/mdfeModalAquaviario_v3.00.xsd',
      'mdfe/PL_MDFe_300b_NT012025_1.05/mdfeModalFerroviario_v3.00.xsd',
      'mdfe/PL_MDFe_300b_NT012025_1.05/retMDFe_v3.00.xsd',
    ],
    roots: [{ element: 'mdfeProc' }, { element: 'MDFe', type: 'TMDFe' }, { element: 'retMDFe', type: 'TRetMDFe' }],
    anyBindings: { 'TMDFe.infMDFe.infModal': ['rodo', 'aereo', 'aquav', 'ferrov'] },
    // O retMDFe_v3.00.xsd oficial declara o tpAmb do TRetMDFe sem tipo (xs:anyType); o conteúdo é o TAmb.
    untypedAsText: ['TRetMDFe.tpAmb'],
    description:
      'MDF-e 3.00b (NT 2025.001 v1.04): MDFe, mdfeProc e retMDFe (retorno da recepção síncrona), com o infModal (xs:any) ligado aos quatro modais como dado.',
  },
  {
    subpath: 'mdfe/eventos/3.00b',
    documento: 'mdfe',
    pl: 'PL_MDFe_300b_NT012025_1.05',
    pacotes: ['mdfe/PL_MDFe_300b_NT012025_1.05'],
    entries: [
      `${MDFE_300B}/procEventoMDFe_v3.00.xsd`,
      `${MDFE_300B}/eventoMDFe_v3.00.xsd`,
      `${MDFE_300B}/retEventoMDFe_v3.00.xsd`,
      ...MDFE_EVENTOS.map((e) => `${MDFE_300B}/${e.arquivo}`),
    ],
    roots: [{ element: 'eventoMDFe' }, { element: 'retEventoMDFe' }, { element: 'procEventoMDFe' }],
    anyBindings: { 'TEvento.infEvento.detEvento': MDFE_EVENTOS.map((e) => e.elemento) },
    description:
      'Eventos do MDF-e 3.00b: eventoMDFe, retEventoMDFe e procEventoMDFe, com o detEvento (xs:any) ligado como dado aos schemas específicos do PL (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e, pagamento da operação, confirmação do serviço e alteração do pagamento). O autorizador valida em duas etapas (envelope e schema do tipo pelo tpEvento, regra J06); a ligação por tpEvento fica com quem monta ou confere o evento.',
  },
  {
    subpath: 'mdfe/servicos/3.00b',
    documento: 'mdfe',
    pl: 'PL_MDFe_300b_NT012025_1.05',
    pacotes: ['mdfe/PL_MDFe_300b_NT012025_1.05'],
    entries: [
      `${MDFE_300B}/consStatServMDFe_v3.00.xsd`,
      `${MDFE_300B}/retConsStatServMDFe_v3.00.xsd`,
      `${MDFE_300B}/consSitMDFe_v3.00.xsd`,
      `${MDFE_300B}/retConsSitMDFe_v3.00.xsd`,
      `${MDFE_300B}/consMDFeNaoEnc_v3.00.xsd`,
      `${MDFE_300B}/retConsMDFeNaoEnc_v3.00.xsd`,
    ],
    roots: [
      { element: 'consStatServMDFe' },
      { element: 'retConsStatServMDFe' },
      { element: 'consSitMDFe' },
      { element: 'retConsSitMDFe' },
      { element: 'consMDFeNaoEnc' },
      { element: 'retConsMDFeNaoEnc' },
    ],
    description:
      'Consultas do MDF-e 3.00b: status do serviço (consStatServMDFe), situação (consSitMDFe, cujo retorno traz protMDFe e procEventoMDFe como xs:any bruto em $any) e MDF-e não encerrados (consMDFeNaoEnc).',
  },
  evento(
    'cancelamento',
    'nfe/Evento_Canc_PL_v1.01',
    'e110111_v1.00.xsd',
    'Evento de cancelamento da NF-e (tpEvento 110111).',
  ),
  evento('cce', 'nfe/Evento_CCe_PL_v1.01', 'e110110_v1.00.xsd', 'Carta de correção eletrônica (tpEvento 110110).'),
  evento(
    'cancelamento-substituicao',
    'nfe/Evento_CancSubst_v1.01',
    'e110112_v1.00.xsd',
    'Cancelamento por substituição da NFC-e (tpEvento 110112, NT 2018.004).',
  ),
  evento(
    'confirmacao-operacao',
    'nfe/Evento_ManifestaDest_PL_v1.01',
    'e210200_v1.00.xsd',
    'Manifestação do destinatário: confirmação da operação (tpEvento 210200).',
  ),
  evento(
    'ciencia-operacao',
    'nfe/Evento_ManifestaDest_PL_v1.01',
    'e210210_v1.00.xsd',
    'Manifestação do destinatário: ciência da operação (tpEvento 210210).',
  ),
  evento(
    'desconhecimento-operacao',
    'nfe/Evento_ManifestaDest_PL_v1.01',
    'e210220_v1.00.xsd',
    'Manifestação do destinatário: desconhecimento da operação (tpEvento 210220).',
  ),
  evento(
    'operacao-nao-realizada',
    'nfe/Evento_ManifestaDest_PL_v1.01',
    'e210240_v1.00.xsd',
    'Manifestação do destinatário: operação não realizada (tpEvento 210240).',
  ),
  {
    subpath: 'nfe/inutilizacao/PL_010d',
    documento: 'nfe',
    pl: 'PL_010d_v1.03',
    pacotes: ['nfe/PL_010d_v1.03'],
    entries: ['nfe/PL_010d_v1.03/NFe/procInutNFe_v4.00.xsd'],
    roots: [
      { element: 'inutNFe', type: 'TInutNFe' },
      { element: 'retInutNFe', type: 'TRetInutNFe' },
      { element: 'ProcInutNFe' },
    ],
    description: 'Inutilização de numeração da NF-e: inutNFe, retInutNFe e ProcInutNFe.',
  },
  {
    subpath: 'nfe/consulta-protocolo/PL_010d',
    documento: 'nfe',
    pl: 'PL_010d_v1.03',
    pacotes: ['nfe/PL_010d_v1.03'],
    entries: ['nfe/PL_010d_v1.03/NFe/consSitNFe_v4.00.xsd', 'nfe/PL_010d_v1.03/NFe/retConsSitNFe_v4.00.xsd'],
    roots: [{ element: 'consSitNFe' }, { element: 'retConsSitNFe' }],
    description:
      'Consulta protocolo (situação) da NF-e: consSitNFe e retConsSitNFe. O detEvento dos eventos devolvidos é xs:any e fica como XML bruto em $any.',
  },
  {
    subpath: 'nfe/consulta-cadastro/PL_010d',
    documento: 'nfe',
    pl: 'PL_010d_v1.03',
    pacotes: ['nfe/PL_010d_v1.03'],
    entries: [
      'nfe/PL_010d_v1.03/CadConsultaCadastro/consCad_v2.00.xsd',
      'nfe/PL_010d_v1.03/CadConsultaCadastro/retConsCad_v2.00.xsd',
    ],
    roots: [{ element: 'ConsCad' }, { element: 'retConsCad' }],
    description: 'Consulta cadastro de contribuintes (CCC): ConsCad e retConsCad.',
  },
  {
    subpath: 'nfe/status-servico/PL_009q',
    documento: 'nfe',
    pl: 'PL_009q_NT2025_001_v1.00',
    pacotes: ['nfe/PL_009q_NT2025_001_v1.00'],
    entries: [
      'nfe/PL_009q_NT2025_001_v1.00/consStatServ_v4.00.xsd',
      'nfe/PL_009q_NT2025_001_v1.00/retConsStatServ_v4.00.xsd',
    ],
    roots: [{ element: 'consStatServ' }, { element: 'retConsStatServ' }],
    description:
      'Status do serviço da NF-e: consStatServ e retConsStatServ (os pacotes 010 não redistribuem estes schemas).',
  },
  {
    subpath: 'nfe/dist-dfe/PL_NFeDistDFe_104',
    documento: 'nfe',
    pl: 'PL_NFeDistDFe_104',
    pacotes: ['nfe/PL_NFeDistDFe_104', 'nfe/PL_010d_v1.03'],
    missingImports: { 'xmldsig-core-schema_v1.01.xsd': 'nfe/PL_010d_v1.03/NFe/xmldsig-core-schema_v1.01.xsd' },
    entries: [
      'nfe/PL_NFeDistDFe_104/distDFeInt_v1.01.xsd',
      'nfe/PL_NFeDistDFe_104/retDistDFeInt_v1.01.xsd',
      'nfe/PL_NFeDistDFe_104/resNFe_v1.01.xsd',
      'nfe/PL_NFeDistDFe_104/resEvento_v1.01.xsd',
    ],
    roots: [{ element: 'distDFeInt' }, { element: 'retDistDFeInt' }, { element: 'resNFe' }, { element: 'resEvento' }],
    description:
      'Distribuição de DF-e de interesse: distDFeInt e retDistDFeInt, mais resNFe e resEvento, que chegam compactados em docZip (o docZip é base64 de gzip e fica como string). O pacote importa o xmldsig-core-schema_v1.01.xsd sem redistribuí-lo; usa-se o do PL_010d_v1.03.',
  },
  {
    subpath: 'nfse/1.01-20260209',
    pl: 'NFSe_v1.01_20260209',
    ...nfse('NFSe_v1.01_20260209'),
    replaceImports: {
      'xmldsig-core-schema.xsd': {
        por: 'nfse/NFSe_v1.01_20260727/xmldsig-core-schema.xsd',
        motivo:
          'O xmldsig-core-schema.xsd do pacote 20260209 começa com um DOCTYPE (DTD interno do W3C), que o parser do @sinete/core/xml recusa por segurança. O do pacote 20260727 é o mesmo arquivo sem o DOCTYPE (diff conferido na inclusão).',
      },
    },
    patches: [
      {
        tipo: 'TSSerieDPS',
        de: '^0{0,4}\\d{1,5}$',
        para: '0{0,4}\\d{1,5}',
        motivo:
          'Em regex de XSD (XML Schema 1.0 Part 2, apêndice F) ^ e $ são caracteres literais e o pattern já é ancorado: como está, nenhuma série passa num validador conforme (libxml2 recusa). Tiradas só as âncoras, que é a intenção evidente. O pacote 20260727 trocou o pattern por [0-9]{1,4}|[0-8][0-9]{4}. Achado no spike S2 (ADR 0004, NFS-e operação 5).',
      },
    ],
    description:
      'NFS-e Nacional, leiaute 1.01 (esquemas XSD de 09/02/2026, Documentação Atual de produção): DPS, NFSe, pedRegEvento e evento. O TSSerieDPS oficial tem as âncoras ^ e $ literais; a geração usa o pattern corrigido (schema.ajustes).',
  },
  {
    subpath: 'nfse/1.01-20260727',
    pl: 'NFSe_v1.01_20260727',
    ...nfse('NFSe_v1.01_20260727'),
    description:
      'NFS-e Nacional, leiaute 1.01 com CNPJ alfanumérico (esquemas XSD de 27/07/2026, produção restrita desde 27/07/2026 e produção desde 10/08/2026): DPS, NFSe, pedRegEvento e evento. Grupos IBS/CBS da NT SE/CGNFS-e 004.',
  },
];
