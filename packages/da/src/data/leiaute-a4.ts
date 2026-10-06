/**
 * Medidas e textos do DANFE A4 como dados (ADR 0006, decisão 2), cada grupo com a origem. As larguras do DANFE A4
 * são as sugeridas pelo MOC 7.0, Anexo II, 3.8.1 (retrato) e 3.8.2 (paisagem), convertidas de cm para mm; quando a
 * soma de uma linha não fecha com a largura do quadro por arredondamento do MOC, o layout ajusta a última coluna.
 */

import type { Fonte } from './leiaute.ts';

/** Tamanhos mínimos de fonte, em pontos. */
export const FONTES: Fonte &
  Readonly<Record<'titulo' | 'rotulo' | 'conteudo' | 'demais' | 'emitente' | 'danfe', number>> = {
  source: 'MOC 7.0, Anexo II, 3.7.1 a 3.7.9',
  /** Descritivo dos blocos (3.7.1): mínimo 5 pt, negrito, caixa alta. */
  titulo: 6,
  /** Descritivo dos demais campos (3.7.3): mínimo 6 pt, caixa alta. */
  rotulo: 6,
  /** Conteúdo dos produtos e das informações complementares (3.7.7 e 3.7.8): mínimo 6 pt. */
  conteudo: 6.5,
  /** Conteúdo dos demais campos (3.7.9): 10 pt nominal. */
  demais: 10,
  /** Razão social do emitente (3.7.6): 12 pt; demais dados do emitente: 8 pt. */
  emitente: 12,
  /** "DANFE" (3.7.4): 12 pt negrito. */
  danfe: 12,
};

/** Uma linha de campos: rótulo e largura em mm. */
export type Linha = readonly (readonly [rotulo: string, largura: number])[];

export interface FormatoA4 extends Fonte {
  readonly pagina: { readonly w: number; readonly h: number };
  /** Início e largura do corpo (cabeçalho e quadros). */
  readonly x: number;
  readonly w: number;
  /** Largura da faixa de título vertical dos quadros (só paisagem); 0 no retrato, onde o título fica acima. */
  readonly faixa: number;
  readonly linha: number;
  readonly topo: number;
  readonly base: number;
  readonly cabecalho: {
    readonly emitente: number;
    readonly danfe: number;
    readonly altura: number;
    readonly barras: number;
    readonly chave: number;
  };
  readonly destinatario: readonly Linha[];
  readonly imposto: readonly Linha[];
  readonly transportador: readonly Linha[];
  readonly issqn: Linha;
  readonly adicionais: { readonly complementares: number; readonly altura: number };
}

export const RETRATO: FormatoA4 = {
  source: 'MOC 7.0, Anexo II, 3.8.1 (A4 retrato, folhas soltas, variante laser) e Anexo III.02',
  pagina: { w: 210, h: 297 },
  x: 2.5,
  w: 205.7,
  faixa: 0,
  linha: 8.5,
  topo: 4.2,
  // Dados adicionais terminam em 29,40 cm (26,33 + 3,07); a margem inferior fica em 3 mm (3.6.2: 2 a 8 mm).
  base: 294,
  cabecalho: { emitente: 100, danfe: 25.4, altura: 39.2, barras: 14.8, chave: 8.5 },
  destinatario: [
    [
      ['NOME/RAZÃO SOCIAL', 123.2],
      ['CNPJ/CPF', 53.3],
      ['DATA DA EMISSÃO', 29.2],
    ],
    [
      ['ENDEREÇO', 101.6],
      ['BAIRRO/DISTRITO', 48.3],
      ['CEP', 26.6],
      ['DATA DA SAÍDA/ENTRADA', 29.2],
    ],
    [
      ['MUNICÍPIO', 71.1],
      ['FONE/FAX', 40.6],
      ['UF', 11.4],
      ['INSCRIÇÃO ESTADUAL', 53.4],
      ['HORA DA SAÍDA/ENTRADA', 29.2],
    ],
  ],
  imposto: [
    [
      ['BASE DE CÁLCULO DO ICMS', 40.6],
      ['VALOR DO ICMS', 40.6],
      ['BASE DE CÁLC. ICMS S.T.', 40.6],
      ['VALOR DO ICMS SUBST.', 40.6],
      ['VALOR TOTAL DOS PRODUTOS', 43.3],
    ],
    [
      ['VALOR DO FRETE', 33],
      ['VALOR DO SEGURO', 33],
      ['DESCONTO', 33],
      ['OUTRAS DESPESAS', 33],
      ['VALOR TOTAL DO IPI', 33],
      ['VALOR TOTAL DA NOTA', 41.7],
    ],
  ],
  transportador: [
    [
      ['NOME/RAZÃO SOCIAL', 90.2],
      ['FRETE POR CONTA', 27.9],
      ['CÓDIGO ANTT', 17.8],
      ['PLACA DO VEÍCULO', 22.9],
      ['UF', 7.6],
      ['CNPJ/CPF', 39.3],
    ],
    [
      ['ENDEREÇO', 90.2],
      ['MUNICÍPIO', 68.6],
      ['UF', 7.6],
      ['INSCRIÇÃO ESTADUAL', 39.3],
    ],
    [
      ['QUANTIDADE', 29.2],
      ['ESPÉCIE', 30.5],
      ['MARCA', 30.5],
      ['NUMERAÇÃO', 48.3],
      ['PESO BRUTO', 34.3],
      ['PESO LÍQUIDO', 32.9],
    ],
  ],
  issqn: [
    ['INSCRIÇÃO MUNICIPAL', 50.8],
    ['VALOR TOTAL DOS SERVIÇOS', 50.8],
    ['BASE DE CÁLCULO DO ISSQN', 50.8],
    ['VALOR DO ISSQN', 53.3],
  ],
  adicionais: { complementares: 129.5, altura: 30.7 },
};

export const PAISAGEM: FormatoA4 = {
  source: 'MOC 7.0, Anexo II, 3.8.2 (A4 paisagem, folhas soltas) e Anexo III.04',
  pagina: { w: 297, h: 210 },
  x: 24.1,
  w: 270.5,
  faixa: 5.1,
  linha: 6.4,
  topo: 4.7,
  // O MOC termina os dados adicionais em 20,89 cm, abaixo da margem mínima de 2 mm (3.6.2); o quadro encolhe para
  // terminar em 207 mm.
  base: 207,
  cabecalho: { emitente: 114.3, danfe: 30.5, altura: 31, barras: 11.9, chave: 6.4 },
  destinatario: [
    [
      ['NOME/RAZÃO SOCIAL', 163.8],
      ['CNPJ/CPF', 58.4],
      ['DATA DA EMISSÃO', 43.2],
    ],
    [
      ['ENDEREÇO', 124.5],
      ['BAIRRO/DISTRITO', 58.4],
      ['CEP', 39.4],
      ['DATA DA SAÍDA/ENTRADA', 43.1],
    ],
    [
      ['MUNICÍPIO', 100.3],
      ['FONE/FAX', 50.8],
      ['UF', 12.7],
      ['INSCRIÇÃO ESTADUAL', 58.4],
      ['HORA DA SAÍDA/ENTRADA', 43.2],
    ],
  ],
  imposto: [
    [
      ['BASE DE CÁLCULO DO ICMS', 53.3],
      ['VALOR DO ICMS', 53.3],
      ['BASE DE CÁLC. ICMS S.T.', 53.3],
      ['VALOR DO ICMS SUBST.', 53.3],
      ['VALOR TOTAL DOS PRODUTOS', 52.2],
    ],
    [
      ['VALOR DO FRETE', 43.2],
      ['VALOR DO SEGURO', 43.2],
      ['DESCONTO', 43.2],
      ['OUTRAS DESPESAS', 43.2],
      ['VALOR TOTAL DO IPI', 43.2],
      ['VALOR TOTAL DA NOTA', 49.4],
    ],
  ],
  transportador: [
    [
      ['NOME/RAZÃO SOCIAL', 115.6],
      ['FRETE POR CONTA', 27.9],
      ['CÓDIGO ANTT', 25.4],
      ['PLACA DO VEÍCULO', 38.1],
      ['UF', 10.2],
      ['CNPJ/CPF', 48.2],
    ],
    [
      ['ENDEREÇO', 115.6],
      ['MUNICÍPIO', 91.4],
      ['UF', 10.2],
      ['INSCRIÇÃO ESTADUAL', 48.2],
    ],
    [
      ['QUANTIDADE', 35.6],
      ['ESPÉCIE', 38.1],
      ['MARCA', 41.9],
      ['NUMERAÇÃO', 50.8],
      ['PESO BRUTO', 50.8],
      ['PESO LÍQUIDO', 48.2],
    ],
  ],
  issqn: [
    ['INSCRIÇÃO MUNICIPAL', 66],
    ['VALOR TOTAL DOS SERVIÇOS', 66],
    ['BASE DE CÁLCULO DO ISSQN', 66],
    ['VALOR DO ISSQN', 67.4],
  ],
  adicionais: { complementares: 190.5, altura: 27 },
};

/**
 * Bloco "Total do IBS/CBS/IS" do DANFE A4 (NT 2026.010 v1.00, 4.1), logo após os totais do ICMS/IPI, em duas linhas na
 * ordem do modelo de referência da NT. Proporções de largura, não medidas do MOC. As quatro células da monofasia ficam
 * vazias sem o grupo `gMono` (4.4).
 */
export const QUADRO_IBSCBS: Fonte & {
  readonly titulo: string;
  readonly linhas: readonly (readonly (readonly [string, number])[])[];
} = {
  source: 'NT 2026.010 v1.00, itens 4.1 e 4.4, e modelo de referência (DANFE Modelo 55 Vertical)',
  titulo: 'TOTAL DO IBS/CBS/IS',
  linhas: [
    [
      ['VALOR DA CBS', 1],
      ['VALOR DO IBS UF', 1],
      ['VALOR DO IBS MUNICÍPIO', 1],
      ['VALOR DO IMPOSTO SELETIVO', 1],
    ],
    [
      ['VALOR DO IBS MONOFÁSICO', 1],
      ['VALOR DA CBS MONOFÁSICA', 1],
      ['VALOR DO IBS MONOFÁSICO POR RETENÇÃO', 1],
      ['VALOR DA CBS MONOFÁSICA POR RETENÇÃO', 1],
    ],
  ],
};

/**
 * Linha do quadro do emitente com o Código do Regime Tributário e a área reservada ao Tipo de Regime de Apuração do IBS
 * e da CBS (NT 2026.010 v1.00, 4.2; a área fica vazia até a NT que definir a tag, 4.4).
 */
export const REGIME: Fonte & {
  readonly rotulos: readonly [string, string];
  readonly crt: Readonly<Record<string, string>>;
} = {
  source: 'NT 2026.010 v1.00, itens 4.2 e 4.4; MOC 7.0 Anexo I, campo C21 (CRT)',
  rotulos: ['CÓDIGO DO REGIME TRIBUTÁRIO', 'TIPO DE REGIME DE APURAÇÃO DO IBS E DA CBS'],
  crt: {
    '1': '1 - SIMPLES NACIONAL',
    '2': '2 - SIMPLES NACIONAL, EXCESSO DE SUBLIMITE DE RECEITA BRUTA',
    '3': '3 - REGIME NORMAL',
    '4': '4 - SIMPLES NACIONAL, MEI',
  },
};

/** Modalidade do frete (MOC 7.0, Anexo II, 3.1.10; NT 2016.002 e NT 2018.005). */
export const MOD_FRETE: Fonte & { readonly valores: Readonly<Record<string, string>> } = {
  source: 'MOC 7.0, Anexo II, 3.1.10',
  valores: {
    '0': '0-REMETENTE',
    '1': '1-DESTINATÁRIO',
    '2': '2-TERCEIROS',
    '3': '3-PRÓPRIO REMET.',
    '4': '4-PRÓPRIO DEST.',
    '9': '9-SEM FRETE',
  },
};

/** Forma de emissão (tpEmis, B22) como texto de contingência. */
export const FORMA_EMISSAO: Fonte & { readonly valores: Readonly<Record<string, string>> } = {
  source: 'MOC 7.0, Anexo I, campo B22 (tpEmis); NT 2026.002 v1.10 (tpEmis 9)',
  valores: {
    '2': 'CONTINGÊNCIA FS-IA',
    '3': 'CONTINGÊNCIA SCAN',
    '4': 'CONTINGÊNCIA EPEC',
    '5': 'CONTINGÊNCIA FS-DA',
    '6': 'CONTINGÊNCIA SVC-AN',
    '7': 'CONTINGÊNCIA SVC-RS',
    '9': 'CONTINGÊNCIA OFF-LINE',
  },
};

/** Textos fixos dos campos variáveis do DANFE (MOC 7.0, Anexo II, 3.9.1 e 3.9.3). */
export const CONSULTA_NFE: Fonte & { readonly normal: readonly string[]; readonly epec: readonly string[] } = {
  source: 'MOC 7.0, Anexo II, 3.9.1 e 3.9.3',
  normal: [
    'Consulta de autenticidade no portal nacional da NF-e',
    'www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora',
  ],
  epec: ['Consulta de autenticidade no portal da NF-e', 'www.nfe.fazenda.gov.br/portal'],
};
