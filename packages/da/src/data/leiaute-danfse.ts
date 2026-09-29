/**
 * Leiaute do DANFSe v2 como dados (ADR 0006, decisão 2), da NT SE/CGNFS-e 008/2026 v1.02 (14/07/2026), "Especificações
 * Técnicas do DANFSe", coletada em 28/09/2026 de
 * https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260714-v1-02.pdf.
 * Medidas em mm (a NT dá em cm); descrições das opções do leiaute pelas anotações dos XSD da NFS-e Nacional 1.01.
 */

import type { Fonte } from './leiaute.ts';

/**
 * Página e grade. A4 retrato numa página só (2.2 e 2.2.1). A tabela do 2.4.5 põe o corpo a 0,30 cm da borda do papel,
 * com 20,40 cm de largura, em quatro colunas de 5,09 cm que começam em 0,30, 5,41, 10,51 e 15,62 cm; a borda de 1 pt
 * (2.2.3) fica a 0,20 cm do papel, o máximo do 2.2.2. Alturas de linha da mesma tabela: 0,63 a 0,66 cm nos blocos
 * comuns (a posição do bloco seguinte dá 0,645 cm por linha), 0,67 a 0,69 cm na identificação e no valor total.
 */
export const GRADE_DANFSE: Fonte & {
  readonly pagina: { readonly w: number; readonly h: number };
  readonly borda: { readonly margem: number; readonly espessura: number };
  readonly divisoria: number;
  readonly x: number;
  readonly w: number;
  readonly colunas: readonly [number, number, number, number];
  readonly coluna: number;
  readonly topo: number;
  readonly cabecalho: number;
  readonly linha: number;
  readonly linhaIdentificacao: number;
  readonly linhaChave: number;
  readonly linhaTotal: number;
  readonly descricaoTributacao: number;
  readonly tituloInformacoes: number;
  readonly blocoSuprimido: number;
  readonly canhoto: { readonly y: number; readonly h: number };
  readonly fim: number;
  readonly sombra: number;
} = {
  source: 'NT SE/CGNFS-e 008/2026 v1.02, 2.2, 2.2.1, 2.2.2, 2.2.3, 2.4.5 (tabela e notas 2 a 4)',
  pagina: { w: 210, h: 297 },
  // 2.2.2: de 0,15 a 0,20 cm entre o corpo impresso e o fim do formulário; 2.2.3: borda de 1 pt.
  borda: { margem: 2, espessura: 25.4 / 72 },
  // 2.2.3: linhas divisórias dos blocos com 0,5 pt.
  divisoria: 25.4 / 144,
  x: 3,
  w: 204,
  colunas: [3, 54.1, 105.1, 156.2],
  coluna: 50.9,
  topo: 3,
  cabecalho: 11.8,
  linha: 6.45,
  linhaIdentificacao: 6.9,
  linhaChave: 7.9,
  linhaTotal: 6.85,
  descricaoTributacao: 3.9,
  tituloInformacoes: 4.1,
  // Notas 2, 3 e 4: bloco suprimido com a frase só, altura mínima de 0,32 cm.
  blocoSuprimido: 3.2,
  // Canhoto opcional (2.1.13, nota 11) a 28,10 cm, com 0,67 cm de altura.
  canhoto: { y: 281, h: 6.7 },
  fim: 287.7,
  // 2.2.3: cinza claro com 5% de densidade (0 = preto, 1 = branco).
  sombra: 0.95,
};

/**
 * Tipos e posições fixas do cabeçalho (2.4.3 e 2.4.5): logomarca da NFS-e à esquerda (4,00 x 0,85 cm a 0,49 x 0,44
 * cm), "DANFSe v2.0" e "Documento Auxiliar da NFS-e" ao centro em Arial negrito 9 pt, município do emitente em 8 pt e
 * ambientes em 6 pt à direita. Rótulos de bloco em 7 pt negrito e caixa alta (2.4.1), rótulos de campo em 6 pt
 * negrito (2.4.2; os da identificação em 7 pt e caixa alta), conteúdo em 7 pt normal (2.4.3 e 2.4.4). Arial e
 * Microsoft Sans Serif (2.4) saem como Helvetica, a fonte padrão do PDF com as mesmas métricas da Arial.
 */
export const CABECALHO_DANFSE: Fonte & {
  readonly logo: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly descricao: { readonly x: number; readonly w: number };
  readonly municipio: { readonly x: number; readonly w: number };
  readonly titulo: readonly [string, string];
  readonly homologacao: string;
  readonly vermelho: readonly [number, number, number];
  readonly tamanhos: {
    readonly titulo: number;
    readonly municipio: number;
    readonly ambiente: number;
    readonly rotuloBloco: number;
    readonly rotuloCampo: number;
    readonly rotuloIdentificacao: number;
    readonly conteudo: number;
  };
} = {
  source: 'NT SE/CGNFS-e 008/2026 v1.02, 2, 2.4, 2.4.1 a 2.4.4, 2.4.5 (cabeçalho)',
  logo: { x: 4.9, y: 4.4, w: 40, h: 8.5 },
  descricao: { x: 54.1, w: 101.9 },
  municipio: { x: 156.2, w: 50.9 },
  titulo: ['DANFSe v2.0', 'Documento Auxiliar da NFS-e'],
  // 2 e 2.4.3, observação: em produção restrita (tpAmb 2), abaixo do título, Arial negrito 9 pt em vermelho sólido.
  homologacao: 'NFS-e SEM VALIDADE JURÍDICA',
  vermelho: [1, 0, 0],
  tamanhos: {
    titulo: 9,
    municipio: 8,
    ambiente: 6,
    rotuloBloco: 7,
    rotuloCampo: 6,
    rotuloIdentificacao: 7,
    conteudo: 7,
  },
};

/**
 * QR Code (2.4.3): endereço de consulta do Portal Nacional com a chave de acesso depois do sinal de igual, no mínimo
 * 1,52 x 1,52 cm em X 17,48 cm e Y 1,67 cm, e abaixo dele o texto de autenticidade em três linhas de 6 pt, num quadro
 * de 4,72 x 0,68 cm em 15,80 x 3,36 cm (2.4.5). A zona de silêncio fica fora do quadro de 1,52 cm, no espaço livre
 * em volta.
 */
export const QR_DANFSE: Fonte & {
  readonly url: string;
  readonly x: number;
  readonly y: number;
  readonly lado: number;
  readonly texto: string;
  readonly quadroTexto: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
} = {
  source: 'NT SE/CGNFS-e 008/2026 v1.02, 2.4.3 e 2.4.5 (quadro do QR Code e complemento)',
  url: 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=',
  x: 174.8,
  y: 16.7,
  lado: 15.2,
  texto:
    'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e',
  quadroTexto: { x: 158, y: 33.6, w: 47.2, h: 6.8 },
};

/**
 * Textos obrigatórios: blocos sem dados (2.3.1 e 2.3.2, notas 2 a 4), traço nos campos sem informação (nota 12), a
 * linha dos tributos aproximados (2 e nota 10, Lei 12.741/2012), os rótulos das informações complementares na ordem
 * da tabela (notas 7 a 9) e as marcas d'água de cancelada e substituída (2.5.1 e 2.5.2: diagonal, normal, no mínimo
 * 50 pt, Arial, cinza K35).
 */
export const TEXTOS_DANFSE: Fonte & {
  readonly tomadorAusente: string;
  readonly destinatarioAusente: string;
  readonly destinatarioTomador: string;
  readonly intermediarioAusente: string;
  readonly issqnAusente: string;
  readonly vazio: string;
  readonly totais: string;
  readonly informacoes: {
    readonly infCont: string;
    readonly subst: string;
    readonly docRef: string;
    readonly obra: string;
    readonly imovel: string;
    readonly evento: string;
    readonly docTec: string;
    readonly pedido: string;
    readonly itemPedido: string;
    readonly municipio: string;
  };
  readonly separador: string;
  readonly cancelada: string;
  readonly substituida: string;
  readonly marca: { readonly minimo: number; readonly cinza: number };
} = {
  source:
    'NT SE/CGNFS-e 008/2026 v1.02, 2, 2.3.1, 2.3.2, 2.4.5 (informações complementares e notas 2 a 12), 2.5.1, 2.5.2',
  tomadorAusente: 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
  destinatarioAusente: 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
  destinatarioTomador: 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO',
  intermediarioAusente: 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
  issqnAusente: 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN',
  vazio: '-',
  totais: 'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012:',
  informacoes: {
    infCont: 'Inf. Cont.:',
    subst: 'NFS-e Subst.:',
    docRef: 'Doc. Ref.:',
    obra: 'Cod. Obra:',
    imovel: 'Insc. Imob.:',
    evento: 'Cod. Evt.:',
    docTec: 'Doc. Tec.:',
    pedido: 'Núm. Ped.:',
    itemPedido: 'Item Ped.:',
    municipio: 'Inf. A. T. Mun.:',
  },
  separador: ' | ',
  cancelada: 'CANCELADA',
  substituida: 'SUBSTITUÍDA',
  // K35: 35% de preto, 0,65 na escala de cinza do modelo (1 = branco).
  marca: { minimo: 50, cinza: 0.65 },
};

/**
 * Descrições das opções do leiaute que o DANFSe imprime no lugar do código (2.4.5: "Utilizar a descrição destas
 * opções"). Os textos são os das anotações dos XSD da NFS-e Nacional 1.01 (`TSTipoAmbiente`, `TSAmbGeradorNFSe`,
 * `TSEmitenteDPS`, `TStat`, `TSRTCFinNFSe`, `TSOpSimpNac`, `TSRegimeApuracaoSimpNac`, `TSRegEspTrib`, `TSTribISSQN`,
 * `TSTipoImunidadeISSQN`, `TSOpExigSuspensa`, `TBMISSQN`, `TSTipoRetISSQN` e `TSTipoRetPISCofins`), iguais nos
 * pacotes 20260209 e 20260727.
 */
export const OPCOES_DANFSE: Fonte & { readonly opcoes: Readonly<Record<string, Readonly<Record<string, string>>>> } = {
  source:
    'XSD NFS-e Nacional 1.01 (pacotes 20260209 e 20260727), anotações dos tipos simples; NT SE/CGNFS-e 008/2026 v1.02, 2.4.5',
  opcoes: {
    tpAmb: { '1': 'Produção', '2': 'Homologação' },
    ambGer: { '1': 'Prefeitura', '2': 'Sistema Nacional da NFS-e' },
    tpEmit: { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' },
    cStat: {
      '100': 'NFS-e Gerada',
      '102': 'NFS-e de Decisão Judicial',
      '103': 'NFS-e Avulsa',
      '107': 'NFS-e MEI',
    },
    finNFSe: { '0': 'NFS-e regular' },
    opSimpNac: {
      '1': 'Não Optante',
      '2': 'Optante - Microempreendedor Individual (MEI)',
      '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
    },
    regApTribSN: {
      '1': 'Regime de apuração dos tributos federais e municipal pelo SN',
      '2': 'Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN conforme respectiva legislação municipal do tributo',
      '3': 'Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo',
    },
    regEspTrib: {
      '0': 'Nenhum',
      '1': 'Ato Cooperado (Cooperativa)',
      '2': 'Estimativa',
      '3': 'Microempresa Municipal',
      '4': 'Notário ou Registrador',
      '5': 'Profissional Autônomo',
      '6': 'Sociedade de Profissionais',
      '9': 'Outros',
    },
    tribISSQN: {
      '1': 'Operação tributável',
      '2': 'Imunidade',
      '3': 'Exportação de serviço',
      '4': 'Não Incidência',
    },
    tpImunidade: {
      '0': 'Imunidade (tipo não informado na nota de origem)',
      '1': 'Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a)',
      '2': 'Templos de qualquer culto (CF88, Art 150, VI, b)',
      '3': 'Patrimônio, renda ou serviços dos partidos políticos, inclusive suas fundações, das entidades sindicais dos trabalhadores, das instituições de educação e de assistência social, sem fins lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c)',
      '4': 'Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d)',
      '5': 'Fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros bem como os suportes materiais ou arquivos digitais que os contenham, salvo na etapa de replicação industrial de mídias ópticas de leitura a laser. (CF88, Art 150, VI, e)',
    },
    tpSusp: {
      '1': 'Exigibilidade Suspensa por Decisão Judicial',
      '2': 'Exigibilidade Suspensa por Processo Administrativo',
    },
    // O XSD descreve as opções 2 a 4 com o nome do campo do valor ("Redução da BC em 'ppBM' %"); o DANFSe imprime
    // a descrição sem o marcador, e o valor sai no campo "Cálculo do BM".
    tpBM: {
      '1': 'Isenção',
      '2': 'Redução da BC em percentual',
      '3': 'Redução da BC em valor',
      '4': 'Alíquota Diferenciada',
    },
    // O XSD escreve "Intermediario" sem acento; o DANFSe usa a grafia do rótulo do bloco.
    tpRetISSQN: { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' },
    tpRetPisCofins: {
      '0': 'PIS/COFINS/CSLL Não Retidos',
      '1': 'PIS/COFINS Retidos',
      '2': 'PIS/COFINS Não Retidos',
      '3': 'PIS/COFINS/CSLL Retidos',
      '4': 'PIS/COFINS Retidos, CSLL Não Retido',
      '5': 'PIS Retido, COFINS/CSLL Não Retido',
      '6': 'COFINS Retido, PIS/CSLL Não Retido',
      '7': 'PIS Não Retido, COFINS/CSLL Retidos',
      '8': 'PIS/COFINS Não Retidos, CSLL Retido',
      '9': 'COFINS Não Retido, PIS/CSLL Retidos',
    },
  },
};

/**
 * O que cada `tpRetPisCofins` retém de PIS e de COFINS, pela descrição das opções no XSD (`TSTipoRetPISCofins`). A NT
 * 008/2026 v1.02 (2.4.5, "Contribuições Sociais - Retidas", "PIS - Débito Apuração Própria" e "COFINS - Débito
 * Apuração Própria") só trata o código 1: soma PIS e COFINS às retidas e zera o débito próprio. Os códigos 3 a 9, que
 * separam os tributos, seguem a mesma regra para o que cada um retém; a CSLL retida (`vRetCSLL`) entra sempre.
 */
export const RETENCAO_PIS_COFINS: Fonte & {
  readonly codigos: Readonly<Record<string, { readonly pis: boolean; readonly cofins: boolean }>>;
} = {
  source: 'XSD NFS-e Nacional 1.01, TSTipoRetPISCofins; NT SE/CGNFS-e 008/2026 v1.02, 2.4.5 (tributação federal)',
  codigos: {
    '0': { pis: false, cofins: false },
    '1': { pis: true, cofins: true },
    '2': { pis: false, cofins: false },
    '3': { pis: true, cofins: true },
    '4': { pis: true, cofins: true },
    '5': { pis: true, cofins: false },
    '6': { pis: false, cofins: true },
    '7': { pis: false, cofins: true },
    '8': { pis: false, cofins: false },
    '9': { pis: true, cofins: false },
  },
};

/**
 * Eventos da NFS-e que o DANFSe carimba, pelo nome do grupo do evento no `infPedReg`: cancelamento (e101101),
 * cancelamento deferido por análise fiscal (e105104) e cancelamento por ofício (e305101) dão "CANCELADA" (2.5.1); o
 * cancelamento por substituição (e105102) dá "SUBSTITUÍDA" (2.5.2).
 */
export const EVENTOS_DANFSE: Fonte & {
  readonly cancelamento: readonly string[];
  readonly substituicao: readonly string[];
} = {
  source: 'XSD NFS-e Nacional 1.01, TCInfPedReg e TSCodigoEventoNFSe; NT SE/CGNFS-e 008/2026 v1.02, 2.5.1 e 2.5.2',
  cancelamento: ['e101101', 'e105104', 'e305101'],
  substituicao: ['e105102'],
};
