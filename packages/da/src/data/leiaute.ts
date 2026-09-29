/**
 * Medidas e textos comuns aos documentos auxiliares, como dados (ADR 0006, decisão 2), cada grupo com a origem. Os de
 * um documento só ficam em arquivos próprios (`leiaute-a4.ts`, `leiaute-bobina.ts`, `leiaute-mdfe.ts`), para que quem
 * importa um subpath do `@sinete/da` não leve ao bundle os dados de outro documento.
 */

export interface Fonte {
  readonly source: string;
}

/**
 * Situação do protocolo da NF-e e da NFC-e. Só o `protNFe` com cStat de autorização dá valor fiscal ao documento; a
 * denegação também tem protocolo, mas o uso como documento fiscal é vedado (MOC 7.0, Visão Geral, 5.1.6, tabela 5-4).
 * O cancelamento não vem da SEFAZ no `protNFe` (a consulta devolve o `protNFe` de autorização ou denegação e o
 * cancelamento à parte, Visão Geral, 5.4.2, ER08 a ER10), mas sistemas que importam a nota gravam no `protNFe` o cStat
 * da situação atual: 101 e 151 (Anexo I, tabela 4.4.1) ou o 155 do evento fora de prazo (Visão Geral, 5.9.4).
 * Os motivos são os textos oficiais das tabelas; o mesmo conjunto está em `@sinete/nfe` (`data/cstat.json`).
 */
export const SITUACAO_NFE: Fonte & {
  readonly autorizada: readonly string[];
  readonly denegada: Readonly<Record<string, string>>;
  readonly cancelada: readonly string[];
} = {
  source:
    'MOC 7.0, Anexo I, tabela 4.4.1 (100, 101, 110, 150 e 151) e tabela 4.4.3 (301, 302 e 303); Visão Geral, 5.1.6, 5.4.2 e 5.9.4 (155)',
  autorizada: ['100', '150'],
  denegada: {
    '110': 'Uso Denegado',
    '301': 'Uso Denegado: Irregularidade fiscal do emitente',
    '302': 'Uso Denegado: Irregularidade fiscal do destinatário',
    '303': 'Uso Denegado: Destinatário não habilitado a operar na UF',
  },
  cancelada: ['101', '151', '155'],
};

/**
 * Situação do protocolo do MDF-e. O MDF-e não tem denegação: a validação termina em rejeição ou em autorização de uso
 * (MOC MDF-e 3.00b, Visão Geral, 4.2.6), e os cStat 301 a 303 do MDF-e são rejeições. Depois da autorização, a consulta
 * devolve a situação atual (4.3.6): 101 depois do cancelamento (6.1.2) e 132 depois do encerramento (6.2.2), e é esse
 * cStat que o sistema que importa o MDF-e costuma gravar no `protMDFe`. O encerrado é um MDF-e autorizado que
 * terminou o percurso: continua valendo, sem marca.
 */
export const SITUACAO_MDFE: Fonte & {
  readonly autorizada: readonly string[];
  readonly cancelada: readonly string[];
  readonly encerrada: readonly string[];
} = {
  source: 'MOC MDF-e 3.00b, Visão Geral, 4.2.6 e 4.3.6 (100, 101 e 132), 6.1.2 (101) e 6.2.2 (132)',
  autorizada: ['100'],
  cancelada: ['101'],
  encerrada: ['132'],
};

/**
 * Formas de emissão em contingência em que o documento auxiliar vale antes do protocolo, porque a autorização vem
 * depois da circulação: FS-IA e FS-DA (MOC 7.0, Anexo II, 3.9.2), off-line da NFC-e e do Tipo 2 (NT 2026.002 v1.10;
 * NT 2026.003, 3.1.9) e o EPEC, só depois do registro do evento (Anexo II, 3.9.3: "Após o registro do EPEC o emissor
 * poderá imprimir o DANFE"). SVC-AN, SVC-RS e SCAN são formas conclusivas, com autorização antes da impressão (3.9.1),
 * como a emissão normal. No MDF-e, a contingência off-line é o `tpEmis` 2 (MOC MDF-e 3.00b, Visão Geral, 11.1).
 */
export const CONTINGENCIA_OFFLINE: Fonte & {
  readonly nfe: readonly string[];
  readonly epec: string;
  readonly mdfe: readonly string[];
} = {
  source:
    'MOC 7.0, Anexo II, 3, 3.9.1 a 3.9.3; NT 2026.002 v1.10; NT 2026.003, 3.1.9; MOC MDF-e 3.00b, Visão Geral, 11.1',
  nfe: ['2', '5', '9'],
  epec: '4',
  mdfe: ['2'],
};

/**
 * Textos das marcas d'água. "SEM VALOR FISCAL" é a frase do MOC 7.0, Anexo II, 3 (homologação), estendida ao documento
 * sem protocolo de autorização de uso, que a Visão Geral (2.3.1 e 2.3.2.1) não admite na emissão normal; o segundo
 * texto usa o nome do campo 2 (3.9.1). Contingência: "EMITIDA EM CONTINGÊNCIA" e "Pendente de autorização" (NT
 * 2026.003, 3.1.9), e "EMISSÃO EM CONTINGÊNCIA" no DAMDFE (MOC MDF-e 3.00a, Anexo II, 2.4). Denegada: o motivo sai da
 * tabela 4.4.3 (`SITUACAO_NFE`).
 */
export const MARCAS: Fonte & {
  readonly semValor: string;
  readonly semProtocolo: string;
  readonly homologacao: string;
  readonly contingencia: readonly string[];
  readonly contingenciaMdfe: readonly string[];
  readonly denegada: string;
} = {
  source:
    'MOC 7.0, Anexo II, 3 e 3.9.1; Visão Geral, 2.3.1, 2.3.2.1 e 5.1.6; NT 2026.003, 3.1.9; MOC MDF-e 3.00a, Anexo II, 2.4 e 2.5',
  semValor: 'SEM VALOR FISCAL',
  semProtocolo: 'SEM PROTOCOLO DE AUTORIZAÇÃO DE USO',
  homologacao: 'AMBIENTE DE HOMOLOGAÇÃO',
  contingencia: ['EMITIDA EM CONTINGÊNCIA', 'PENDENTE DE AUTORIZAÇÃO'],
  contingenciaMdfe: ['EMISSÃO EM CONTINGÊNCIA', 'PENDENTE DE AUTORIZAÇÃO'],
  denegada: 'DENEGADA',
};
