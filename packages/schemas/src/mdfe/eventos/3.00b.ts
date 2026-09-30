// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_MDFe_300b_NT012025_1.05. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Eventos do MDF-e 3.00b: eventoMDFe, retEventoMDFe e procEventoMDFe, com o detEvento (xs:any) ligado como dado aos schemas específicos do PL (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e, pagamento da operação, confirmação do serviço e alteração do pagamento). O autorizador valida em duas etapas (envelope e schema do tipo pelo tpEvento, regra J06); a ligação por tpEvento fica com quem monta ou confere o evento.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - mdfe/PL_MDFe_300b_NT012025_1.05 (PL_MDFe_300b_NT012025_1.04.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "mdfe/eventos/3.00b",
  "documento": "mdfe",
  "pl": "PL_MDFe_300b_NT012025_1.05",
  "fontes": [
    {
      "pacote": "mdfe/PL_MDFe_300b_NT012025_1.05",
      "arquivo": "PL_MDFe_300b_NT012025_1.04.zip",
      "sha256": "fc53c880bd757d5b03b79de15dd7687259dfbfa38fed85e9ebb9c638b93854cc",
      "url": "https://dfe-portal.svrs.rs.gov.br/MDFE/DownloadArquivoEstatico/?sistema=MDFE&tipoArquivo=2&nomeArquivo=PL_MDFe_300b_NT012025_1.04.zip"
    }
  ]
};

// ---------- tipos ----------

/**
 * Schema XML de validação do evento do cancelamento
 * 110111
 * xsd: tipo anônimo de evCancMDFe
 */
export type evCancMDFe = {
  /** Descrição do Evento - “Cancelamento” */
  descEvento: "Cancelamento";
  /**
   * Número do Protocolo de Status do MDF-e.
   * 1 posição tipo de autorizador (9 -SEFAZ Nacional );
   * 2 posições ano;
   * 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
  /**
   * Justificativa do Cancelamento
   * xsd:TJust, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xJust: string;
};

/**
 * Tipo Código da UF da tabela do IBGE + 99 para Exterior
 * xsd:TCodUfIBGE_EX
 */
export type TCodUfIBGE_EX = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53" | "99";

/**
 * Schema XML de validação do evento do encerramento
 * 110112
 * xsd: tipo anônimo de evEncMDFe
 */
export type evEncMDFe = {
  /** Descrição do Evento - “Encerramento” */
  descEvento: "Encerramento";
  /**
   * Número do Protocolo de Status do MDF-e.
   * 1 posição tipo de autorizador (9 - SEFAZ Nacional );
   * 2 posições ano;
   * 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
  /**
   * Data que o Manifesto foi encerrado
   * xsd:TData
   */
  dtEnc: string;
  /**
   * UF de encerramento do Manifesto
   * xsd:TCodUfIBGE_EX
   */
  cUF: TCodUfIBGE_EX;
  /**
   * Código do Município de Encerramento do manifesto
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMun: string;
  /**
   * Indicador que deve ser informado quando o encerramento for registrado pelo transportador terceiro
   * Informar valor 1 quando o MDFe for encerrado pelo transportador terceiro, este sendo diferente do emitente do MDFe
   */
  indEncPorTerceiro?: "1";
};

/**
 * Informações do(s) Condutor(s) do veículo
 * xsd: tipo anônimo de evIncCondutorMDFe.condutor
 */
export type evIncCondutorMDFe_condutor = {
  /**
   * Nome do Condutor
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * CPF do Condutor
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
};

/**
 * Schema XML de validação do evento de inclusao de condutor 110114
 * xsd: tipo anônimo de evIncCondutorMDFe
 */
export type evIncCondutorMDFe = {
  /** Descrição do Evento - “Inclusao Condutor” */
  descEvento: "Inclusao Condutor";
  /** Informações do(s) Condutor(s) do veículo */
  condutor: evIncCondutorMDFe_condutor;
};

/**
 * Informações dos Documentos fiscais vinculados ao manifesto
 * xsd: tipo anônimo de evIncDFeMDFe.infDoc
 */
export type evIncDFeMDFe_infDoc = {
  /**
   * Código do Município de Descarregamento
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMunDescarga: string;
  /**
   * Nome do Município de Descarregamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMunDescarga: string;
  /**
   * Nota Fiscal Eletrônica
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chNFe: string;
};

/**
 * Schema XML de validação do evento de inclusão de DFe
 * 110115
 * xsd: tipo anônimo de evIncDFeMDFe
 */
export type evIncDFeMDFe = {
  /** Descrição do Evento - “Inclusão DF-e” */
  descEvento: "Inclusão DF-e" | "Inclusao DF-e";
  /**
   * Número do Protocolo de Status do MDF-e.
   * 1 posição tipo de autorizador (9 - SEFAZ Nacional );
   * 2 posições ano;
   * 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
  /**
   * Código do Município de Carregamento
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMunCarrega: string;
  /**
   * Nome do Município de Carregamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMunCarrega: string;
  /**
   * Informações dos Documentos fiscais vinculados ao manifesto
   * ocorre 1..n
   */
  infDoc: evIncDFeMDFe_infDoc[];
};

/**
 * Informações do total de viagens acobertadas pelo Evento “pagamento do frete”
 * xsd: tipo anônimo de evPagtoOperMDFe.infViagens
 */
export type evPagtoOperMDFe_infViagens = {
  /**
   * Quantidade total de viagens realizadas com o pagamento do Frete
   * pattern `[0-9]{5}`
   */
  qtdViagens: string;
  /**
   * Número de referência da viagem do MDFe referenciado.
   * pattern `[0-9]{5}`
   */
  nroViagem: string;
};

/**
 * Componentes do Pagamentoi do Frete
 * xsd: tipo anônimo de evPagtoOperMDFe.infPag.Comp
 */
export type evPagtoOperMDFe_infPag_Comp = {
  /**
   * Tipo do Componente
   * 01 - Vale Pedágio;
   * 02 - Impostos, taxas e contribuições;
   * 03 - Despesas (bancárias, meios de pagamento, outras)
   * 04 - Frete
   * 99 - Outros
   */
  tpComp: "01" | "02" | "03" | "04" | "99";
  /**
   * Valor do componente
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vComp: string;
  /**
   * Descrição do componente do tipo Outros
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xComp?: string;
};

/**
 * Informações do pagamento a prazo.
 * Informar somente se indPag for à Prazo
 * xsd: tipo anônimo de evPagtoOperMDFe.infPag.infPrazo
 */
export type evPagtoOperMDFe_infPag_infPrazo = {
  /**
   * Número da Parcela
   * pattern `[0-9]{3}`
   */
  nParcela: string;
  /**
   * Data de vencimento da Parcela (AAAA-MM-DD)
   * xsd:TData
   */
  dVenc: string;
  /**
   * Valor da Parcela
   * xsd:TDec_1302Opc, pattern `0\.[0-9]{1}[1-9]{1}|0\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vParcela: string;
};

/**
 * Informações bancárias
 * xsd: tipo anônimo de evPagtoOperMDFe.infPag.infBanc
 */
export type evPagtoOperMDFe_infPag_infBanc = {

} & (
  ({
  /**
   * Número do banco
   * xsd:TString, tamanho 3..5, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codBanco: string;
  /**
   * Número da agência bancária
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codAgencia: string;
  CNPJIPEF?: never; PIX?: never;
})
  | ({
  /**
   * Número do CNPJ da Instituição de Pagamento Eletrônico do Frete
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJIPEF: string;
  codBanco?: never; codAgencia?: never; PIX?: never;
})
  | ({
  /**
   * Chave PIX
   * Informar a chave PIX para recebimento do frete.
   * Pode ser email, CPF/ CNPJ (somente numeros), Telefone com a seguinte formatação (+5599999999999) ou a chave aleatória gerada pela instituição.
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  PIX: string;
  codBanco?: never; codAgencia?: never; CNPJIPEF?: never;
})
);

/**
 * Informações do Pagamento do Frete
 * xsd: tipo anônimo de evPagtoOperMDFe.infPag
 */
export type evPagtoOperMDFe_infPag = {
  /**
   * Razão social ou Nome do responsavel pelo pagamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome?: string;
  /**
   * Componentes do Pagamentoi do Frete
   * ocorre 1..n
   */
  Comp: evPagtoOperMDFe_infPag_Comp[];
  /**
   * Valor Total do Contrato
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vContrato: string;
  /** Indicador da Forma de Pagamento:0-Pagamento à Vista;1-Pagamento à Prazo; */
  indPag: "0" | "1";
  /**
   * Valor do Adiantamento (usar apenas em pagamento à Prazo
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vAdiant?: string;
  /**
   * Indicador para declarar concordância em antecipar o adiantamento
   * Operação de transporte com utilização de veículos de frotas dedicadas ou fidelizadas.
   * Preencher com “1” para indicar operação de transporte de alto desempenho, demais casos não informar a tag
   */
  indAntecipaAdiant?: "1";
  /**
   * Informações do pagamento a prazo.
   * Informar somente se indPag for à Prazo
   * ocorre 0..n
   */
  infPrazo?: evPagtoOperMDFe_infPag_infPrazo[];
  /**
   * Tipo de Permissão em relação a antecipação das parcelas
   * 0 - Não permite antecipar
   * 1 - Permite antecipar as parcelas
   * 2 - Permite antecipar as parcelas mediante confirmação
   */
  tpAntecip?: "0" | "1" | "2";
  /** Informações bancárias */
  infBanc: evPagtoOperMDFe_infPag_infBanc;
} & (
  ({
  /**
   * Número do CPF do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Número do CNPJ do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Identificador do responsável pelo pgto em caso de ser estrangeiro
   * tamanho 2..20, pattern `([!-ÿ]{0}|[!-ÿ]{5,20})?`
   */
  idEstrangeiro: string;
  CPF?: never; CNPJ?: never;
})
);

/**
 * Schema XML de validação do evento de pagamento da operação de transporte 110116
 * xsd: tipo anônimo de evPagtoOperMDFe
 */
export type evPagtoOperMDFe = {
  /** Descrição do Evento - “Pagamento Operação MDF-e” */
  descEvento: "Pagamento Operação MDF-e" | "Pagamento Operacao MDF-e";
  /**
   * Número do Protocolo de Status do MDF-e.
   * 1 posição tipo de autorizador (9 - SEFAZ Nacional );
   * 2 posições ano;
   * 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
  /** Informações do total de viagens acobertadas pelo Evento “pagamento do frete” */
  infViagens: evPagtoOperMDFe_infViagens;
  /**
   * Informações do Pagamento do Frete
   * ocorre 1..n
   */
  infPag: evPagtoOperMDFe_infPag[];
};

/**
 * Schema XML de validação do evento de confirmação do serviço de transporte 110117
 * xsd: tipo anônimo de evConfirmaServMDFe
 */
export type evConfirmaServMDFe = {
  /** Descrição do Evento - “Confirmação Serviço Transporte” */
  descEvento: "Confirmação Serviço Transporte" | "Confirmacao Servico Transporte";
  /**
   * Número do Protocolo de Status do MDF-e.
   * 1 posição tipo de autorizador (9 - SEFAZ Nacional );
   * 2 posições ano;
   * 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
};

/**
 * Componentes do Pagamentoi do Frete
 * xsd: tipo anônimo de evAlteracaoPagtoServMDFe.infPag.Comp
 */
export type evAlteracaoPagtoServMDFe_infPag_Comp = {
  /**
   * Tipo do Componente
   * 01 - Vale Pedágio;
   * 02 - Impostos, taxas e contribuições;
   * 03 - Despesas (bancárias, meios de pagamento, outras)
   * 04 - Frete
   * 99 - Outros
   */
  tpComp: "01" | "02" | "03" | "04" | "99";
  /**
   * Valor do componente
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vComp: string;
  /**
   * Descrição do componente do tipo Outros
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xComp?: string;
};

/**
 * Informações do pagamento a prazo.
 * Informar somente se indPag for à Prazo
 * xsd: tipo anônimo de evAlteracaoPagtoServMDFe.infPag.infPrazo
 */
export type evAlteracaoPagtoServMDFe_infPag_infPrazo = {
  /**
   * Número da Parcela
   * pattern `[0-9]{3}`
   */
  nParcela: string;
  /**
   * Data de vencimento da Parcela (AAAA-MM-DD)
   * xsd:TData
   */
  dVenc: string;
  /**
   * Valor da Parcela
   * xsd:TDec_1302Opc, pattern `0\.[0-9]{1}[1-9]{1}|0\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vParcela: string;
};

/**
 * Informações bancárias
 * xsd: tipo anônimo de evAlteracaoPagtoServMDFe.infPag.infBanc
 */
export type evAlteracaoPagtoServMDFe_infPag_infBanc = {

} & (
  ({
  /**
   * Número do banco
   * xsd:TString, tamanho 3..5, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codBanco: string;
  /**
   * Número da agência bancária
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codAgencia: string;
  CNPJIPEF?: never; PIX?: never;
})
  | ({
  /**
   * Número do CNPJ da Instituição de Pagamento Eletrônico do Frete
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJIPEF: string;
  codBanco?: never; codAgencia?: never; PIX?: never;
})
  | ({
  /**
   * Chave PIX
   * Informar a chave PIX para recebimento do frete.
   * Pode ser email, CPF/ CNPJ (somente numeros), Telefone com a seguinte formatação (+5599999999999) ou a chave aleatória gerada pela instituição.
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  PIX: string;
  codBanco?: never; codAgencia?: never; CNPJIPEF?: never;
})
);

/**
 * Informações do Pagamento do Frete
 * xsd: tipo anônimo de evAlteracaoPagtoServMDFe.infPag
 */
export type evAlteracaoPagtoServMDFe_infPag = {
  /**
   * Razão social ou Nome do responsavel pelo pagamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome?: string;
  /**
   * Componentes do Pagamentoi do Frete
   * ocorre 1..n
   */
  Comp: evAlteracaoPagtoServMDFe_infPag_Comp[];
  /**
   * Valor Total do Contrato
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vContrato: string;
  /** Indicador da Forma de Pagamento:0-Pagamento à Vista;1-Pagamento à Prazo; */
  indPag: "0" | "1";
  /**
   * Valor do Adiantamento (usar apenas em pagamento à Prazo
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vAdiant?: string;
  /**
   * Indicador para declarar concordância em antecipar o adiantamento
   * Operação de transporte com utilização de veículos de frotas dedicadas ou fidelizadas.
   * Preencher com “1” para indicar operação de transporte de alto desempenho, demais casos não informar a tag
   */
  indAntecipaAdiant?: "1";
  /**
   * Informações do pagamento a prazo.
   * Informar somente se indPag for à Prazo
   * ocorre 0..n
   */
  infPrazo?: evAlteracaoPagtoServMDFe_infPag_infPrazo[];
  /**
   * Tipo de Permissão em relação a antecipação das parcelas
   * 0 - Não permite antecipar
   * 1 - Permite antecipar as parcelas
   * 2 - Permite antecipar as parcelas mediante confirmação
   */
  tpAntecip?: "0" | "1" | "2";
  /** Informações bancárias */
  infBanc: evAlteracaoPagtoServMDFe_infPag_infBanc;
} & (
  ({
  /**
   * Número do CPF do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Número do CNPJ do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Identificador do responsável pelo pgto em caso de ser estrangeiro
   * tamanho 2..20, pattern `([!-ÿ]{0}|[!-ÿ]{5,20})?`
   */
  idEstrangeiro: string;
  CPF?: never; CNPJ?: never;
})
);

/**
 * Schema XML de validação do evento de alteração do pagamento do serviçp de transporte 110118
 * xsd: tipo anônimo de evAlteracaoPagtoServMDFe
 */
export type evAlteracaoPagtoServMDFe = {
  /** Descrição do Evento - “Alteração Pagamento Serviço MDFe” */
  descEvento: "Alteração Pagamento Serviço MDFe" | "Alteracao Pagamento Servico MDFe";
  /**
   * Número do Protocolo de Status do MDF-e.
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
  /**
   * Informações do Pagamento do Frete
   * ocorre 1..n
   */
  infPag: evAlteracaoPagtoServMDFe_infPag[];
};

/**
 * Detalhamento do evento específico
 * xsd: tipo anônimo de TEvento.infEvento.detEvento
 */
export type TEvento_infEvento_detEvento = {
  /** @attribute xsd:TVerEvento, pattern `3\.00` */
  versaoEvento: string;
} & (
  ({
  /**
   * Schema XML de validação do evento do cancelamento
   * 110111
   */
  evCancMDFe: evCancMDFe;
  evEncMDFe?: never; evIncCondutorMDFe?: never; evIncDFeMDFe?: never; evPagtoOperMDFe?: never; evConfirmaServMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /**
   * Schema XML de validação do evento do encerramento
   * 110112
   */
  evEncMDFe: evEncMDFe;
  evCancMDFe?: never; evIncCondutorMDFe?: never; evIncDFeMDFe?: never; evPagtoOperMDFe?: never; evConfirmaServMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /** Schema XML de validação do evento de inclusao de condutor 110114 */
  evIncCondutorMDFe: evIncCondutorMDFe;
  evCancMDFe?: never; evEncMDFe?: never; evIncDFeMDFe?: never; evPagtoOperMDFe?: never; evConfirmaServMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /**
   * Schema XML de validação do evento de inclusão de DFe
   * 110115
   */
  evIncDFeMDFe: evIncDFeMDFe;
  evCancMDFe?: never; evEncMDFe?: never; evIncCondutorMDFe?: never; evPagtoOperMDFe?: never; evConfirmaServMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /** Schema XML de validação do evento de pagamento da operação de transporte 110116 */
  evPagtoOperMDFe: evPagtoOperMDFe;
  evCancMDFe?: never; evEncMDFe?: never; evIncCondutorMDFe?: never; evIncDFeMDFe?: never; evConfirmaServMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /** Schema XML de validação do evento de confirmação do serviço de transporte 110117 */
  evConfirmaServMDFe: evConfirmaServMDFe;
  evCancMDFe?: never; evEncMDFe?: never; evIncCondutorMDFe?: never; evIncDFeMDFe?: never; evPagtoOperMDFe?: never; evAlteracaoPagtoServMDFe?: never;
})
  | ({
  /** Schema XML de validação do evento de alteração do pagamento do serviçp de transporte 110118 */
  evAlteracaoPagtoServMDFe: evAlteracaoPagtoServMDFe;
  evCancMDFe?: never; evEncMDFe?: never; evIncCondutorMDFe?: never; evIncDFeMDFe?: never; evPagtoOperMDFe?: never; evConfirmaServMDFe?: never;
})
);

/**
 * Grupo de informações do pedido de registro de evento da Nota Fiscal Fácil
 * xsd: tipo anônimo de TEvento.infEvento.infSolicNFF
 */
export type TEvento_infEvento_infSolicNFF = {
  /**
   * Solicitação do pedido de registro de evento da NFF.
   * Será preenchido com a totalidade de campos informados no aplicativo emissor serializado.
   * xsd:TString, tamanho 2..8000, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xSolic: string;
};

/**
 * Tipo que representa uma chave publica padrão RSA
 * xsd: TRSAKeyValueType
 */
export type TRSAKeyValueType = {
  Modulus: string;
  Exponent: string;
};

/**
 * Assinatura RSA do Emitente para DFe gerados por PAA
 * xsd: tipo anônimo de TEvento.infEvento.infPAA.PAASignature
 */
export type TEvento_infEvento_infPAA_PAASignature = {
  /**
   * Assinatura digital padrão RSA
   * Converter o atributo Id do DFe para array de bytes e assinar com a chave privada do RSA com algoritmo SHA1 gerando um valor no formato base64.
   */
  SignatureValue: string;
  /** Chave Publica no padrão XML RSA Key */
  RSAKeyValue: TRSAKeyValueType;
};

/**
 * Grupo de Informação do Provedor de Assinatura e Autorização
 * xsd: tipo anônimo de TEvento.infEvento.infPAA
 */
export type TEvento_infEvento_infPAA = {
  /**
   * CNPJ do Provedor de Assinatura e Autorização
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJPAA: string;
  /** Assinatura RSA do Emitente para DFe gerados por PAA */
  PAASignature: TEvento_infEvento_infPAA_PAASignature;
};

/**
 * Tipo Código de orgão (UF da tabela do IBGE + 90 SUFRAMA + 91 RFB + 92 BRId)
 * xsd:TCOrgaoIBGE
 */
export type TCOrgaoIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53" | "90" | "91" | "92" | "93" | "94";

/**
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

/** xsd: tipo anônimo de TEvento.infEvento */
export type TEvento_infEvento = {
  /**
   * Identificador da TAG a ser assinada, a regra de formação do Id é:
   * “ID” + tpEvento +  chave do MDF-e + nSeqEvento
   * @attribute pattern `ID[0-9]{12}[A-Z0-9]{12}[0-9]{28}|ID[0-9]{12}[A-Z0-9]{12}[0-9]{29}`
   */
  Id: string;
  /**
   * Código do órgão de recepção do Evento. Utilizar a Tabela do IBGE extendida, utilizar 90 para identificar SUFRAMA, 91 para RFB,  93 para ONE, 94 para SVBA
   * xsd:TCOrgaoIBGE
   */
  cOrgao: TCOrgaoIBGE;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Chave de Acesso do MDF-e vinculado ao evento
   * xsd:TChMDFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe: string;
  /**
   * Data e Hora do Evento, formato AAAA-MM-DDThh:mm:ss TZD
   * xsd:TDateTimeUTC
   */
  dhEvento: string;
  /**
   * Tipo do Evento:
   * 110111 - Cancelamento
   * 110112 - Encerramento
   * 110114 - Inclusão de Condutor
   * 310620 - Registro de Passagem
   * 510620 - Registro de Passagem BRId
   */
  tpEvento: string;
  /**
   * Seqüencial do evento para o mesmo tipo de evento.  Para maioria dos eventos será 1, nos casos em que possa existir mais de um evento o autor do evento deve numerar de forma seqüencial.
   * pattern `[0-9]{1,3}`
   */
  nSeqEvento: string;
  /** Detalhamento do evento específico */
  detEvento: TEvento_infEvento_detEvento;
  /** Grupo de informações do pedido de registro de evento da Nota Fiscal Fácil */
  infSolicNFF?: TEvento_infEvento_infSolicNFF;
  /** Grupo de Informação do Provedor de Assinatura e Autorização */
  infPAA?: TEvento_infEvento_infPAA;
} & (
  ({
  /**
   * CNPJ do autor
   * Informar zeros não significativos
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do Autor
   * Informar zeros não significativos.
   * Usar com serie específica 920-969 para emitente pessoa física com inscrição estadual, ou para emissor TAC do Regime Especial da Nota Fiscal Fácil
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/** xsd: tipo anônimo de SignedInfoType.CanonicalizationMethod */
export type SignedInfoType_CanonicalizationMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
};

/** xsd: tipo anônimo de SignedInfoType.SignatureMethod */
export type SignedInfoType_SignatureMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
};

/** xsd:TTransformURI */
export type TTransformURI = "http://www.w3.org/2000/09/xmldsig#enveloped-signature" | "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

/** xsd: TransformType */
export type TransformType = {
  /** @attribute xsd:TTransformURI */
  Algorithm: TTransformURI;
  /** ocorre 1..1 */
  XPath?: string[];
};

/** xsd: TransformsType */
export type TransformsType = {
  /** ocorre 2..2 */
  Transform: TransformType[];
};

/** xsd: tipo anônimo de ReferenceType.DigestMethod */
export type ReferenceType_DigestMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1";
};

/** xsd: ReferenceType */
export type ReferenceType = {
  /** @attribute */
  Id?: string;
  /** @attribute tamanho 2..* */
  URI: string;
  /** @attribute */
  Type?: string;
  Transforms: TransformsType;
  DigestMethod: ReferenceType_DigestMethod;
  /** xsd:DigestValueType */
  DigestValue: string;
};

/** xsd: SignedInfoType */
export type SignedInfoType = {
  /** @attribute */
  Id?: string;
  CanonicalizationMethod: SignedInfoType_CanonicalizationMethod;
  SignatureMethod: SignedInfoType_SignatureMethod;
  Reference: ReferenceType;
};

/** xsd: SignatureValueType */
export type SignatureValueType = {
  /** @attribute */
  Id?: string;
  $text: string;
};

/** xsd: X509DataType */
export type X509DataType = {
  X509Certificate: string;
};

/** xsd: KeyInfoType */
export type KeyInfoType = {
  /** @attribute */
  Id?: string;
  X509Data: X509DataType;
};

/** xsd: SignatureType */
export type SignatureType = {
  /** @attribute */
  Id?: string;
  SignedInfo: SignedInfoType;
  SignatureValue: SignatureValueType;
  KeyInfo: KeyInfoType;
};

/**
 * Tipo Evento
 * xsd: TEvento
 */
export type TEvento = {
  /** @attribute xsd:TVerEvento, pattern `3\.00` */
  versao: string;
  infEvento: TEvento_infEvento;
  Signature: SignatureType;
};

/** xsd: tipo anônimo de TRetEvento.infEvento */
export type TRetEvento_infEvento = {
  /** @attribute pattern `ID[0-9]{15}` */
  Id?: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que recebeu o Evento
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do órgão de recepção do Evento. Utilizar a Tabela do IBGE extendida, utilizar 90 para identificar SUFRAMA, 91 RFB, 92 BackOffice BRId e 93 ONE
   * xsd:TCOrgaoIBGE
   */
  cOrgao: TCOrgaoIBGE;
  /**
   * Código do status da registro do Evento
   * xsd:TStat, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do registro do Evento
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * Chave de Acesso MDF-e vinculado
   * xsd:TChMDFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe?: string;
  /**
   * Tipo do Evento vinculado
   * pattern `[0-9]{6}`
   */
  tpEvento?: string;
  /**
   * Descrição do Evento
   * xsd:TString, tamanho 5..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xEvento?: string;
  /**
   * Seqüencial do evento
   * pattern `[0-9]{1,3}`
   */
  nSeqEvento?: string;
  /**
   * Data e Hora de do recebimento do evento ou do registro do evento formato AAAA-MM-DDThh:mm:ss TZD
   * xsd:TDateTimeUTC
   */
  dhRegEvento?: string;
  /**
   * Número do protocolo de registro do evento
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt?: string;
};

/**
 * Tipo retorno do Evento
 * xsd: TRetEvento
 */
export type TRetEvento = {
  /** @attribute xsd:TVerEvento, pattern `3\.00` */
  versao: string;
  infEvento: TRetEvento_infEvento;
  Signature?: SignatureType;
};

/**
 * Tipo procEvento
 * xsd: TProcEvento
 */
export type TProcEvento = {
  /** @attribute xsd:TVerEvento, pattern `3\.00` */
  versao: string;
  /**
   * IP do transmissor do documento fiscal para o ambiente autorizador
   * @attribute xsd:TIPv4
   */
  ipTransmissor?: string;
  /**
   * Porta de origem utilizada na conexão (De 0 a 65535)
   * @attribute pattern `[0-9]{1,5}`
   */
  nPortaCon?: string;
  /**
   * Data e Hora da Conexão de Origem
   * @attribute xsd:TDateTimeUTC
   */
  dhConexao?: string;
  eventoMDFe: TEvento;
  retEventoMDFe: TRetEvento;
};


// ---------- descritores de tipo simples ----------
const st_TVerEvento: SimpleType = { b: "string", p: [["3\\.00"]], nm: "TVerEvento" };
const st$0: SimpleType = { b: "ID", p: [["ID[0-9]{12}[A-Z0-9]{12}[0-9]{28}|ID[0-9]{12}[A-Z0-9]{12}[0-9]{29}"]] };
const st_TCOrgaoIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53","90","91","92","93","94"], nm: "TCOrgaoIBGE" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TCnpj: SimpleType = { b: "string", p: [["[A-Z0-9]{12}[0-9]{2}"]], nm: "TCnpj" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], nm: "TCpf" };
const st_TChMDFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChMDFe" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st$1: SimpleType = { b: "string" };
const st$2: SimpleType = { b: "string", p: [["[0-9]{1,3}"]] };
const st$3: SimpleType = { b: "string", e: ["Cancelamento"] };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}"]], nm: "TProt" };
const st_TJust: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 15, mx: 255, nm: "TJust" };
const st$4: SimpleType = { b: "string", e: ["Encerramento"] };
const st_TData: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))"]], nm: "TData" };
const st_TCodUfIBGE_EX: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53","99"], nm: "TCodUfIBGE_EX" };
const st_TCodMunIBGE: SimpleType = { b: "string", p: [["[0-9]{7}"]], nm: "TCodMunIBGE" };
const st$5: SimpleType = { b: "string", e: ["1"] };
const st$6: SimpleType = { b: "string", e: ["Inclusao Condutor"] };
const st$7: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 2, mx: 60, nm: "TString" };
const st$8: SimpleType = { b: "string", e: ["Inclusão DF-e","Inclusao DF-e"] };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChNFe" };
const st$9: SimpleType = { b: "string", e: ["Pagamento Operação MDF-e","Pagamento Operacao MDF-e"] };
const st$10: SimpleType = { b: "string", p: [["[0-9]{5}"]] };
const st_TCnpjOpc: SimpleType = { b: "string", p: [["[0-9]{0}|[A-Z0-9]{12}[0-9]{2}"]], nm: "TCnpjOpc" };
const st$11: SimpleType = { b: "string", p: [["([!-ÿ]{0}|[!-ÿ]{5,20})?"]], mn: 2, mx: 20 };
const st$12: SimpleType = { b: "string", e: ["01","02","03","04","99"] };
const st_TDec_1302: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\\.[0-9]{2})?"]], nm: "TDec_1302" };
const st$13: SimpleType = { b: "string", e: ["0","1"] };
const st$14: SimpleType = { b: "string", p: [["[0-9]{3}"]] };
const st_TDec_1302Opc: SimpleType = { b: "string", p: [["0\\.[0-9]{1}[1-9]{1}|0\\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\\.[0-9]{2})?"]], nm: "TDec_1302Opc" };
const st$15: SimpleType = { b: "string", e: ["0","1","2"] };
const st$16: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 3, mx: 5, nm: "TString" };
const st$17: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 10, nm: "TString" };
const st$18: SimpleType = { b: "string", e: ["Confirmação Serviço Transporte","Confirmacao Servico Transporte"] };
const st$19: SimpleType = { b: "string", e: ["Alteração Pagamento Serviço MDFe","Alteracao Pagamento Servico MDFe"] };
const st$20: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 2, mx: 8000, nm: "TString" };
const st$21: SimpleType = { b: "base64Binary" };
const st$22: SimpleType = { b: "ID" };
const st$23: SimpleType = { b: "anyURI" };
const st$24: SimpleType = { b: "anyURI", mn: 2 };
const st_TTransformURI: SimpleType = { b: "anyURI", e: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], nm: "TTransformURI" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st$25: SimpleType = { b: "ID", p: [["ID[0-9]{15}"]] };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st$26: SimpleType = { b: "string", p: [["[0-9]{6}"]] };
const st$27: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 5, mx: 60, nm: "TString" };
const st_TIPv4: SimpleType = { b: "string", p: [["(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])"]], nm: "TIPv4" };
const st$28: SimpleType = { b: "string", p: [["[0-9]{1,5}"]] };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const evCancMDFe: ComplexType<evCancMDFe> = { id: "evCancMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$3 }, { e: "nProt", t: st_TProt }, { e: "xJust", t: st_TJust }] } };
export const evEncMDFe: ComplexType<evEncMDFe> = { id: "evEncMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$4 }, { e: "nProt", t: st_TProt }, { e: "dtEnc", t: st_TData }, { e: "cUF", t: st_TCodUfIBGE_EX }, { e: "cMun", t: st_TCodMunIBGE }, { e: "indEncPorTerceiro", t: st$5, n: 0 }] } };
export const evIncCondutorMDFe_condutor: ComplexType<evIncCondutorMDFe_condutor> = { id: "evIncCondutorMDFe.condutor", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7 }, { e: "CPF", t: st_TCpf }] } };
export const evIncCondutorMDFe: ComplexType<evIncCondutorMDFe> = { id: "evIncCondutorMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$6 }, { e: "condutor", t: evIncCondutorMDFe_condutor }] } };
export const evIncDFeMDFe_infDoc: ComplexType<evIncDFeMDFe_infDoc> = { id: "evIncDFeMDFe.infDoc", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cMunDescarga", t: st_TCodMunIBGE }, { e: "xMunDescarga", t: st$7 }, { e: "chNFe", t: st_TChNFe }] } };
export const evIncDFeMDFe: ComplexType<evIncDFeMDFe> = { id: "evIncDFeMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$8 }, { e: "nProt", t: st_TProt }, { e: "cMunCarrega", t: st_TCodMunIBGE }, { e: "xMunCarrega", t: st$7 }, { e: "infDoc", t: evIncDFeMDFe_infDoc, x: -1 }] } };
export const evPagtoOperMDFe_infViagens: ComplexType<evPagtoOperMDFe_infViagens> = { id: "evPagtoOperMDFe.infViagens", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "qtdViagens", t: st$10 }, { e: "nroViagem", t: st$10 }] } };
export const evPagtoOperMDFe_infPag_Comp: ComplexType<evPagtoOperMDFe_infPag_Comp> = { id: "evPagtoOperMDFe.infPag.Comp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpComp", t: st$12 }, { e: "vComp", t: st_TDec_1302 }, { e: "xComp", t: st$7, n: 0 }] } };
export const evPagtoOperMDFe_infPag_infPrazo: ComplexType<evPagtoOperMDFe_infPag_infPrazo> = { id: "evPagtoOperMDFe.infPag.infPrazo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nParcela", t: st$14 }, { e: "dVenc", t: st_TData }, { e: "vParcela", t: st_TDec_1302Opc }] } };
export const evPagtoOperMDFe_infPag_infBanc: ComplexType<evPagtoOperMDFe_infPag_infBanc> = { id: "evPagtoOperMDFe.infPag.infBanc", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "c", i: [{ g: "s", i: [{ e: "codBanco", t: st$16 }, { e: "codAgencia", t: st$17 }] }, { e: "CNPJIPEF", t: st_TCnpjOpc }, { e: "PIX", t: st$7 }] } };
export const evPagtoOperMDFe_infPag: ComplexType<evPagtoOperMDFe_infPag> = { id: "evPagtoOperMDFe.infPag", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7, n: 0 }, { g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }, { e: "idEstrangeiro", t: st$11 }] }, { e: "Comp", t: evPagtoOperMDFe_infPag_Comp, x: -1 }, { e: "vContrato", t: st_TDec_1302 }, { e: "indPag", t: st$13 }, { e: "vAdiant", t: st_TDec_1302, n: 0 }, { e: "indAntecipaAdiant", t: st$5, n: 0 }, { e: "infPrazo", t: evPagtoOperMDFe_infPag_infPrazo, n: 0, x: -1 }, { e: "tpAntecip", t: st$15, n: 0 }, { e: "infBanc", t: evPagtoOperMDFe_infPag_infBanc }] } };
export const evPagtoOperMDFe: ComplexType<evPagtoOperMDFe> = { id: "evPagtoOperMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$9 }, { e: "nProt", t: st_TProt }, { e: "infViagens", t: evPagtoOperMDFe_infViagens }, { e: "infPag", t: evPagtoOperMDFe_infPag, x: -1 }] } };
export const evConfirmaServMDFe: ComplexType<evConfirmaServMDFe> = { id: "evConfirmaServMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$18 }, { e: "nProt", t: st_TProt }] } };
export const evAlteracaoPagtoServMDFe_infPag_Comp: ComplexType<evAlteracaoPagtoServMDFe_infPag_Comp> = { id: "evAlteracaoPagtoServMDFe.infPag.Comp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpComp", t: st$12 }, { e: "vComp", t: st_TDec_1302 }, { e: "xComp", t: st$7, n: 0 }] } };
export const evAlteracaoPagtoServMDFe_infPag_infPrazo: ComplexType<evAlteracaoPagtoServMDFe_infPag_infPrazo> = { id: "evAlteracaoPagtoServMDFe.infPag.infPrazo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nParcela", t: st$14 }, { e: "dVenc", t: st_TData }, { e: "vParcela", t: st_TDec_1302Opc }] } };
export const evAlteracaoPagtoServMDFe_infPag_infBanc: ComplexType<evAlteracaoPagtoServMDFe_infPag_infBanc> = { id: "evAlteracaoPagtoServMDFe.infPag.infBanc", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "c", i: [{ g: "s", i: [{ e: "codBanco", t: st$16 }, { e: "codAgencia", t: st$17 }] }, { e: "CNPJIPEF", t: st_TCnpjOpc }, { e: "PIX", t: st$7 }] } };
export const evAlteracaoPagtoServMDFe_infPag: ComplexType<evAlteracaoPagtoServMDFe_infPag> = { id: "evAlteracaoPagtoServMDFe.infPag", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7, n: 0 }, { g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }, { e: "idEstrangeiro", t: st$11 }] }, { e: "Comp", t: evAlteracaoPagtoServMDFe_infPag_Comp, x: -1 }, { e: "vContrato", t: st_TDec_1302 }, { e: "indPag", t: st$13 }, { e: "vAdiant", t: st_TDec_1302, n: 0 }, { e: "indAntecipaAdiant", t: st$5, n: 0 }, { e: "infPrazo", t: evAlteracaoPagtoServMDFe_infPag_infPrazo, n: 0, x: -1 }, { e: "tpAntecip", t: st$15, n: 0 }, { e: "infBanc", t: evAlteracaoPagtoServMDFe_infPag_infBanc }] } };
export const evAlteracaoPagtoServMDFe: ComplexType<evAlteracaoPagtoServMDFe> = { id: "evAlteracaoPagtoServMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "descEvento", t: st$19 }, { e: "nProt", t: st_TProt }, { e: "infPag", t: evAlteracaoPagtoServMDFe_infPag, x: -1 }] } };
export const TEvento_infEvento_detEvento: ComplexType<TEvento_infEvento_detEvento> = { id: "TEvento.infEvento.detEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versaoEvento", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ g: "c", i: [{ e: "evCancMDFe", t: evCancMDFe }, { e: "evEncMDFe", t: evEncMDFe }, { e: "evIncCondutorMDFe", t: evIncCondutorMDFe }, { e: "evIncDFeMDFe", t: evIncDFeMDFe }, { e: "evPagtoOperMDFe", t: evPagtoOperMDFe }, { e: "evConfirmaServMDFe", t: evConfirmaServMDFe }, { e: "evAlteracaoPagtoServMDFe", t: evAlteracaoPagtoServMDFe }] }] } };
export const TEvento_infEvento_infSolicNFF: ComplexType<TEvento_infEvento_infSolicNFF> = { id: "TEvento.infEvento.infSolicNFF", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xSolic", t: st$20 }] } };
export const TRSAKeyValueType: ComplexType<TRSAKeyValueType> = { id: "TRSAKeyValueType", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "Modulus", t: st$21 }, { e: "Exponent", t: st$21 }] } };
export const TEvento_infEvento_infPAA_PAASignature: ComplexType<TEvento_infEvento_infPAA_PAASignature> = { id: "TEvento.infEvento.infPAA.PAASignature", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "SignatureValue", t: st$21 }, { e: "RSAKeyValue", t: TRSAKeyValueType }] } };
export const TEvento_infEvento_infPAA: ComplexType<TEvento_infEvento_infPAA> = { id: "TEvento.infEvento.infPAA", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "CNPJPAA", t: st_TCnpj }, { e: "PAASignature", t: TEvento_infEvento_infPAA_PAASignature }] } };
export const TEvento_infEvento: ComplexType<TEvento_infEvento> = { id: "TEvento.infEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "Id", t: st$0, r: 1 }], c: { g: "s", i: [{ e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "tpAmb", t: st_TAmb }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }, { e: "chMDFe", t: st_TChMDFe }, { e: "dhEvento", t: st_TDateTimeUTC }, { e: "tpEvento", t: st$1 }, { e: "nSeqEvento", t: st$2 }, { e: "detEvento", t: TEvento_infEvento_detEvento }, { e: "infSolicNFF", t: TEvento_infEvento_infSolicNFF, n: 0 }, { e: "infPAA", t: TEvento_infEvento_infPAA, n: 0 }] } };
export const SignedInfoType_CanonicalizationMethod: ComplexType<SignedInfoType_CanonicalizationMethod> = { id: "SignedInfoType.CanonicalizationMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$23, r: 1, f: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }] };
export const SignedInfoType_SignatureMethod: ComplexType<SignedInfoType_SignatureMethod> = { id: "SignedInfoType.SignatureMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$23, r: 1, f: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }] };
export const TransformType: ComplexType<TransformType> = { id: "TransformType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st_TTransformURI, r: 1 }], c: { g: "s", i: [{ e: "XPath", t: st$1 }], n: 0, x: -1 } };
export const TransformsType: ComplexType<TransformsType> = { id: "TransformsType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "Transform", t: TransformType, n: 2, x: 2 }] } };
export const ReferenceType_DigestMethod: ComplexType<ReferenceType_DigestMethod> = { id: "ReferenceType.DigestMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$23, r: 1, f: "http://www.w3.org/2000/09/xmldsig#sha1" }] };
export const ReferenceType: ComplexType<ReferenceType> = { id: "ReferenceType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$22 }, { a: "URI", t: st$24, r: 1 }, { a: "Type", t: st$23 }], c: { g: "s", i: [{ e: "Transforms", t: TransformsType, u: ["Algorithm"] }, { e: "DigestMethod", t: ReferenceType_DigestMethod }, { e: "DigestValue", t: st_DigestValueType }] } };
export const SignedInfoType: ComplexType<SignedInfoType> = { id: "SignedInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$22 }], c: { g: "s", i: [{ e: "CanonicalizationMethod", t: SignedInfoType_CanonicalizationMethod }, { e: "SignatureMethod", t: SignedInfoType_SignatureMethod }, { e: "Reference", t: ReferenceType }] } };
export const SignatureValueType: ComplexType<SignatureValueType> = { id: "SignatureValueType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$22 }], tx: st$21 };
export const X509DataType: ComplexType<X509DataType> = { id: "X509DataType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "X509Certificate", t: st$21 }] } };
export const KeyInfoType: ComplexType<KeyInfoType> = { id: "KeyInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$22 }], c: { g: "s", i: [{ e: "X509Data", t: X509DataType }] } };
export const SignatureType: ComplexType<SignatureType> = { id: "SignatureType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$22 }], c: { g: "s", i: [{ e: "SignedInfo", t: SignedInfoType }, { e: "SignatureValue", t: SignatureValueType }, { e: "KeyInfo", t: KeyInfoType }] } };
export const TEvento: ComplexType<TEvento> = { id: "TEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TEvento_infEvento }, { e: "Signature", t: SignatureType, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TRetEvento_infEvento: ComplexType<TRetEvento_infEvento> = { id: "TRetEvento.infEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "Id", t: st$25 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "chMDFe", t: st_TChMDFe, n: 0 }, { e: "tpEvento", t: st$26, n: 0 }, { e: "xEvento", t: st$27, n: 0 }, { e: "nSeqEvento", t: st$2, n: 0 }, { e: "dhRegEvento", t: st_TDateTimeUTC, n: 0 }, { e: "nProt", t: st_TProt, n: 0 }] } };
export const TRetEvento: ComplexType<TRetEvento> = { id: "TRetEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TRetEvento_infEvento }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TProcEvento: ComplexType<TProcEvento> = { id: "TProcEvento", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }, { a: "ipTransmissor", t: st_TIPv4 }, { a: "nPortaCon", t: st$28 }, { a: "dhConexao", t: st_TDateTimeUTC }], c: { g: "s", i: [{ e: "eventoMDFe", t: TEvento }, { e: "retEventoMDFe", t: TRetEvento }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `eventoMDFe` (tipo TEvento). */
export const eventoMDFeElement: ElementoRaiz<TEvento> = { nome: "eventoMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: TEvento };
/** Elemento raiz `retEventoMDFe` (tipo TRetEvento). */
export const retEventoMDFeElement: ElementoRaiz<TRetEvento> = { nome: "retEventoMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: TRetEvento };
/** Elemento raiz `procEventoMDFe` (tipo TProcEvento). */
export const procEventoMDFeElement: ElementoRaiz<TProcEvento> = { nome: "procEventoMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: TProcEvento };
