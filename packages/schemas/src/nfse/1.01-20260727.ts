// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de NFSe_v1.01_20260727. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * NFS-e Nacional, leiaute 1.01 com CNPJ alfanumérico (esquemas XSD de 27/07/2026, produção restrita desde 27/07/2026 e produção desde 10/08/2026): DPS, NFSe, pedRegEvento e evento. Grupos IBS/CBS da NT SE/CGNFS-e 004.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfse/NFSe_v1.01_20260727 (esquemas-nfse-rtc-v1-01-20260727.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "nfse/1.01-20260727",
  "documento": "nfse",
  "pl": "NFSe_v1.01_20260727",
  "fontes": [
    {
      "pacote": "nfse/NFSe_v1.01_20260727",
      "arquivo": "esquemas-nfse-rtc-v1-01-20260727.zip",
      "sha256": "6c7e0510d3ecff4454f291f4e10b742d27a4818f23aab181494f96d0ea79f3dc",
      "url": "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas-nfse-rtc-v1-01-20260727.zip"
    }
  ]
};

// ---------- tipos ----------

/**
 * Código de justificativa para substituição de NFS-e:
 * 01 - Desenquadramento de NFS-e do Simples Nacional;
 * 02 - Enquadramento de NFS-e no Simples Nacional;
 * 03 - Inclusão Retroativa de Imunidade/Isenção para NFS-e;
 * 04 - Exclusão Retroativa de Imunidade/Isenção para NFS-e;
 * 05 - Rejeição de NFS-e pelo tomador ou pelo intermediário se responsável pelo recolhimento do tributo;
 * 99 - Outros;
 * xsd:TSCodJustSubst
 */
export type TSCodJustSubst = "01" | "02" | "03" | "04" | "05" | "99";

/** xsd: TCSubstituicao */
export type TCSubstituicao = {
  /**
   * Chave de acesso da NFS-e a ser substituída
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   */
  chSubstda: string;
  /**
   * Código de justificativa para substituição de NFS-e:
   * 01 - Desenquadramento de NFS-e do Simples Nacional;
   * 02 - Enquadramento de NFS-e no Simples Nacional;
   * 03 - Inclusão Retroativa de Imunidade/Isenção para NFS-e;
   * 04 - Exclusão Retroativa de Imunidade/Isenção para NFS-e;
   * 05 - Rejeição de NFS-e pelo tomador ou pelo intermediário se responsável pelo recolhimento do tributo;
   * 99 - Outros;
   * xsd:TSCodJustSubst
   */
  cMotivo: TSCodJustSubst;
  /**
   * Descrição do motivo da substituição da NFS-e
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo?: string;
};

/** xsd: TCEnderNac */
export type TCEnderNac = {
  /**
   * Código do município, conforme Tabela do IBGE
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cMun: string;
  /**
   * Número do CEP
   * xsd:TSCEP, pattern `[0-9]{8}`
   */
  CEP: string;
};

/** xsd: TCEnderExt */
export type TCEnderExt = {
  /**
   * Código do país (Tabela de Países ISO)
   * xsd:TSCodPaisISO, pattern `[A-Z]{2}`
   */
  cPais: string;
  /**
   * Código alfanumérico do Endereçamento Postal no exterior do prestador do serviço.
   * xsd:TSCodigoEndPostal, tamanho 1..11
   */
  cEndPost: string;
  /**
   * Nome da cidade no exterior do prestador do serviço.
   * xsd:TSCidade, tamanho 1..60
   */
  xCidade: string;
  /**
   * Estado, província ou região da cidade no exterior do prestador do serviço.
   * xsd:TSEstadoProvRegiao, tamanho 1..60
   */
  xEstProvReg: string;
};

/** xsd: TCEndereco */
export type TCEndereco = {
  /**
   * Tipo e nome do logradouro da localização do imóvel
   * xsd:TSLogradouro, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr: string;
  /**
   * Número do imóvel
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro: string;
  /**
   * Complemento do endereço
   * xsd:TSComplementoEndereco, tamanho 1..156, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TSBairro, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro: string;
} & (
  ({
  /** Grupo de informações específicas de endereço nacional */
  endNac: TCEnderNac;
  endExt?: never;
})
  | ({
  /** Grupo de informações específicas de endereço no exterior */
  endExt: TCEnderExt;
  endNac?: never;
})
);

/**
 * Situação perante o Simples Nacional:
 * 1 - Não Optante;
 * 2 - Optante - Microempreendedor Individual (MEI);
 * 3 - Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP);
 * xsd:TSOpSimpNac
 */
export type TSOpSimpNac = "1" | "2" | "3";

/**
 * Opção para que o contribuinte optante pelo Simples Nacional ME/EPP (opSimpNac = 3) possa indicar, ao emitir o documento fiscal, em qual regime de apuração os tributos federais e municipal estão inseridos, caso tenha ultrapassado algum sublimite ou limite definido para o Simples Nacional.
 * 1 – Regime de apuração dos tributos federais e municipal pelo SN;
 * 2 – Regime de apuração dos tributos federais pelo SN e ISSQN  por fora do SN conforme respectiva legislação municipal do tributo;
 * 3 – Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo;
 * xsd:TSRegimeApuracaoSimpNac
 */
export type TSRegimeApuracaoSimpNac = "1" | "2" | "3";

/**
 * Tipos de Regimes Especiais de Tributação:
 * 0 - Nenhum;
 * 1 - Ato Cooperado (Cooperativa);
 * 2 - Estimativa;
 * 3 - Microempresa Municipal;
 * 4 - Notário ou Registrador;
 * 5 - Profissional Autônomo;
 * 6 - Sociedade de Profissionais;
 * 9 - Outros;
 * xsd:TSRegEspTrib
 */
export type TSRegEspTrib = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9";

/** xsd: TCRegTrib */
export type TCRegTrib = {
  /**
   * Situação perante o Simples Nacional:
   * 1 - Não Optante;
   * 2 - Optante - Microempreendedor Individual (MEI);
   * 3 - Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP);
   * xsd:TSOpSimpNac
   */
  opSimpNac: TSOpSimpNac;
  /**
   * Opção para que o contribuinte optante pelo Simples Nacional ME/EPP (opSimpNac = 3) possa indicar, ao emitir o documento fiscal, em qual regime de apuração os tributos federais e municipal estão inseridos, caso tenha ultrapassado algum sublimite ou limite definido para o Simples Nacional.
   * 1 – Regime de apuração dos tributos federais e municipal pelo SN;
   * 2 – Regime de apuração dos tributos federais pelo SN e ISSQN  por fora do SN conforme respectiva legislação municipal do tributo;
   * 3 – Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo;
   * xsd:TSRegimeApuracaoSimpNac
   */
  regApTribSN?: TSRegimeApuracaoSimpNac;
  /**
   * Tipos de Regimes Especiais de Tributação:
   * 0 - Nenhum;
   * 1 - Ato Cooperado (Cooperativa);
   * 2 - Estimativa;
   * 3 - Microempresa Municipal;
   * 4 - Notário ou Registrador;
   * 5 - Profissional Autônomo;
   * 6 - Sociedade de Profissionais;
   * 9 - Outros;
   * xsd:TSRegEspTrib
   */
  regEspTrib: TSRegEspTrib;
};

/**
 * Motivo para não informação do NIF:
 * 0 - Não informado na nota de origem;
 * 1 - Dispensado do NIF;
 * 2 - Não exigência do NIF;
 * xsd:TSCodNaoNIF
 */
export type TSCodNaoNIF = "0" | "1" | "2";

/**
 * Informações do prestador da NFS-e. Difere das demais pessoas por causa das informações de regimes de tributação
 * xsd: TCInfoPrestador
 */
export type TCInfoPrestador = {
  /**
   * Número do Cadastro de Atividade Econômica da Pessoa Física (CAEPF) do prestador do serviço.
   * xsd:TSCAEPF, tamanho 0..14, pattern `[0-9]{14}`
   */
  CAEPF?: string;
  /**
   * Número da inscrição municipal
   * xsd:TSInscMun, tamanho 1..15
   */
  IM?: string;
  /**
   * Nome/Nome Empresarial do prestador
   * xsd:TSNomeRazaoSocial, tamanho 1..300
   */
  xNome?: string;
  /** Dados de endereço do prestador */
  end?: TCEndereco;
  /**
   * Número do telefone do prestador:
   * Preencher com o Código DDD + número do telefone.
   * Nas operações com exterior é permitido informar o código do país + código da localidade + número do telefone)
   * xsd:TSTelefone, pattern `[0-9]{6,20}`
   */
  fone?: string;
  /**
   * E-mail
   * xsd:TSEmail, tamanho 1..80, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  email?: string;
  /** Grupo de informações relativas aos regimes de tributação do prestador de serviços */
  regTrib: TCRegTrib;
} & (
  ({
  /**
   * Número do CNPJ
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJ: string;
  CPF?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número do CPF
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número de Identificação Fiscal fornecido por órgão de administração tributária no exterior
   * xsd:TSNIF, tamanho 1..40
   */
  NIF: string;
  CNPJ?: never; CPF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Motivo para não informação do NIF:
   * 0 - Não informado na nota de origem;
   * 1 - Dispensado do NIF;
   * 2 - Não exigência do NIF;
   * xsd:TSCodNaoNIF
   */
  cNaoNIF: TSCodNaoNIF;
  CNPJ?: never; CPF?: never; NIF?: never;
})
);

/**
 * Informações das pessoas envolvidas na NFS-e. Pode ser o tomador, o intermediário ou o fornecedor (dedução/redução)
 * xsd: TCInfoPessoa
 */
export type TCInfoPessoa = {
  /**
   * Número do Cadastro de Atividade Econômica da Pessoa Física (CAEPF)
   * xsd:TSCAEPF, tamanho 0..14, pattern `[0-9]{14}`
   */
  CAEPF?: string;
  /**
   * Número da inscrição municipal
   * xsd:TSInscMun, tamanho 1..15
   */
  IM?: string;
  /**
   * Nome/Nome Empresarial
   * xsd:TSNomeRazaoSocial, tamanho 1..300
   */
  xNome: string;
  /** Dados de endereço */
  end?: TCEndereco;
  /**
   * Número do telefone do prestador:
   * Preencher com o Código DDD + número do telefone.
   * Nas operações com exterior é permitido informar o código do país + código da localidade + número do telefone)
   * xsd:TSTelefone, pattern `[0-9]{6,20}`
   */
  fone?: string;
  /**
   * E-mail
   * xsd:TSEmail, tamanho 1..80, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  email?: string;
} & (
  ({
  /**
   * Número do CNPJ
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJ: string;
  CPF?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número do CPF
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número de Identificação Fiscal fornecido por órgão de administração tributária no exterior
   * xsd:TSNIF, tamanho 1..40
   */
  NIF: string;
  CNPJ?: never; CPF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Motivo para não informação do NIF:
   * 0 - Não informado na nota de origem;
   * 1 - Dispensado do NIF;
   * 2 - Não exigência do NIF;
   * xsd:TSCodNaoNIF
   */
  cNaoNIF: TSCodNaoNIF;
  CNPJ?: never; CPF?: never; NIF?: never;
})
);

/** xsd: TCLocPrest */
export type TCLocPrest = {

} & (
  ({
  /**
   * Código do município onde o serviço foi prestado (tabela do IBGE)
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cLocPrestacao: string;
  cPaisPrestacao?: never;
})
  | ({
  /**
   * Código do país onde o serviço foi prestado (Tabela de Países ISO)
   * xsd:TSCodPaisISO, pattern `[A-Z]{2}`
   */
  cPaisPrestacao: string;
  cLocPrestacao?: never;
})
);

/** xsd: TCCServ */
export type TCCServ = {
  /**
   * Código de tributação nacional do ISSQN, nos termos da LC 116/2003, conforme aba MUN.INCID_INFO.SERV. do ANEXO I
   * Regra de formação - 6 dígitos numéricos sendo: 2 para Item (LC 116/2003), 2 para Subitem (LC 116/2003) e 2 para Desdobro Nacional
   * xsd:TSCodTribNac, pattern `[0-9]{6}`
   */
  cTribNac: string;
  /**
   * Código de tributação municipal do ISSQN
   * xsd:TCCodTribMun, pattern `[0-9]{3}`
   */
  cTribMun?: string;
  /**
   * Descrição completa do serviço prestado
   * xsd:TSDesc2000, tamanho 1..2000
   */
  xDescServ: string;
  /**
   * Código NBS correspondente ao serviço prestado, seguindo a versão 2.0, conforme Anexo B
   * xsd:TSCodNBS, pattern `[0-9]{9}`
   */
  cNBS?: string;
  /**
   * Código interno do contribuinte
   * xsd:TSCodigoInternoContribuinte, tamanho 1..20
   */
  cIntContrib?: string;
};

/**
 * Modo de Prestação:
 * 0 - Desconhecido (tipo não informado na nota de origem);
 * 1 - Transfronteiriço;
 * 2 - Consumo no Brasil;
 * 3 - Presença Comercial no Exterior;
 * 4 - Movimento Temporário de Pessoas Físicas;
 * xsd:TSModoPrestacao
 */
export type TSModoPrestacao = "0" | "1" | "2" | "3" | "4";

/**
 * Vínculo entre as partes no negócio:
 * 0 - Sem vínculo com o Tomador/Prestador
 * 1 - Controlada;
 * 2 - Controladora;
 * 3 - Coligada;
 * 4 - Matriz;
 * 5 - Filial ou sucursal;
 * 6 - Outro vínculo;
 * 9 - Desconhecido (tipo não informado na nota de origem);
 * xsd:TSVincPrest
 */
export type TSVincPrest = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9";

/**
 * Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo prestador do serviço:
 * 00 - Desconhecido (tipo não informado na nota de origem);
 * 01 - Nenhum;
 * 02 - ACC - Adiantamento sobre Contrato de Câmbio – Redução a Zero do IR e do IOF;
 * 03 - ACE – Adiantamento sobre Cambiais Entregues - Redução a Zero do IR e do IOF;
 * 04 - BNDES-Exim Pós-Embarque – Serviços;
 * 05 - BNDES-Exim Pré-Embarque - Serviços;
 * 06 - FGE - Fundo de Garantia à Exportação;
 * 07 - PROEX - EQUALIZAÇÃO
 * 08 - PROEX - Financiamento;
 * xsd:TSMecAFComExPrest
 */
export type TSMecAFComExPrest = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

/**
 * Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo tomador do serviço:
 * 00 - Desconhecido (tipo não informado na nota de origem);
 * 01 - Nenhum;
 * 02 - Adm. Pública e Repr. Internacional;
 * 03 - Alugueis e Arrend. Mercantil de maquinas, equip., embarc. e aeronaves;
 * 04 - Arrendamento Mercantil de aeronave para empresa de transporte aéreo público;
 * 05 - Comissão a agentes externos na exportação;
 * 06 - Despesas de armazenagem, mov. e transporte de carga no exterior;
 * 07 - Eventos FIFA (subsidiária);
 * 08 - Eventos FIFA;
 * 09 - Fretes, arrendamentos de embarcações ou aeronaves e outros;
 * 10 - Material Aeronáutico;
 * 11 - Promoção de Bens no Exterior;
 * 12 - Promoção de Dest. Turísticos Brasileiros;
 * 13 - Promoção do Brasil no Exterior;
 * 14 - Promoção Serviços no Exterior;
 * 15 - RECINE;
 * 16 - RECOPA;
 * 17 - Registro e Manutenção de marcas, patentes e cultivares;
 * 18 - REICOMP;
 * 19 - REIDI;
 * 20 - REPENEC;
 * 21 - REPES;
 * 22 - RETAERO;
 * 23 - RETID;
 * 24 - Royalties, Assistência Técnica, Científica e Assemelhados;
 * 25 - Serviços de avaliação da conformidade vinculados aos Acordos da OMC;
 * 26 - ZPE;
 * xsd:TSMecAFComExToma
 */
export type TSMecAFComExToma = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26";

/**
 * Vínculo da Operação à Movimentação Temporária de Bens:
 * 0 - Desconhecido (tipo não informado na nota de origem);
 * 1 - Não;
 * 2 - Vinculada - Declaração de Importação;
 * 3 - Vinculada - Declaração de Exportação;
 * xsd:TSMovTempBens
 */
export type TSMovTempBens = "0" | "1" | "2" | "3";

/**
 * Compartilhar as informações da NFS-e gerada a partir desta DPS com a Secretaria de Comércio Exterior:
 * 0 - Não enviar para o MDIC;
 * 1 - Enviar para o MDIC;
 * xsd:TSEnvMDIC
 */
export type TSEnvMDIC = "0" | "1";

/** xsd: TCComExterior */
export type TCComExterior = {
  /**
   * Modo de Prestação:
   * 0 - Desconhecido (tipo não informado na nota de origem);
   * 1 - Transfronteiriço;
   * 2 - Consumo no Brasil;
   * 3 - Movimento Temporário de Pessoas Físicas;
   * 4 - Consumo no Exterior;
   * xsd:TSModoPrestacao
   */
  mdPrestacao: TSModoPrestacao;
  /**
   * Vínculo entre as partes no negócio:
   * 0 - Sem vínculo com o Tomador/Prestador
   * 1 - Controlada;
   * 2 - Controladora;
   * 3 - Coligada;
   * 4 - Matriz;
   * 5 - Filial ou sucursal;
   * 6 - Outro vínculo;
   * 9 - Desconhecido (tipo não informado na nota de origem);
   * xsd:TSVincPrest
   */
  vincPrest: TSVincPrest;
  /**
   * Identifica a moeda da transação comercial
   * xsd:TSCodMoeda, tamanho 0..3, pattern `[0-9]{3}`
   */
  tpMoeda: string;
  /**
   * Valor do serviço prestado expresso em moeda estrangeira especificada em tpmoeda
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vServMoeda: string;
  /**
   * Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo prestador do serviço:
   * 00 - Desconhecido (tipo não informado na nota de origem);
   * 01 - Nenhum;
   * 02 - ACC - Adiantamento sobre Contrato de Câmbio – Redução a Zero do IR e do IOF;
   * 03 - ACE – Adiantamento sobre Cambiais Entregues - Redução a Zero do IR e do IOF;
   * 04 - BNDES-Exim Pós-Embarque – Serviços;
   * 05 - BNDES-Exim Pré-Embarque - Serviços;
   * 06 - FGE - Fundo de Garantia à Exportação;
   * 07 - PROEX - EQUALIZAÇÃO
   * 08 - PROEX - Financiamento;
   * xsd:TSMecAFComExPrest
   */
  mecAFComexP: TSMecAFComExPrest;
  /**
   * Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo tomador do serviço:
   * 00 - Desconhecido (tipo não informado na nota de origem);
   * 01 - Nenhum;
   * 02 - Adm. Pública e Repr. Internacional;
   * 03 - Alugueis e Arrend. Mercantil de maquinas, equip., embarc. e aeronaves;
   * 04 - Arrendamento Mercantil de aeronave para empresa de transporte aéreo público;
   * 05 - Comissão a agentes externos na exportação;
   * 06 - Despesas de armazenagem, mov. e transporte de carga no exterior;
   * 07 - Eventos FIFA (subsidiária);
   * 08 - Eventos FIFA;
   * 09 - Fretes, arrendamentos de embarcações ou aeronaves e outros;
   * 10 - Material Aeronáutico;
   * 11 - Promoção de Bens no Exterior;
   * 12 - Promoção de Dest. Turísticos Brasileiros;
   * 13 - Promoção do Brasil no Exterior;
   * 14 - Promoção Serviços no Exterior;
   * 15 - RECINE;
   * 16 - RECOPA;
   * 17 - Registro e Manutenção de marcas, patentes e cultivares;
   * 18 - REICOMP;
   * 19 - REIDI;
   * 20 - REPENEC;
   * 21 - REPES;
   * 22 - RETAERO;
   * 23 - RETID;
   * 24 - Royalties, Assistência Técnica, Científica e Assemelhados;
   * 25 - Serviços de avaliação da conformidade vinculados aos Acordos da OMC;
   * 26 - ZPE;
   * xsd:TSMecAFComExToma
   */
  mecAFComexT: TSMecAFComExToma;
  /**
   * Vínculo da Operação à Movimentação Temporária de Bens:
   * 0 - Desconhecido (tipo não informado na nota de origem);
   * 1 - Não;
   * 2 - Vinculada - Declaração de Importação;
   * 3 - Vinculada - Declaração de Exportação;
   * xsd:TSMovTempBens
   */
  movTempBens: TSMovTempBens;
  /**
   * Número da Declaração de Importação (DI/DSI/DA/DRI-E) averbado
   * xsd:TSNumDocImport, tamanho 1..12, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nDI?: string;
  /**
   * Número do Registro de Exportação (RE) averbado
   * xsd:TSNumRegExport, tamanho 1..12, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nRE?: string;
  /**
   * Compartilhar as informações da NFS-e gerada a partir desta DPS com a Secretaria de Comércio Exterior:
   * 0 - Não enviar para o MDIC;
   * 1 - Enviar para o MDIC;
   * xsd:TSEnvMDIC
   */
  mdic: TSEnvMDIC;
};

/** xsd: TCEnderExtSimples */
export type TCEnderExtSimples = {
  /**
   * Código alfanumérico do Endereçamento Postal no exterior do prestador do serviço.
   * xsd:TSCodigoEndPostal, tamanho 1..11
   */
  cEndPost: string;
  /**
   * Nome da cidade no exterior do prestador do serviço.
   * xsd:TSCidade, tamanho 1..60
   */
  xCidade: string;
  /**
   * Estado, província ou região da cidade no exterior do prestador do serviço.
   * xsd:TSEstadoProvRegiao, tamanho 1..60
   */
  xEstProvReg: string;
};

/** xsd: TCEnderObraEvento */
export type TCEnderObraEvento = {
  /**
   * Tipo e nome do logradouro da localização do imóvel
   * xsd:TSLogradouro, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr: string;
  /**
   * Número do imóvel
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro: string;
  /**
   * Complemento do endereço
   * xsd:TSComplementoEndereco, tamanho 1..156, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TSBairro, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro: string;
} & (
  ({
  /**
   * Número do CEP
   * xsd:TSCEP, pattern `[0-9]{8}`
   */
  CEP: string;
  endExt?: never;
})
  | ({
  /** Grupo de informações específicas de endereço no exterior */
  endExt: TCEnderExtSimples;
  CEP?: never;
})
);

/** xsd: TCInfoObra */
export type TCInfoObra = {
  /**
   * Inscrição imobiliária fiscal (código fornecido pela Prefeitura Municipal para a identificação da obra ou para fins de recolhimento do IPTU)
   * xsd:TSInscImobFisc, tamanho 1..30
   */
  inscImobFisc?: string;
} & (
  ({
  /**
   * Número de identificação da obra.
   * Cadastro Nacional de Obras (CNO) ou Cadastro Específico do INSS (CEI).
   * xsd:TSCodObra, tamanho 1..30
   */
  cObra: string;
  cCIB?: never; end?: never;
})
  | ({
  /**
   * Código do Cadastro Imobiliário Brasileiro - CIB.
   * xsd:TSCodCIB, tamanho 8
   */
  cCIB: string;
  cObra?: never; end?: never;
})
  | ({
  /** Grupo de informações do endereço da obra do serviço prestado */
  end: TCEnderObraEvento;
  cObra?: never; cCIB?: never;
})
);

/** xsd: TCEnderecoSimples */
export type TCEnderecoSimples = {
  /**
   * Tipo e nome do logradouro da localização do imóvel
   * xsd:TSLogradouro, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr: string;
  /**
   * Número do imóvel
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro: string;
  /**
   * Complemento do endereço
   * xsd:TSComplementoEndereco, tamanho 1..156, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TSBairro, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro: string;
} & (
  ({
  /**
   * Número do CEP
   * xsd:TSCEP, pattern `[0-9]{8}`
   */
  CEP: string;
  endExt?: never;
})
  | ({
  /** Grupo de informações específicas de endereço no exterior */
  endExt: TCEnderExtSimples;
  CEP?: never;
})
);

/** xsd: TCAtvEvento */
export type TCAtvEvento = {
  /**
   * Descrição do evento Artístico, Cultural, Esportivo, etc
   * xsd:TSDesc255, tamanho 1..255
   */
  xNome: string;
  /**
   * Data de início da atividade de evento. Ano, Mês e Dia (AAAA-MM-DD)
   * xsd:TSData
   */
  dtIni: string;
  /**
   * Data de fim da atividade de evento. Ano, Mês e Dia (AAAA-MM-DD)
   * xsd:TSData
   */
  dtFim: string;
} & (
  ({
  /**
   * Identificação da Atividade de Evento (código identificador de evento determinado pela Administração Tributária Municipal)
   * xsd:TSIdeEvento, tamanho 1..30
   */
  idAtvEvt: string;
  end?: never;
})
  | ({
  /** Grupo de informações relativas ao endereço da atividade, evento ou local do serviço prestado */
  end: TCEnderecoSimples;
  idAtvEvt?: never;
})
);

/** xsd: TCInfoItemPed */
export type TCInfoItemPed = {
  /**
   * Número do item do  pedido/ordem de compra/ordem de serviço/projeto - Identificação do número do item do pedido ou ordem de compra destacado e xPed
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   * ocorre 1..99
   */
  xItemPed: string[];
};

/** xsd: TCInfoCompl */
export type TCInfoCompl = {
  /**
   * Identificador de Documento de Responsabilidade Técnica: ART, RRT, DRT, Outros.
   * xsd:TSDRT, tamanho 1..40
   */
  idDocTec?: string;
  /**
   * Chave da nota, número identificador da nota, número do contrato ou outro identificador de documento emitido pelo prestador de serviços, que subsidia a emissão dessa nota pelo tomador do serviço ou intermediário (preenchimento obrigatório caso a nota esteja sendo emitida pelo Tomador ou intermediário do serviço).
   * xsd:TSDesc255, tamanho 1..255
   */
  docRef?: string;
  /**
   * Número do  pedido/ordem de compra/ordem de serviço/projeto que autorize a prestação do serviço em operações B2B - Informação de interesse do tomador do serviço para controle e gestão da Negociação
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xPed?: string;
  /** Grupo de itens do pedido/ordem de compra/ordem de serviço/projeto */
  gItemPed?: TCInfoItemPed;
  /**
   * Informações complementares
   * xsd:TSDescInfCompl, tamanho 1..2000
   */
  xInfComp?: string;
};

/** xsd: TCServ */
export type TCServ = {
  /** Grupo de informações relativas ao local da prestação do serviço */
  locPrest: TCLocPrest;
  /** Grupo de informações relativas ao código do serviço prestado */
  cServ: TCCServ;
  /** Grupo de informações relativas à exportação/importação de serviço prestado */
  comExt?: TCComExterior;
  /** Grupo de informações do DPS relativas à serviço de obra */
  obra?: TCInfoObra;
  /** Grupo de informações do DPS relativas à Evento */
  atvEvento?: TCAtvEvento;
  /** Grupo de informações complementares disponível para todos os serviços prestados */
  infoCompl?: TCInfoCompl;
};

/** xsd: TCVServPrest */
export type TCVServPrest = {
  /**
   * Valor monetário recebido pelo intermediário do serviço (R$)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vReceb?: string;
  /**
   * Valor dos serviços em R$
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vServ: string;
};

/** xsd: TCVDescCondIncond */
export type TCVDescCondIncond = {
  /**
   * Valor monetário do desconto incondicionado (R$)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDescIncond?: string;
  /**
   * Valor monetário do desconto condicionado (R$)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDescCond?: string;
};

/** xsd: TCDocOutNFSe */
export type TCDocOutNFSe = {
  /**
   * Código Município emissor da nota eletrônica municipal (Tabela do IBGE)
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cMunNFSeMun: string;
  /**
   * Número da nota eletrônica municipal
   * xsd:TSNum15Dig, tamanho 0..15, pattern `[0-9]{15}`
   */
  nNFSeMun: string;
  /**
   * Código de Verificação da nota eletrônica municipal
   * xsd:TSCodVerificacao, tamanho 1..9, pattern `[a-zA-Z0-9]{1,9}`
   */
  cVerifNFSeMun: string;
};

/** xsd: TCDocNFNFS */
export type TCDocNFNFS = {
  /**
   * Número da Nota Fiscal NF ou NFS
   * xsd:TSNum7Dig, tamanho 0..7, pattern `[0-9]{7}`
   */
  nNFS: string;
  /**
   * Modelo da Nota Fiscal NF ou NFS
   * xsd:TSNum15Dig, tamanho 0..15, pattern `[0-9]{15}`
   */
  modNFS: string;
  /**
   * Série Nota Fiscal NF ou NFS
   * xsd:TSSerieNFNFS, tamanho 1..15, pattern `[a-zA-Z0-9]{1,15}`
   */
  serieNFS: string;
};

/**
 * Identificação da Dedução/Redução:
 * 1 – Alimentação e bebidas/frigobar;
 * 2 – Materiais;
 * 3 - Produção Externa;
 * 4 - Reembolso de despesas;
 * 5 – Repasse consorciado;
 * 6 – Repasse plano de saúde;
 * 7 – Serviços;
 * 8 – Subempreitada de mão de obra;
 * 9 - Profissional parceiro;
 * 99 – Outras deduções;
 * xsd:TSIdeDedRed
 */
export type TSIdeDedRed = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "99";

/** xsd: TCDocDedRed */
export type TCDocDedRed = {
  /**
   * Identificação da Dedução/Redução:
   * 1 – Alimentação e bebidas/frigobar;
   * 2 – Materiais;
   * 3 - Produção Externa;
   * 4 - Reembolso de despesas;
   * 5 – Repasse consorciado;
   * 6 – Repasse plano de saúde;
   * 7 – Serviços;
   * 8 – Subempreitada de mão de obra;
   * 9 - Profissional parceiro;
   * 99 – Outras deduções;
   * xsd:TSIdeDedRed
   */
  tpDedRed: TSIdeDedRed;
  /**
   * Descrição da Dedução/Redução quando a opção é "99 – Outras Deduções"
   * xsd:TSDescOutDedRed, tamanho 1..150, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xDescOutDed?: string;
  /** Data da emissão do documento dedutível. Ano, mês e dia (AAAA-MM-DD) */
  dtEmiDoc: string;
  /**
   * Valor monetário total dedutível/redutível no documento informado (R$).
   * Este é o valor total no documento informado que é passível de dedução/redução.
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDedutivelRedutivel: string;
  /**
   * Valor monetário utilizado para dedução/redução do valor do serviço da NFS-e que está sendo emitida (R$).
   * Deve ser menor ou igual ao valor deduzível/redutível (vDedutivelRedutivel).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDeducaoReducao: string;
  /** Grupo de informações do Fornecedor em Deduções de Serviços */
  fornec?: TCInfoPessoa;
} & (
  ({
  /**
   * Chave de Acesso da NFS-e (Padrão Nacional)
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   */
  chNFSe: string;
  chNFe?: never; NFSeMun?: never; NFNFS?: never; nDocFisc?: never; nDoc?: never;
})
  | ({
  /**
   * Chave de Acesso da NF-e
   * xsd:TSChaveNFe, tamanho 0..44, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{24}`
   */
  chNFe: string;
  chNFSe?: never; NFSeMun?: never; NFNFS?: never; nDocFisc?: never; nDoc?: never;
})
  | ({
  /** Grupo de informações de Outras NFS-e (Padrão anterior de NFS-e) */
  NFSeMun: TCDocOutNFSe;
  chNFSe?: never; chNFe?: never; NFNFS?: never; nDocFisc?: never; nDoc?: never;
})
  | ({
  /** Grupo de informações de NF ou NFS (Modelo não eletrônico) */
  NFNFS: TCDocNFNFS;
  chNFSe?: never; chNFe?: never; NFSeMun?: never; nDocFisc?: never; nDoc?: never;
})
  | ({
  /**
   * Número de documento fiscal
   * xsd:TSDesc255, tamanho 1..255
   */
  nDocFisc: string;
  chNFSe?: never; chNFe?: never; NFSeMun?: never; NFNFS?: never; nDoc?: never;
})
  | ({
  /**
   * Número de documento não fiscal
   * xsd:TSDesc255, tamanho 1..255
   */
  nDoc: string;
  chNFSe?: never; chNFe?: never; NFSeMun?: never; NFNFS?: never; nDocFisc?: never;
})
);

/** xsd: TCListaDocDedRed */
export type TCListaDocDedRed = {
  /**
   * Grupo de informações de documento utilizado para Dedução/Redução do valor do serviço
   * ocorre 1..1000
   */
  docDedRed: TCDocDedRed[];
};

/** xsd: TCInfoDedRed */
export type TCInfoDedRed = {

} & (
  ({
  /**
   * Valor percentual padrão para dedução/redução do valor do serviço
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pDR: string;
  vDR?: never; documentos?: never;
})
  | ({
  /**
   * Valor monetário padrão para dedução/redução do valor do serviço
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDR: string;
  pDR?: never; documentos?: never;
})
  | ({
  /** Grupo de informações de documento utilizado para Dedução/Redução do valor do serviço */
  documentos: TCListaDocDedRed;
  pDR?: never; vDR?: never;
})
);

/**
 * Opção para Exigibilidade Suspensa:
 * 1 - Exigibilidade Suspensa por Decisão Judicial;
 * 2 - Exigibilidade Suspensa por Processo Administrativo;
 * xsd:TSOpExigSuspensa
 */
export type TSOpExigSuspensa = "1" | "2";

/** xsd: TCExigSuspensa */
export type TCExigSuspensa = {
  /**
   * Opção para Exigibilidade Suspensa:
   * 1 - Exigibilidade Suspensa por Decisão Judicial;
   * 2 - Exigibilidade Suspensa por Processo Administrativo;
   * xsd:TSOpExigSuspensa
   */
  tpSusp: TSOpExigSuspensa;
  /**
   * Número do processo judicial ou administrativo de suspensão da exigibilidade
   * xsd:TSNumProcExigSuspensa, pattern `[0-9]{30}`
   */
  nProcesso: string;
};

/** xsd: TCBeneficioMunicipal */
export type TCBeneficioMunicipal = {
  /**
   * Identificador do benefício parametrizado pelo município.
   * Trata-se de um identificador único que foi gerado pelo Sistema Nacional no momento em que o município de incidência do ISSQN incluiu o benefício no sistema.
   * Critério de formação do número de identificação de parâmetros municipais:
   * 7 dígitos - posição 1 a 7: número identificador do Município, conforme código IBGE;
   * 2 dígitos - posições 8 e 9 : número identificador do tipo de parametrização (01-legislação, 02-regimes especiais, 03-retenções, 04-outros benefícios);
   * 5 dígitos - posição 10 a 14 : número sequencial definido pelo sistema quando do registro específico do parâmetro dentro do tipo de parametrização no sistema;
   * xsd:TSNumBeneficioMunicipal, pattern `[0-9]{14}`
   */
  nBM: string;
} & (
  ({
  /**
   * Valor monetário informado pelo emitente para redução da base de cálculo (BC) do ISSQN devido a um Benefício Municipal (BM).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vRedBCBM?: string;
  pRedBCBM?: never;
})
  | ({
  /**
   * Valor percentual informado pelo emitente para redução da base de cálculo (BC) do ISSQN devido a um Benefício Municipal (BM).
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pRedBCBM?: string;
  vRedBCBM?: never;
})
);

/**
 * Tributação do ISSQN sobre o serviço prestado:
 * 1 - Operação tributável;
 * 2 - Imunidade;
 * 3 - Exportação de serviço;
 * 4 - Não Incidência;
 * xsd:TSTribISSQN
 */
export type TSTribISSQN = "1" | "2" | "3" | "4";

/**
 * Identificação da Imunidade do ISSQN – somente para o caso de Imunidade.
 * Tipos de Imunidades:
 * 0 - Imunidade (tipo não informado na nota de origem);
 * 1 - Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a);
 * 2 - Templos de qualquer culto (CF88, Art 150, VI, b);
 * 3 - Patrimônio, renda ou serviços dos partidos políticos, inclusive suas fundações, das entidades sindicais dos trabalhadores, das instituições de educação e de assistência social, sem fins lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c);
 * 4 - Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d);
 * 5 - Fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros bem como os suportes materiais ou arquivos digitais que os contenham, salvo na etapa de replicação industrial de mídias ópticas de leitura a laser.   (CF88, Art 150, VI, e);
 * xsd:TSTipoImunidadeISSQN
 */
export type TSTipoImunidadeISSQN = "0" | "1" | "2" | "3" | "4" | "5";

/**
 * Tipo de retencao do ISSQN:
 * 1 - Não Retido;
 * 2 - Retido pelo Tomador;
 * 3 - Retido pelo Intermediario;
 * xsd:TSTipoRetISSQN
 */
export type TSTipoRetISSQN = "1" | "2" | "3";

/** xsd: TCTribMunicipal */
export type TCTribMunicipal = {
  /**
   * Tributação do ISSQN sobre o serviço prestado:
   * 1 - Operação tributável;
   * 2 - Imunidade;
   * 3 - Exportação de serviço;
   * 4 - Não Incidência;
   * xsd:TSTribISSQN
   */
  tribISSQN: TSTribISSQN;
  /**
   * Código do país onde se verficou o resultado da prestação do serviço para o caso de Exportação de Serviço.(Tabela de Países ISO)
   * xsd:TSCodPaisISO, pattern `[A-Z]{2}`
   */
  cPaisResult?: string;
  /**
   * Identificação da Imunidade do ISSQN – somente para o caso de Imunidade.
   * Tipos de Imunidades:
   * 0 - Imunidade (tipo não informado na nota de origem);
   * 1 - Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a);
   * 2 - Templos de qualquer culto (CF88, Art 150, VI, b);
   * 3 - Patrimônio, renda ou serviços dos partidos políticos, inclusive suas fundações, das entidades sindicais dos trabalhadores, das instituições de educação e de assistência social, sem fins lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c);
   * 4 - Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d);
   * 5 - Fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros bem como os suportes materiais ou arquivos digitais que os contenham, salvo na etapa de replicação industrial de mídias ópticas de leitura a laser.   (CF88, Art 150, VI, e);
   * xsd:TSTipoImunidadeISSQN
   */
  tpImunidade?: TSTipoImunidadeISSQN;
  /** Informações para a suspensão da Exigibilidade do ISSQN */
  exigSusp?: TCExigSuspensa;
  /**
   * Tributação do ISSQN sobre o serviço prestado:
   * 1 - Operação tributável;
   * 2 - Exportação de serviço;
   * 3 - Não Incidência;
   * 4 - Imunidade;
   */
  BM?: TCBeneficioMunicipal;
  /**
   * Tipo de retencao do ISSQN:
   * 1 - Não Retido;
   * 2 - Retido pelo Tomador;
   * 3 - Retido pelo Intermediario;
   * xsd:TSTipoRetISSQN
   */
  tpRetISSQN: TSTipoRetISSQN;
  /**
   * Valor da alíquota (%) do serviço prestado relativo ao município sujeito ativo (município de incidência) do ISSQN.
   * Se o município de incidência pertence ao Sistema Nacional NFS-e a alíquota estará parametrizada e, portanto, será fornecida pelo sistema.
   * Se o município de incidência não pertence ao Sistema Nacional NFS-e a alíquota não estará parametrizada e, por isso, deverá ser fornecida pelo emitente.
   * xsd:TSDec1V2, pattern `0|[0-9]{1}(\.[0-9]{2})?`
   */
  pAliq?: string;
};

/**
 * Código de Situação Tributária do PIS/COFINS (CST):
 * 00 - Nenhum;
 * 01 - Operação Tributável com Alíquota Básica;
 * 02 - Operação Tributável com Alíquota Diferenciada;
 * 03 - Operação Tributável com Alíquota por Unidade de Medida de Produto;
 * 04 - Operação Tributável monofásica - Revenda a Alíquota Zero;
 * 05 - Operação Tributável por Substituição Tributária;
 * 06 - Operação Tributável a Alíquota Zero;
 * 07 - Operação Isenta da Contribuição;
 * 08 - Operação sem Incidência da Contribuição;
 * 09 - Operação com Suspensão da Contribuição;
 * 49 - Outras Operações de Saída;
 * 50 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Tributada no Mercado Interno;
 * 51 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno;
 * 52 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita de Exportação;
 * 53 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno;
 * 54 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas no Mercado Interno e de Exportação;
 * 55 - Operação com Direito a Crédito – Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação;
 * 56 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação;
 * 60 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno;
 * 61 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno;
 * 62 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita de Exportação;
 * 63 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno;
 * 64 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação;
 * 65 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação;
 * 66 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação;
 * 67 - Crédito Presumido – Outras Operações;
 * 70 - Operação de Aquisição sem Direito a Crédito;
 * 71 - Operação de Aquisição com Isenção;
 * 72 - Operação de Aquisição com Suspensão;
 * 73 - Operação de Aquisição a Alíquota Zero;
 * 74 - Operação de Aquisição sem Incidência da Contribuição;
 * 75 - Operação de Aquisição por Substituição Tributária;
 * 98 - Outras Operações de Entrada;
 * 99 - Outras Operações;
 * xsd:TSTipoCST
 */
export type TSTipoCST = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "49" | "50" | "51" | "52" | "53" | "54" | "55" | "56" | "60" | "61" | "62" | "63" | "64" | "65" | "66" | "67" | "70" | "71" | "72" | "73" | "74" | "75" | "98" | "99";

/**
 * Tipo de retencao do Pis/Cofins:
 * 0 - PIS/COFINS/CSLL Não Retidos;
 * 1 - PIS/COFINS Retidos;
 * 2 - PIS/COFINS Não Retidos;
 * 3 - PIS/COFINS/CSLL Retidos;
 * 4 - PIS/COFINS Retidos, CSLL Não Retido;
 * 5 - PIS Retido, COFINS/CSLL Não Retido;
 * 6 - COFINS Retido, PIS/CSLL Não Retido;
 * 7 - PIS Não Retido, COFINS/CSLL Retidos;
 * 8 - PIS/COFINS Não Retidos, CSLL Retido;
 * 9 - COFINS Não Retido, PIS/CSLL Retidos;
 * xsd:TSTipoRetPISCofins
 */
export type TSTipoRetPISCofins = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** xsd: TCTribOutrosPisCofins */
export type TCTribOutrosPisCofins = {
  /**
   * Código de Situação Tributária do PIS/COFINS (CST):
   * 00 - Nenhum;
   * 01 - Operação Tributável com Alíquota Básica;
   * 02 - Operação Tributável com Alíquota Diferenciada;
   * 03 - Operação Tributável com Alíquota por Unidade de Medida de Produto;
   * 04 - Operação Tributável monofásica - Revenda a Alíquota Zero;
   * 05 - Operação Tributável por Substituição Tributária;
   * 06 - Operação Tributável a Alíquota Zero;
   * 07 - Operação Isenta da Contribuição;
   * 08 - Operação sem Incidência da Contribuição;
   * 09 - Operação com Suspensão da Contribuição;
   * 49 - Outras Operações de Saída;
   * 50 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Tributada no Mercado Interno;
   * 51 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno;
   * 52 - Operação com Direito a Crédito – Vinculada Exclusivamente a Receita de Exportação;
   * 53 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno;
   * 54 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas no Mercado Interno e de Exportação;
   * 55 - Operação com Direito a Crédito – Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação;
   * 56 - Operação com Direito a Crédito – Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação;
   * 60 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno;
   * 61 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno;
   * 62 - Crédito Presumido – Operação de Aquisição Vinculada Exclusivamente a Receita de Exportação;
   * 63 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno;
   * 64 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação;
   * 65 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação;
   * 66 - Crédito Presumido – Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação;
   * 67 - Crédito Presumido – Outras Operações;
   * 70 - Operação de Aquisição sem Direito a Crédito;
   * 71 - Operação de Aquisição com Isenção;
   * 72 - Operação de Aquisição com Suspensão;
   * 73 - Operação de Aquisição a Alíquota Zero;
   * 74 - Operação de Aquisição sem Incidência da Contribuição;
   * 75 - Operação de Aquisição por Substituição Tributária;
   * 98 - Outras Operações de Entrada;
   * 99 - Outras Operações;
   * xsd:TSTipoCST
   */
  CST: TSTipoCST;
  /**
   * Valor da Base de Cálculo do PIS/COFINS, relativo à apuração própria (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vBCPisCofins?: string;
  /**
   * Alíquota do PIS, relativa à apuração própria (%).
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqPis?: string;
  /**
   * Alíquota da COFINS, relativa à apuração própria (%).
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqCofins?: string;
  /**
   * Valor do débito de PIS apuração própria (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vPis?: string;
  /**
   * Valor do débito de COFINS apuração própria (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCofins?: string;
  /**
   * Tipo de retenção do PIS/COFINS:
   * 0 - PIS/COFINS/CSLL Não Retidos;
   * 1 - PIS/COFINS Retidos;
   * 2 - PIS/COFINS Não Retidos;
   * 3 - PIS/COFINS/CSLL Retidos;
   * 4 - PIS/COFINS Retidos, CSLL Não Retido;
   * 5 - PIS Retido, COFINS/CSLL Não Retido;
   * 6 - COFINS Retido, PIS/CSLL Não Retido;
   * 7 - PIS Não Retido, COFINS/CSLL Retidos;
   * 8 - PIS/COFINS Não Retidos, CSLL Retido;
   * 9 - COFINS Não Retido, PIS/CSLL Retidos;
   * xsd:TSTipoRetPISCofins
   */
  tpRetPisCofins?: TSTipoRetPISCofins;
};

/** xsd: TCTribFederal */
export type TCTribFederal = {
  /** Grupo de informações dos tributos PIS/COFINS */
  piscofins?: TCTribOutrosPisCofins;
  /**
   * Valor monetário do CP(R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vRetCP?: string;
  /**
   * Valor monetário do IRRF (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vRetIRRF?: string;
  /**
   * Valor monetário do CSLL (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vRetCSLL?: string;
};

/** xsd: TCTribTotalMonet */
export type TCTribTotalMonet = {
  /**
   * Valor monetário total aproximado dos tributos federais (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTotTribFed: string;
  /**
   * Valor monetário total aproximado dos tributos estaduais (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTotTribEst: string;
  /**
   * Valor monetário total aproximado dos tributos municipais (R$).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTotTribMun: string;
};

/** xsd: TCTribTotalPercent */
export type TCTribTotalPercent = {
  /**
   * Valor percentual total aproximado dos tributos federais (%).
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pTotTribFed: string;
  /**
   * Valor percentual total aproximado dos tributos estaduais (%).
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pTotTribEst: string;
  /**
   * Valor percentual total aproximado dos tributos municipais (%).
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pTotTribMun: string;
};

/**
 * Indicador de informação de valor total de tributos. Possui valor fixo igual a zero (indTotTrib=0).
 * Não informar nenhum valor estimado para os Tributos (Decreto 8.264/2014).
 * 0 - Não;
 * xsd:TSTipoIndTotTrib
 */
export type TSTipoIndTotTrib = "0";

/** xsd: TCTribTotal */
export type TCTribTotal = {

} & (
  ({
  /** Valor monetário total aproximado dos tributos, em conformidade com o artigo 1o da Lei no 12.741/2012 */
  vTotTrib: TCTribTotalMonet;
  pTotTrib?: never; indTotTrib?: never; pTotTribSN?: never;
})
  | ({
  /** Valor percentual total aproximado dos tributos, em conformidade com o artigo 1o da Lei no 12.741/2012 */
  pTotTrib: TCTribTotalPercent;
  vTotTrib?: never; indTotTrib?: never; pTotTribSN?: never;
})
  | ({
  /**
   * Indicador de informação de valor total de tributos. Possui valor fixo igual a zero (indTotTrib=0).
   * Não informar nenhum valor estimado para os Tributos (Decreto 8.264/2014).
   * 0 - Não;
   * xsd:TSTipoIndTotTrib
   */
  indTotTrib: TSTipoIndTotTrib;
  vTotTrib?: never; pTotTrib?: never; pTotTribSN?: never;
})
  | ({
  /**
   * Valor percentual aproximado do total dos tributos da alíquota do Simples Nacional (%)
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pTotTribSN: string;
  vTotTrib?: never; pTotTrib?: never; indTotTrib?: never;
})
);

/** xsd: TCInfoTributacao */
export type TCInfoTributacao = {
  /** Grupo de informações relacionados ao Imposto Sobre Serviços de Qualquer Natureza - ISSQN */
  tribMun: TCTribMunicipal;
  /** Grupo de informações de outros tributos relacionados ao serviço prestado */
  tribFed?: TCTribFederal;
  /** Grupo de informações para totais aproximados dos tributos relacionados ao serviço prestado */
  totTrib: TCTribTotal;
};

/** xsd: TCInfoValores */
export type TCInfoValores = {
  /** Grupo de informações relativas aos valores do serviço prestado */
  vServPrest: TCVServPrest;
  /** Grupo de informações relativas aos descontos condicionados e incondicionados */
  vDescCondIncond?: TCVDescCondIncond;
  /** Grupo de informações relativas ao valores para dedução/redução do valor da base de cálculo (valor do serviço) */
  vDedRed?: TCInfoDedRed;
  /** Grupo de informações relacionados aos tributos relacionados ao serviço prestado */
  trib: TCInfoTributacao;
};

/** xsd: TCInfoRefNFSe */
export type TCInfoRefNFSe = {
  /**
   * Chave da NFS-e referenciada
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   * ocorre 1..99
   */
  refNFSe: string[];
};

/** xsd: TCRTCInfoDest */
export type TCRTCInfoDest = {
  /**
   * Nome / Nome Empresarial do do Destinatário do serviço
   * xsd:TSDesc150, tamanho 1..150
   */
  xNome: string;
  /** Grupo de informações do endereço do Destinatário do serviço */
  end?: TCEndereco;
  /**
   * Número do telefone do Destinatário do serviço
   * (Preencher com o Código DDD + número do telefone. Nas operações com exterior é permitido informar o
   * código do país + código da localidade + número do telefone)
   * xsd:TSTelefone, pattern `[0-9]{6,20}`
   */
  fone?: string;
  /**
   * E-mail do Destinatário do serviço
   * xsd:TSEmail, tamanho 1..80, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  email?: string;
} & (
  ({
  /**
   * Número da inscrição no Cadastro Nacional de Pessoa Jurídica (CNPJ) do Destinatário do serviço
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJ: string;
  CPF?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número da inscrição no Cadastro de Pessoa Física (CPF) do Destinatário do serviço
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número de Identificação Fiscal fornecido por órgão de administração tributária no exterior
   * xsd:TSNIF, tamanho 1..40
   */
  NIF: string;
  CNPJ?: never; CPF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Motivo para não informação do NIF:
   * 0 - Não informado na nota de origem;
   * 1 - Dispensado do NIF;
   * 2 - Não exigência do NIF;
   * xsd:TSCodNaoNIF
   */
  cNaoNIF: TSCodNaoNIF;
  CNPJ?: never; CPF?: never; NIF?: never;
})
);

/** xsd: TCRTCInfoImovel */
export type TCRTCInfoImovel = {
  /**
   * Inscrição imobiliária fiscal (código fornecido pela Prefeitura Municipal para a identificação da obra ou para fins de recolhimento do IPTU)
   * xsd:TSInscImobFisc, tamanho 1..30
   */
  inscImobFisc?: string;
} & (
  ({
  /**
   * Código do Cadastro Imobiliário Brasileiro - CIB
   * xsd:TSCodCIB, tamanho 8
   */
  cCIB: string;
  end?: never;
})
  | ({
  /** Grupo de informações do endereço da obra do serviço prestado */
  end: TCEnderObraEvento;
  cCIB?: never;
})
);

/**
 * Documento fiscal a que se refere a chaveDfe que seja um dos documentos do Repositório Nacional:
 * 1 - NFS-e;
 * 2 - NF-e;
 * 3 - CT-e;
 * 9 - Outro;
 * xsd:TSRTCTipoChaveDFe
 */
export type TSRTCTipoChaveDFe = "1" | "2" | "3" | "9";

/** xsd: TCRTCListaDocDFe */
export type TCRTCListaDocDFe = {
  /**
   * Documento fiscal a que se refere a chaveDfe que seja um dos documentos do Repositório Nacional
   * xsd:TSRTCTipoChaveDFe
   */
  tipoChaveDFe: TSRTCTipoChaveDFe;
  /**
   * Descrição da DF-e a que se refere a chaveDfe que seja um dos documentos do Repositório Nacional
   * Deve ser preenchido apenas quando "tipoChaveDFe = 9 (Outro)"
   * xsd:TSDesc255, tamanho 1..255
   */
  xTipoChaveDFe?: string;
  /**
   * Chave do Documento Fiscal eletrônico do repositório nacional referenciado para os casos de operações já tributadas
   * xsd:TSRTCChaveDFe, tamanho 1..50
   */
  chaveDFe: string;
};

/** xsd: TCRTCListaDocFiscalOutro */
export type TCRTCListaDocFiscalOutro = {
  /**
   * Código do município emissor do documento fiscal que não se encontra no repositório nacional
   * xsd:TSNum7Dig, tamanho 0..7, pattern `[0-9]{7}`
   */
  cMunDocFiscal: string;
  /**
   * Número do documento fiscal que não se encontra no repositório nacional
   * xsd:TSDesc255, tamanho 1..255
   */
  nDocFiscal: string;
  /**
   * Descrição do documento fiscal
   * xsd:TSDesc255, tamanho 1..255
   */
  xDocFiscal: string;
};

/** xsd: TCRTCListaDocOutro */
export type TCRTCListaDocOutro = {
  /**
   * Número do documento não fiscal
   * xsd:TSDesc255, tamanho 1..255
   */
  nDoc: string;
  /**
   * Descrição do documento não fiscal
   * xsd:TSDesc255, tamanho 1..255
   */
  xDoc: string;
};

/** xsd: TCRTCListaDocFornec */
export type TCRTCListaDocFornec = {
  /**
   * Nome / Razão Social do do Fornecedor do serviço
   * xsd:TSDesc150, tamanho 1..150
   */
  xNome: string;
} & (
  ({
  /**
   * Número da inscrição no Cadastro Nacional de Pessoa Jurídica (CNPJ) do Fornecedor do serviço
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJ: string;
  CPF?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Número da inscrição no Cadastro de Pessoa Física (CPF) do Fornecedor do serviço
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; NIF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Este elemento só deverá ser preenchido para fornecedores não residentes no Brasil
   * xsd:TSNIF, tamanho 1..40
   */
  NIF: string;
  CNPJ?: never; CPF?: never; cNaoNIF?: never;
})
  | ({
  /**
   * Motivo para não informação do NIF:
   * 0 - Não informado na nota de origem;
   * 1 - Dispensado do NIF;
   * 2 - Não exigência do NIF;
   * xsd:TSCodNaoNIF
   */
  cNaoNIF: TSCodNaoNIF;
  CNPJ?: never; CPF?: never; NIF?: never;
})
);

/**
 * Tipo de valor incluído neste documento, recebido por motivo de estarem relacionadas a operações de terceiros,
 * objeto de reembolso, repasse ou ressarcimento pelo recebedor, já tributados e aqui referenciados
 * 01 - Repasse de remuneração por intermediação de imóveis a demais corretores envolvidos na operação;
 * 02 - Repasse de valores a fornecedor relativo a fornecimento intermediado por agência de turismo;
 * 03 - Reembolso ou ressarcimento recebido por agência de propaganda e publicidade por valores pagos relativos
 * a serviços de produção externa por conta e ordem de terceiro;
 * 04 - Reembolso ou ressarcimento recebido por agência de propaganda e publicidade por valores pagos relativos
 * a serviços de mídia por conta e ordem de terceiro;
 * 99 - Outros reembolsos ou ressarcimentos recebidos por valores pagos relativos a operações por conta e ordem de terceiro;
 * xsd:TSRTCTpReeRepRes
 */
export type TSRTCTpReeRepRes = "01" | "02" | "03" | "04" | "99";

/** xsd: TCRTCListaDoc */
export type TCRTCListaDoc = {
  /** Grupo de informações do fornecedor do documento referenciado */
  fornec?: TCRTCListaDocFornec;
  /**
   * Data da emissão do documento dedutível
   * Ano, mês e dia (AAAA-MM-DD)
   * xsd:TSData
   */
  dtEmiDoc: string;
  /**
   * Data da competência do documento dedutível
   * Ano, mês e dia (AAAA-MM-DD)
   * xsd:TSData
   */
  dtCompDoc: string;
  /**
   * Tipo de valor incluído neste documento, recebido por motivo de estarem relacionadas a operações de terceiros,
   * objeto de reembolso, repasse ou ressarcimento pelo recebedor, já tributados e aqui referenciados
   * xsd:TSRTCTpReeRepRes
   */
  tpReeRepRes: TSRTCTpReeRepRes;
  /**
   * Descrição do reembolso ou ressarcimento quando a opção é
   * "99 – Outros reembolsos ou ressarcimentos recebidos por valores pagos relativos a operações por conta e ordem de terceiro"
   * xsd:TSDesc150, tamanho 1..150
   */
  xTpReeRepRes?: string;
  /**
   * Valor monetário (total ou parcial, conforme documento informado) utilizado para não inclusão na base de cálculo
   * do ISS e do IBS e da CBS da NFS-e que está sendo emitida (R$)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vlrReeRepRes: string;
} & (
  ({
  /** Grupo de informações de documentos fiscais eletrônicos que se encontram no repositório nacional */
  dFeNacional: TCRTCListaDocDFe;
  docFiscalOutro?: never; docOutro?: never;
})
  | ({
  /** Grupo de informações de documento fiscais, eletrônicos ou não, que não se encontram no repositório nacional */
  docFiscalOutro: TCRTCListaDocFiscalOutro;
  dFeNacional?: never; docOutro?: never;
})
  | ({
  /** Grupo de informações de documento não fiscal. */
  docOutro: TCRTCListaDocOutro;
  dFeNacional?: never; docFiscalOutro?: never;
})
);

/** xsd: TCRTCInfoReeRepRes */
export type TCRTCInfoReeRepRes = {
  /**
   * Grupo relativo aos documentos referenciados nos casos de reembolso, repasse e ressarcimento que serão
   * considerados na base de cálculo do ISSQN, do IBS e da CBS
   * ocorre 1..1000
   */
  documentos: TCRTCListaDoc[];
};

/** xsd: TCRTCInfoTributosTribRegular */
export type TCRTCInfoTributosTribRegular = {
  /**
   * Código de Situação Tributária do IBS e da CBS de tributação regular
   * xsd:TSRTCCodSitTrib, pattern `[0-9]{3}`
   */
  CSTReg: string;
  /**
   * Código da Classificação Tributária do IBS e da CBS de tributação regular
   * xsd:TSRTCCodClassTrib, pattern `[0-9]{6}`
   */
  cClassTribReg: string;
};

/** xsd: TCRTCInfoTributosDif */
export type TCRTCInfoTributosDif = {
  /**
   * Percentual de diferimento para o IBS estadual
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pDifUF: string;
  /**
   * Percentual de diferimento para o IBS municipal
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pDifMun: string;
  /**
   * Percentual de diferimento para a CBS
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pDifCBS: string;
};

/** xsd: TCRTCInfoTributosSitClas */
export type TCRTCInfoTributosSitClas = {
  /**
   * Código de Situação Tributária do IBS e da CBS
   * xsd:TSRTCCodSitTrib, pattern `[0-9]{3}`
   */
  CST: string;
  /**
   * Código de Classificação Tributária do IBS e da CBS
   * xsd:TSRTCCodClassTrib, pattern `[0-9]{6}`
   */
  cClassTrib: string;
  /**
   * Código e Classificação do Crédito Presumido: IBS e CBS
   * xsd:TSRTCCodCredPres, pattern `[0-9]{2}`
   */
  cCredPres?: string;
  /** Grupo de informações da Tributação Regular */
  gTribRegular?: TCRTCInfoTributosTribRegular;
  /** Grupo de informações relacionadas ao diferimento para IBS e CBS */
  gDif?: TCRTCInfoTributosDif;
};

/** xsd: TCRTCInfoTributosIBSCBS */
export type TCRTCInfoTributosIBSCBS = {
  /** Grupo de informações relacionadas ao IBS e à CBS */
  gIBSCBS: TCRTCInfoTributosSitClas;
};

/** xsd: TCRTCInfoValoresIBSCBS */
export type TCRTCInfoValoresIBSCBS = {
  /**
   * Grupo de informações relativas a valores incluídos neste documento e recebidos por motivo de estarem relacionadas
   * a operações de terceiros, objeto de reembolso, repasse ou ressarcimento pelo recebedor, já tributados e aqui referenciados
   */
  gReeRepRes?: TCRTCInfoReeRepRes;
  /** Grupo de informações relacionados aos tributos IBS e CBS */
  trib: TCRTCInfoTributosIBSCBS;
};

/**
 * Indicador da finalidade da emissão de NFS-e:
 * 0 - NFS-e regular;
 * xsd:TSRTCFinNFSe
 */
export type TSRTCFinNFSe = "0";

/**
 * Indica operação de uso ou consumo pessoal (art. 57):
 * 0 - Não;
 * 1 - Sim;
 * xsd:TSRTCIndFinal
 */
export type TSRTCIndFinal = "0" | "1";

/**
 * Tipo de Operação com Entes Governamentais ou outros serviços sobre bens imóveis:
 * 1 – Fornecimento com pagamento posterior;
 * 2 - Recebimento do pagamento com fornecimento já realizado;
 * 3 – Fornecimento com pagamento já realizado;
 * 4 – Recebimento do pagamento com fornecimento posterior;
 * 5 – Fornecimento e recebimento do pagamento concomitantes;
 * xsd:TSRTCTpOper
 */
export type TSRTCTpOper = "1" | "2" | "3" | "4" | "5";

/**
 * Tipo de ente governamental
 * Para administração pública direta e suas autarquias e fundações:
 * 1 - União;
 * 2 - Estado;
 * 3 - Distrito Federal;
 * 4 - Município;
 * xsd:TSRTCTpEnteGov
 */
export type TSRTCTpEnteGov = "1" | "2" | "3" | "4";

/**
 * A respeito do Destinatário dos serviços:
 * 0 – o destinatário é o próprio tomador/adquirente identificado na NFS-e (tomador = adquirente = destinatário);
 * 1 – o destinatário não é o próprio adquirente, podendo ser outra pessoa, física ou jurídica (ou equiparada), ou um estabelecimento diferente do indicado como tomador (tomador = adquirente ≠ destinatário);
 * xsd:TSRTCIndDest
 */
export type TSRTCIndDest = "0" | "1";

/** xsd: TCRTCInfoIBSCBS */
export type TCRTCInfoIBSCBS = {
  /**
   * Indicador da finalidade da emissão de NFS-e
   * xsd:TSRTCFinNFSe
   */
  finNFSe: TSRTCFinNFSe;
  /**
   * Indica operação de uso ou consumo pessoal (art. 57)
   * xsd:TSRTCIndFinal
   */
  indFinal?: TSRTCIndFinal;
  /**
   * Código indicador da operação de fornecimento, conforme tabela "código indicador de operação"
   * xsd:TSRTCCodIndOp, pattern `[0-9]{6}`
   */
  cIndOp: string;
  /**
   * Tipo de Operação com Entes Governamentais ou outros serviços sobre bens imóveis
   * xsd:TSRTCTpOper
   */
  tpOper?: TSRTCTpOper;
  /** Grupo de NFS-e referenciadas */
  gRefNFSe?: TCInfoRefNFSe;
  /**
   * Tipo de ente governamental
   * xsd:TSRTCTpEnteGov
   */
  tpEnteGov?: TSRTCTpEnteGov;
  /**
   * A respeito do Destinatário dos serviços
   * xsd:TSRTCIndDest
   */
  indDest: TSRTCIndDest;
  /** Grupo de informações relativas ao Destinatário */
  dest?: TCRTCInfoDest;
  /** Grupo de informações de operações relacionadas a bens imóveis, exceto obras */
  imovel?: TCRTCInfoImovel;
  /** Grupo de informações relativas aos valores do serviço prestado para IBS e CBS */
  valores: TCRTCInfoValoresIBSCBS;
};

/**
 * Tipos de ambiente do Sistema Nacional NFS-e:
 * 1 - Produção;
 * 2 - Homologação;
 * xsd:TSTipoAmbiente
 */
export type TSTipoAmbiente = "1" | "2";

/**
 * Emitente da DPS:
 * 1 - Prestador
 * 2 - Tomador
 * 3 - Intermediário
 * xsd:TSEmitenteDPS
 */
export type TSEmitenteDPS = "1" | "2" | "3";

/**
 * Motivo da Emissão da DPS pelo Tomador/Intermediário:
 * 1 - Importação de Serviço;
 * 2 - Tomador/Intermediário obrigado a emitir NFS-e por legislação municipal;
 * 3 - Tomador/Intermediário emitindo NFS-e por recusa de emissão pelo prestador;
 * 4 - Tomador/Intermediário emitindo por rejeitar a NFS-e emitida pelo prestador;
 * xsd:TSMotivoEmisTI
 */
export type TSMotivoEmisTI = "1" | "2" | "3" | "4";

/** xsd: TCInfDPS */
export type TCInfDPS = {
  /** @attribute xsd:TSIdDPS, tamanho 0..45, pattern `DPS[0-9]{7}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{20}` */
  Id: string;
  /**
   * Identificação do Ambiente: 1 - Produção; 2 - Homologação
   * xsd:TSTipoAmbiente
   */
  tpAmb: TSTipoAmbiente;
  /**
   * Data e hora da emissão do DPS. Data e hora no formato UTC (Universal Coordinated Time): AAAA-MM-DDThh:mm:ssTZD
   * xsd:TSDateTimeUTC
   */
  dhEmi: string;
  /**
   * Versão do aplicativo que gerou o DPS
   * xsd:TSVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Número do equipamento emissor do DPS ou série do DPS
   * xsd:TSSerieDPS, tamanho 0..5, pattern `[0-9]{1,4}|[0-8][0-9]{4}`
   */
  serie: string;
  /**
   * Número do DPS
   * xsd:TSNumDPS, tamanho 0..15, pattern `[1-9]{1}[0-9]{0,14}`
   */
  nDPS: string;
  /**
   * Data em que se iniciou a prestação do serviço: Dia, mês e ano (AAAAMMDD)
   * xsd:TSData
   */
  dCompet: string;
  /**
   * Emitente da DPS: 1 - Prestador; 2 - Tomador; 3 - Intermediário
   * xsd:TSEmitenteDPS
   */
  tpEmit: TSEmitenteDPS;
  /**
   * Motivo da Emissão da DPS pelo Tomador/Intermediário:
   * 1 - Importação de Serviço;
   * 2 - Tomador/Intermediário obrigado a emitir NFS-e por legislação municipal;
   * 3 - Tomador/Intermediário emitindo NFS-e por recusa de emissão pelo prestador;
   * 4 - Tomador/Intermediário emitindo por rejeitar a NFS-e emitida pelo prestador;
   * xsd:TSMotivoEmisTI
   */
  cMotivoEmisTI?: TSMotivoEmisTI;
  /**
   * Chave de Acesso da NFS-e rejeitada pelo Tomador/Intermediário.
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   */
  chNFSeRej?: string;
  /**
   * O código de município utilizado pelo Sistema Nacional NFS-e é o código definido para cada município pertencente ao ""Anexo V – Tabela de Código de Municípios do IBGE"", que consta ao final do Manual de Orientação ao Contribuinte do ISSQN para a Sefin Nacional NFS-e.
   * O município emissor da NFS-e é aquele município em que o emitente da DPS está cadastrado e autorizado a "emitir uma NFS-e", ou seja, emitir uma DPS para que o sistema nacional valide as informações nela prestadas e gere a NFS-e correspondente para o emitente.
   * Para que o sistema nacional emita a NFS-e o município emissor deve ser conveniado e estar ativo no sistema nacional. Além disso o convênio do município deve permitir que os contribuintes do município utilize os emissores públicos do Sistema Nacional NFS-e
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cLocEmi: string;
  /** Dados da NFS-e a ser substituída */
  subst?: TCSubstituicao;
  /** Grupo de informações do DPS relativas ao Prestador de Serviços */
  prest: TCInfoPrestador;
  /** Grupo de informações do DPS relativas ao Tomador de Serviços */
  toma?: TCInfoPessoa;
  /** Grupo de informações do DPS relativas ao Intermediário de Serviços */
  interm?: TCInfoPessoa;
  /** Grupo de informações do DPS relativas ao Serviço Prestado */
  serv: TCServ;
  /** Grupo de informações relativas à valores do serviço prestado */
  valores: TCInfoValores;
  /** Grupo de informações declaradas pelo emitente referentes ao IBS e à CBS */
  IBSCBS?: TCRTCInfoIBSCBS;
};

/** xsd: TCDPS */
export type TCDPS = {
  /** @attribute xsd:TVerNFSe, tamanho 0..4, pattern `1\.00|1\.01` */
  versao: string;
  infDPS: TCInfDPS;
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any?: string[];
};

/**
 * Tipo Sigla da UF
 * xsd:TSUF
 */
export type TSUF = "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR" | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO";

/** xsd: TCEnderecoEmitente */
export type TCEnderecoEmitente = {
  /**
   * Tipo e nome do logradouro da localização do imóvel
   * xsd:TSLogradouro, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr: string;
  /**
   * Número do imóvel
   * xsd:TSNumeroEndereco, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro: string;
  /**
   * Complemento do endereço
   * xsd:TSComplementoEndereco, tamanho 1..156, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TSBairro, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro: string;
  /**
   * Código do município, conforme Tabela do IBGE
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cMun: string;
  /**
   * Sigla da unidade da federação do município do endereço do emitente.
   * xsd:TSUF
   */
  UF: TSUF;
  /**
   * Número do CEP
   * xsd:TSCEP, pattern `[0-9]{8}`
   */
  CEP: string;
};

/** xsd: TCEmitente */
export type TCEmitente = {
  /**
   * Número da inscrição municipal
   * xsd:TSInscMun, tamanho 1..15
   */
  IM?: string;
  /**
   * Nome / Razão Social do emitente.
   * xsd:TSNomeRazaoSocial, tamanho 1..300
   */
  xNome: string;
  /**
   * Nome / Fantasia do emitente.
   * xsd:TSNomeFantasia, tamanho 1..150
   */
  xFant?: string;
  /** Grupo de informações do endereço nacional do Emitente da NFS-e */
  enderNac: TCEnderecoEmitente;
  /**
   * Número do telefone do emitente.
   * (Preencher com o Código DDD + número do telefone.
   * Nas operações com exterior é permitido informar o código do país + código da localidade + número do telefone)
   * xsd:TSTelefone, pattern `[0-9]{6,20}`
   */
  fone?: string;
  /**
   * E-mail do emitente.
   * xsd:TSEmail, tamanho 1..80, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  email?: string;
} & (
  ({
  /**
   * Número do CNPJ do emitente da NFS-e.
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * Número do CPF do emitente da NFS-e.
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Tipo Benefício Municipal (BM):
 * 1) Isenção;
 * 2) Redução da BC em 'ppBM' %;
 * 3) Redução da BC em R$ 'vInfoBM';
 * 4) Alíquota Diferenciada de 'aliqDifBM' %;
 * xsd:TBMISSQN
 */
export type TBMISSQN = "1" | "2" | "3" | "4";

/** xsd: TCValoresNFSe */
export type TCValoresNFSe = {
  /**
   * Valor monetário (R$) de dedução/redução da base de cálculo (BC) do ISSQN.
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCalcDR?: string;
  /**
   * Tipo Benefício Municipal (BM):
   * 1) Isenção;
   * 2) Redução da BC em 'ppBM' %;
   * 3) Redução da BC em R$ 'vInfoBM';
   * 4) Alíquota Diferenciada de 'aliqDifBM' %;
   * xsd:TBMISSQN
   */
  tpBM?: TBMISSQN;
  /**
   * Valor monetário (R$) do percentual de redução da base de cálculo (BC) do ISSQN devido a um benefício municipal (BM).
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCalcBM?: string;
  /**
   * Valor da Base de Cálculo do ISSQN (R$) = Valor do Serviço - Desconto Incondicionado - Deduções/Reduções - Benefício Municipal
   * vBC = vServ - descIncond - (vDR ou vCalcDR + vCalcReeRepRes) - (vRedBCBM ou VCalcBM)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vBC?: string;
  /**
   * Alíquota aplicada sobre a base de cálculo para apuração do ISSQN.
   * xsd:TSDec1V2, pattern `0|[0-9]{1}(\.[0-9]{2})?`
   */
  pAliqAplic?: string;
  /**
   * Valor do ISSQN (R$) = Valor da Base de Cálculo x Alíquota ISSQN = vBC x pAliqAplic
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vISSQN?: string;
  /**
   * Valor total das retenções de tributos da NFS-e.
   * Valor total de retenções (R$) = Σ(vRetCP + vRetIRRF+ vRetCSLL + ISSQN*)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTotalRet?: string;
  /**
   * Valor líquido da NFS-e.
   * Valor líquido (R$) = Valor do serviço - Desconto condicionado - Desconto incondicionado - Valores retidos
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vLiq: string;
};

/** xsd: TCRTCValoresIBSCBSUF */
export type TCRTCValoresIBSCBSUF = {
  /**
   * Alíquota da UF para IBS da localidade de incidência parametrizada no sistema
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pIBSUF: string;
  /**
   * Percentual de redução de alíquota estadual
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pRedAliqUF?: string;
  /**
   * pAliqEfetUF = pIBSUF x (1 - pRedAliqUF) x (1 - pRedutor)
   * Se pRedAliqUF não for informado na DPS, então pAliqEfetUF é a própria pIBSUF
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfetUF: string;
};

/** xsd: TCRTCValoresIBSCBSMun */
export type TCRTCValoresIBSCBSMun = {
  /**
   * Alíquota do Município para IBS da localidade de incidência parametrizada no sistema
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pIBSMun: string;
  /**
   * Percentual de redução de alíquota municipal
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pRedAliqMun?: string;
  /**
   * pAliqEfetMun = pIBSMun x (1 - pRedAliqMun) x (1 - pRedutor)
   * Se pRedAliqMun não for informado na DPS, então pAliqEfetMun é a própria pIBSMun
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfetMun: string;
};

/** xsd: TCRTCValoresIBSCBSFed */
export type TCRTCValoresIBSCBSFed = {
  /**
   * Alíquota da União para CBS parametrizada no sistema
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pCBS: string;
  /**
   * Percentual da redução de alíquota da CBS
   * xsd:TSDec3V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{2})?`
   */
  pRedAliqCBS?: string;
  /**
   * pAliqEfetCBS = pCBS x (1 - pRedAliqCBS) x (1 - pRedutor)
   * Se pRedAliqCBS não for informado na DPS, então pAliqEfetCBS é a própria pCBS
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfetCBS: string;
};

/** xsd: TCRTCValoresIBSCBS */
export type TCRTCValoresIBSCBS = {
  /**
   * Valor da base de cálculo (BC) do IBS/CBS antes das reduções para cálculo do tributo bruto
   * vBC = vServ - descIncond – vCalcReeRepRes – vISSQN – vPIS - vCOFINS (até 2026) ou
   * vBC = vServ - descIncond – vCalcReeRepRes – vISSQN (até 2032)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vBC: string;
  /**
   * Valor monetário (R$) total relativo ao fornecimento próprio de bens materiais ou relacionados a operações de terceiros,
   * objeto de reembolso, repasse ou ressarcimento pelo recebedor, já tributados e aqui referenciados e que não integram
   * da base de cálculo (BC) do ISSQN, do IBS e da CBS.
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCalcReeRepRes?: string;
  /** Grupo de Informações relativas aos valores do IBS Estadual */
  uf: TCRTCValoresIBSCBSUF;
  /** Grupo de Informações relativas aos valores do IBS Municipal */
  mun: TCRTCValoresIBSCBSMun;
  /** Grupo de Informações relativas aos valores da CBS */
  fed: TCRTCValoresIBSCBSFed;
};

/** xsd: TCRTCTotalIBSCredPres */
export type TCRTCTotalIBSCredPres = {
  /**
   * Alíquota do crédito presumido para o IBS
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pCredPresIBS: string;
  /**
   * Valor do Crédito Presumido para o IBS
   * vCredPresIBS = vBC x pCredPresIBS
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCredPresIBS: string;
};

/** xsd: TCRTCTotalIBSUF */
export type TCRTCTotalIBSUF = {
  /**
   * Total do Diferimento do IBS estadual
   * vDifUF = vIBSUF x pDifUF
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDifUF?: string;
  /**
   * Total valor do IBS estadual
   * vIBSUF = vBC x (pIBSUF ou pAliqEfetUF)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vIBSUF: string;
};

/** xsd: TCRTCTotalIBSMun */
export type TCRTCTotalIBSMun = {
  /**
   * Total do Diferimento do IBS municipal
   * vDifMun = vIBSMun x pDifMun
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDifMun?: string;
  /**
   * Total valor do IBS municipal
   * vIBSMun = vBC x (pIBSMun ou pAliqEfetMun)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vIBSMun: string;
};

/** xsd: TCRTCTotalIBS */
export type TCRTCTotalIBS = {
  /**
   * Valor total do IBS.
   * vIBSTot = vIBSUF + vIBSMun
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vIBSTot: string;
  /** Grupo de valores referentes ao crédito presumido para IBS */
  gIBSCredPres?: TCRTCTotalIBSCredPres;
  /** Grupo de valores referentes ao IBS Estadual */
  gIBSUFTot: TCRTCTotalIBSUF;
  /** Grupo de valores referentes ao IBS Municipal */
  gIBSMunTot: TCRTCTotalIBSMun;
};

/** xsd: TCRTCTotalCBSCredPres */
export type TCRTCTotalCBSCredPres = {
  /**
   * Alíquota do crédito presumido para a CBS
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pCredPresCBS: string;
  /**
   * Valor do Crédito Presumido da CBS
   * vCredPresCBS = vBC x pCredPresCBS
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCredPresCBS: string;
};

/** xsd: TCRTCTotalCBS */
export type TCRTCTotalCBS = {
  /** Grupo de valores referentes ao crédito presumido para CBS */
  gCBSCredPres?: TCRTCTotalCBSCredPres;
  /**
   * Total do Diferimento CBS
   * vDifCBS = vCBS x pDifCBS
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vDifCBS?: string;
  /**
   * Total valor da CBS da União
   * vCBS = vBC x (pCBS ou pAliqEfetCBS)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCBS: string;
};

/** xsd: TCRTCTotalTribRegular */
export type TCRTCTotalTribRegular = {
  /**
   * Alíquota efetiva de tributação regular do IBS estadual
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfeRegIBSUF: string;
  /**
   * Valor da tributação regular do IBS estadual
   * vTribRegIBSUF = vBC x pAliqEfeRegIBSUF
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTribRegIBSUF: string;
  /**
   * Alíquota efetiva de tributação regular do IBS municipal
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfeRegIBSMun: string;
  /**
   * Valor da tributação regular do IBS municipal
   * vTribRegIBSMun = vBC x pAliqEfeRegIBSMun
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTribRegIBSMun: string;
  /**
   * Alíquota efetiva de tributação regular da CBS
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pAliqEfeRegCBS: string;
  /**
   * Valor da tributação regular da CBS
   * vTribRegCBS = vBC x pAliqEfeRegCBS
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTribRegCBS: string;
};

/** xsd: TCRTCTotalTribCompraGov */
export type TCRTCTotalTribCompraGov = {
  /**
   * Alíquota do IBS de competência do Estado
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pIBSUF: string;
  /**
   * Valor do Tributo do IBS da UF calculado
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vIBSUF: string;
  /**
   * Alíquota do IBS de competência do Município
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pIBSMun: string;
  /**
   * Valor do Tributo do IBS do Município calculado
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vIBSMun: string;
  /**
   * Alíquota da CBS
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pCBS: string;
  /**
   * Valor do Tributo da CBS calculado
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vCBS: string;
};

/** xsd: TCRTCTotalCIBS */
export type TCRTCTotalCIBS = {
  /**
   * Valor Total da NF considerando os impostos por fora: IBS e CBS
   * O IBS e a CBS são por fora, por isso seus valores devem ser adicionados ao valor total da NF
   * vTotNF = vLiq (em 2026)
   * vTotNF = vLiq + vCBS + vIBSTot (a partir de 2027)
   * xsd:TSDec15V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\.[0-9]{2})?`
   */
  vTotNF: string;
  /** Grupo de valores referentes ao IBS */
  gIBS: TCRTCTotalIBS;
  /** Grupo de valores referentes à CBS */
  gCBS: TCRTCTotalCBS;
  /** Grupo de informações de tributação regular */
  gTribRegular?: TCRTCTotalTribRegular;
  /** Grupo de informações da composição do valor do IBS e da CBS em compras governamentais */
  gTribCompraGov?: TCRTCTotalTribCompraGov;
};

/** xsd: TCRTCIBSCBS */
export type TCRTCIBSCBS = {
  /**
   * Código IBGE da localidade de incidência do IBS/CBS (local da operação)
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cLocalidadeIncid: string;
  /**
   * Nome da localidade de incidência do IBS/CBS
   * xsd:TSDesc600, tamanho 1..600
   */
  xLocalidadeIncid: string;
  /**
   * Percentual de redução de aliquota em compra governamental
   * xsd:TSDec2V2, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\.[0-9]{2})?`
   */
  pRedutor?: string;
  /** Grupo de valores brutos referentes ao IBS/CBS */
  valores: TCRTCValoresIBSCBS;
  /** Grupo de Totalizadores */
  totCIBS: TCRTCTotalCIBS;
};

/**
 * Tipo Ambiente Gerador de NFS-e:
 * 1 - Prefeitura;
 * 2 - Sistema Nacional da NFS-e;
 * xsd:TSAmbGeradorNFSe
 */
export type TSAmbGeradorNFSe = "1" | "2";

/**
 * Tipo de emissão da NFS-e:
 * 1 - Emissão normal no modelo da NFS-e Nacional;
 * 2 - Emissão original em leiaute próprio do município com transcrição para o modelo da NFS-e Nacional.
 * xsd:TSTipoEmissao
 */
export type TSTipoEmissao = "1" | "2";

/**
 * Processo de Emissão da DPS:
 * 1 - Emissão com aplicativo do contribuinte (via Web Service);
 * 2 - Emissão com aplicativo disponibilizado pelo fisco (Web);
 * 3 - Emissão com aplicativo disponibilizado pelo fisco (App);
 * xsd:TSProcEmissao
 */
export type TSProcEmissao = "1" | "2" | "3";

/**
 * Situações possíveis:
 * 100 - NFS-e Gerada;
 * 102 - NFS-e de Decisão Judicial;
 * 103 - NFS-e Avulsa;
 * 107 - NFS-e MEI;
 * xsd:TStat
 */
export type TStat = "100" | "102" | "103" | "107";

/** xsd: TCInfNFSe */
export type TCInfNFSe = {
  /** @attribute xsd:TSIdNFSe, tamanho 0..53, pattern `NFS[0-9]{9}[0-9A-Z]{14}[0-9]{27}` */
  Id: string;
  /**
   * Descrição do código do IBGE do município emissor da NFS-e.
   * xsd:TSDesc150, tamanho 1..150
   */
  xLocEmi: string;
  /**
   * Descrição do local da prestação do serviço.
   * xsd:TSDesc150, tamanho 1..150
   */
  xLocPrestacao: string;
  /**
   * Número sequencial por tipo de emitente da NFS-e.
   * A Sefin Nacional NFS-e irá gerar o número da NFS-e de forma sequencial por emitente. Por se tratar de um ambiente altamente transacional, a Sefin Nacional NFS-e não irá reutilizar números inutilizados durante a geração da NFS-e.
   * xsd:TSNNFSe, tamanho 0..13, pattern `[1-9]{1}[0-9]{0,12}`
   */
  nNFSe: string;
  /**
   * O código de município utilizado pelo Sistema Nacional NFS-e é o código definido para cada município pertencente ao ""Anexo V – Tabela de Código de Municípios do IBGE"", que consta ao final do Manual de Orientação ao Contribuinte do ISSQN para a Sefin Nacional NFS-e.
   * O município de incidência do ISSQN é determinado automaticamente pelo sistema, conforme regras do aspecto espacial da lei complementar federal (LC 116/03) que são válidas para todos  os municípios.
   * http://www.planalto.gov.br/ccivil_03/Leis/LCP/Lcp116.htm
   * xsd:TSCodMunIBGE, pattern `[0-9]{7}`
   */
  cLocIncid?: string;
  /**
   * A descrição do código de município utilizado pelo Sistema Nacional NFS-e é o nome de cada município pertencente ao "Anexo V – Tabela de Código de Municípios do IBGE", que consta ao final do Manual de Orientação ao Contribuinte do ISSQN para a Sefin Nacional NFS-e.
   * xsd:TSDesc150, tamanho 1..150
   */
  xLocIncid?: string;
  /**
   * Descrição do código de tributação nacional do ISSQN.
   * xsd:TSDesc600, tamanho 1..600
   */
  xTribNac: string;
  /**
   * Descrição do código de tributação municipal do ISSQN.
   * xsd:TSDesc600, tamanho 1..600
   */
  xTribMun?: string;
  /**
   * Descrição do código da NBS.
   * xsd:TSDesc600, tamanho 1..600
   */
  xNBS?: string;
  /**
   * Versão do aplicativo que gerou a NFS-e
   * xsd:TSVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Ambiente gerador da NFS-e
   * xsd:TSAmbGeradorNFSe
   */
  ambGer: TSAmbGeradorNFSe;
  /**
   * Processo de Emissão da DPS:
   * 1 - Emissão com aplicativo do contribuinte (via Web Service);
   * 2 - Emissão com aplicativo disponibilizado pelo fisco (Web);
   * 3 - Emissão com aplicativo disponibilizado pelo fisco (App);
   * xsd:TSTipoEmissao
   */
  tpEmis: TSTipoEmissao;
  /**
   * Processo de Emissão da DPS:
   * 1 - Emissão com aplicativo do contribuinte (via Web Service);
   * 2 - Emissão com aplicativo disponibilizado pelo fisco (Web);
   * 3 - Emissão com aplicativo disponibilizado pelo fisco (App);
   * xsd:TSProcEmissao
   */
  procEmi?: TSProcEmissao;
  /**
   * Código do Status da mensagem
   * xsd:TStat
   */
  cStat: TStat;
  /**
   * Data/Hora da validação da DPS e geração da NFS-e. Data e hora no formato UTC (Universal Coordinated Time):AAAA-MM-DDThh:mm:ssTZD
   * xsd:TSDateTimeUTC
   */
  dhProc: string;
  /**
   * Número sequencial do documento gerado por ambiente gerador de DFSe do múnicípio.
   * xsd:TSNDFSe, tamanho 0..13, pattern `[1-9]{1}[0-9]{0,12}`
   */
  nDFSe: string;
  /** Grupo de informações da DPS relativas ao emitente da NFS-e */
  emit: TCEmitente;
  /** Grupo de valores referentes ao Serviço Prestado */
  valores: TCValoresNFSe;
  /**
   * Uso da Administração Tributária Municipal.
   * xsd:TSDesc2000, tamanho 1..2000
   */
  xOutInf?: string;
  /** Grupo de informações geradas pelo sistema referentes ao IBS e à CBS */
  IBSCBS?: TCRTCIBSCBS;
  /** Grupo de informações da DPS relativas ao serviço prestado */
  DPS: TCDPS;
};

/** xsd: TCNFSe */
export type TCNFSe = {
  /** @attribute xsd:TVerNFSe, tamanho 0..4, pattern `1\.00|1\.01` */
  versao: string;
  infNFSe: TCInfNFSe;
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any: string[];
};

/**
 * Código de justificativa de cancelamento:
 * 1 - Erro na Emissão;
 * 2 - Serviço não Prestado;
 * 9 - Outros;
 * xsd:TSCodJustCanc
 */
export type TSCodJustCanc = "1" | "2" | "9";

/** xsd: TE101101 */
export type TE101101 = {
  /** Descrição do Evento: Descrição do evento: "Cancelamento de NFS-e". */
  xDesc: "Cancelamento de NFS-e";
  /**
   * Código de justificativa de cancelamento:
   * 1 - Erro na Emissão;
   * 2 - Serviço não Prestado;
   * 9 - Outros;
   * xsd:TSCodJustCanc
   */
  cMotivo: TSCodJustCanc;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/** xsd: TE105102 */
export type TE105102 = {
  /** Descrição do Evento: Descrição do evento: "Cancelamento de NFS-e por Substituição". */
  xDesc: "Cancelamento de NFS-e por Substituição";
  /**
   * Código de justificativa de cancelamento substituição:
   * 01 - Desenquadramento de NFS-e do Simples Nacional;
   * 02 - Enquadramento de NFS-e no Simples Nacional;
   * 03 - Inclusão Retroativa de Imunidade/Isenção para NFS-e;
   * 04 - Exclusão Retroativa de Imunidade/Isenção para NFS-e;
   * 05 - Rejeição de NFS-e pelo tomador ou pelo intermediário se responsável pelo recolhimento do tributo;
   * 99 - Outros;
   * Obtido do campo da DPS "DPS/infDPS/subst/cMotivo"
   * xsd:TSCodJustSubst
   */
  cMotivo: TSCodJustSubst;
  /**
   * Descrição para explicitar o motivo indicado neste evento.
   * Obtido do campo da DPS "DPS/infDPS/subst/xMotivo".
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo?: string;
  /**
   * Chave de Acesso da NFS-e substituta
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   */
  chSubstituta: string;
};

/**
 * Código do motivo da solicitação de análise fiscal para cancelamento de NFS-e:
 * 1 - Erro na Emissão;
 * 2 - Serviço não Prestado;
 * 3 - Outros.
 * xsd:TSCodJustAnaliseFiscalCanc
 */
export type TSCodJustAnaliseFiscalCanc = "1" | "2" | "9";

/** xsd: TE101103 */
export type TE101103 = {
  /** Descrição do evento: "Solicitação de Análise Fiscal para Cancelamento de NFS-e" */
  xDesc: "Solicitação de Análise Fiscal para Cancelamento de NFS-e";
  /**
   * Código do motivo da solicitação de análise fiscal para cancelamento de NFS-e:
   * 1 - Erro na Emissão;
   * 2 - Serviço não Prestado;
   * 9 - Outros;
   * xsd:TSCodJustAnaliseFiscalCanc
   */
  cMotivo: TSCodJustAnaliseFiscalCanc;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/**
 * Resposta da análise da solicitação do cancelamento extemporâneo de NFS-e:
 * 1 - Cancelamento Extemporâneo Deferido.
 * xsd:TSCodJustAnaliseFiscalCancDef
 */
export type TSCodJustAnaliseFiscalCancDef = "1";

/** xsd: TE105104 */
export type TE105104 = {
  /** Descrição do evento: "Cancelamento de NFS-e Deferido por Análise Fiscal" */
  xDesc: "Cancelamento de NFS-e Deferido por Análise Fiscal";
  /**
   * CPF do agente da administração tributária municipal que efetuou o deferimento da solicitação de análise fiscal para cancelamento de NFS-e.
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Número do processo administrativo municipal vinculado à solicitação de análise fiscal para cancelamento de NFS-e.
   * xsd:TSNumProcAdmAnaliseFiscalCanc, tamanho 1..30, pattern `[0-9]{1,30}`
   */
  nProcAdm?: string;
  /**
   * Resposta da solicitação de análise fiscal para cancelamento de NFS-e:
   * 1 - Cancelamento de NFS-e Deferido.
   * xsd:TSCodJustAnaliseFiscalCancDef
   */
  cMotivo: TSCodJustAnaliseFiscalCancDef;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/**
 * Resposta da análise da solicitação do cancelamento extemporâneo de NFS-e:
 * 1 - Cancelamento Extemporâneo Indeferido;
 * 2 - Cancelamento Extemporâneo Indeferido Sem Análise de Mérito.
 * xsd:TSCodJustAnaliseFiscalCancIndef
 */
export type TSCodJustAnaliseFiscalCancIndef = "1" | "2";

/** xsd: TE105105 */
export type TE105105 = {
  /** Descrição do evento: "Cancelamento de NFS-e Indeferido por Análise Fiscal". */
  xDesc: "Cancelamento de NFS-e Indeferido por Análise Fiscal";
  /**
   * CPF do agente da administração tributária municipal que efetuou o indeferimento da solicitação de análise fiscal para cancelamento de NFS-e.
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Número do processo administrativo municipal vinculado à solicitação de análise fiscal para cancelamento de NFS-e.
   * xsd:TSNumProcAdmAnaliseFiscalCanc, tamanho 1..30, pattern `[0-9]{1,30}`
   */
  nProcAdm?: string;
  /**
   * Resposta da solicitação de análise fiscal para cancelamento de NFS-e:
   * 1 - Cancelamento de NFS-e Indeferido;
   * 2 - Cancelamento de NFS-e Indeferido Sem Análise de Mérito.
   * xsd:TSCodJustAnaliseFiscalCancIndef
   */
  cMotivo: TSCodJustAnaliseFiscalCancIndef;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/** xsd: TE202201 */
export type TE202201 = {
  /** Descrição do evento: "Manifestação de NFS-e - Confirmação do Prestador". */
  xDesc: "Manifestação de NFS-e - Confirmação do Prestador";
};

/** xsd: TE203202 */
export type TE203202 = {
  /** Descrição do evento: "Manifestação de NFS-e - Confirmação do Tomador". */
  xDesc: "Manifestação de NFS-e - Confirmação do Tomador";
};

/** xsd: TE204203 */
export type TE204203 = {
  /** Descrição do evento: "Manifestação de NFS-e - Confirmação do Intermediário". */
  xDesc: "Manifestação de NFS-e - Confirmação do Intermediário";
};

/** xsd: TE205204 */
export type TE205204 = {
  /** Descrição do evento: "Manifestação de NFS-e - Confirmação Tácita". */
  xDesc: "Manifestação de NFS-e - Confirmação Tácita";
};

/**
 * Motivo da Rejeição da NFS-e:
 * 1 - NFS-e em duplicidade;
 * 2 - NFS-e já emitida pelo tomador;
 * 3 - Não ocorrência do fato gerador;
 * 4 - Erro quanto a responsabilidade tributária;
 * 5 - Erro quanto ao valor do serviço, valor das deduções ou serviço prestado ou data do fato gerador;
 * 9 - Outros;
 * xsd:TSCodMotivoRejeicao
 */
export type TSCodMotivoRejeicao = "1" | "2" | "3" | "4" | "5" | "9";

/** xsd: TE202205 */
export type TE202205 = {
  /** Descrição do evento: "Manifestação de NFS-e - Rejeição do Prestador". */
  xDesc: "Manifestação de NFS-e - Rejeição do Prestador";
  /**
   * Motivo da Rejeição da NFS-e:
   * 1 - NFS-e em duplicidade;
   * 2 - NFS-e já emitida pelo tomador;
   * 3 - Não ocorrência do fato gerador;
   * 4 - Erro quanto a responsabilidade tributária;
   * 5 - Erro quanto ao valor do serviço, valor das deduções ou serviço prestado ou data do fato gerador;
   * 9 - Outros;
   * xsd:TSCodMotivoRejeicao
   */
  cMotivo: TSCodMotivoRejeicao;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo?: string;
};

/** xsd: TE203206 */
export type TE203206 = {
  /** Descrição do evento: "Manifestação de NFS-e - Rejeição do Tomador". */
  xDesc: "Manifestação de NFS-e - Rejeição do Tomador";
  /**
   * Motivo da Rejeição da NFS-e:
   * 1 - NFS-e em duplicidade;
   * 2 - NFS-e já emitida pelo tomador;
   * 3 - Não ocorrência do fato gerador;
   * 4 - Erro quanto a responsabilidade tributária;
   * 5 - Erro quanto ao valor do serviço, valor das deduções ou serviço prestado ou data do fato gerador;
   * 9 - Outros;
   * xsd:TSCodMotivoRejeicao
   */
  cMotivo: TSCodMotivoRejeicao;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo?: string;
};

/** xsd: TE204207 */
export type TE204207 = {
  /** Descrição do evento: "Manifestação de NFS-e - Rejeição do Intermediário". */
  xDesc: "Manifestação de NFS-e - Rejeição do Intermediário";
  /**
   * Motivo da Rejeição da NFS-e:
   * 1 - NFS-e em duplicidade;
   * 2 - NFS-e já emitida pelo tomador;
   * 3 - Não ocorrência do fato gerador;
   * 4 - Erro quanto a responsabilidade tributária;
   * 5 - Erro quanto ao valor do serviço, valor das deduções ou serviço prestado ou data do fato gerador;
   * 9 - Outros;
   * xsd:TSCodMotivoRejeicao
   */
  cMotivo: TSCodMotivoRejeicao;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo?: string;
};

/** xsd: TE205208 */
export type TE205208 = {
  /** Descrição do evento: "Manifestação de NFS-e - Anulação da Rejeição". */
  xDesc: "Manifestação de NFS-e - Anulação da Rejeição";
  /**
   * CPF do agente da administração tributária municipal que efetuou o anulação da manifestação de rejeição da NFS-e
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Referência ao "id" do Evento de Manifestação de NFS-e - Rejeição, que originou o presente evento de anulação
   * xsd:TSIdNumEvento, pattern `[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}`
   */
  idEvManifRej: string;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/** xsd: TE305101 */
export type TE305101 = {
  /** Descrição do evento: "Cancelamento de NFS-e por Ofício" */
  xDesc: "Cancelamento de NFS-e por Ofício";
  /**
   * CPF do agente da administração tributária municipal que efetuou o cancelamento por ofício de NFS-e
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Número do processo administrativo municipal vinculado ao cancelamento de NFS-e por ofício
   * xsd:TSNumProcAdmAnaliseFiscalCanc, tamanho 1..30, pattern `[0-9]{1,30}`
   */
  nProcAdm: string;
  /**
   * Descrição para explicitar o motivo do processo administrativo municipal indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xProcAdm: string;
};

/**
 * Código de evento da NFS-e
 * xsd:TSCodigoEventoNFSe
 */
export type TSCodigoEventoNFSe = "e101101" | "e105102" | "e105104" | "e105105" | "e305101";

/** xsd: TE305102 */
export type TE305102 = {
  /** Descrição do evento: "Bloqueio de NFS-e por Ofício". */
  xDesc: "Bloqueio de NFS-e por Ofício";
  /**
   * CPF do agente da administração tributária municipal que efetuou o bloqueio de NFS-e por ofício
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Eventos que podem ser escolhidos pelo município emissor para serem rejeitados após emissão e vinculação do evento de bloqueio por ofício em uma NFS-e:
   * e101101 - Cancelamento de NFS-e;
   * e105102 - Cancelamento de NFS-e por Substituição;
   * e105104 - Cancelamento de NFS-e Deferido por Análise Fiscal;
   * e105105 - Cancelamento de NFS-e Indeferido por Análise Fiscal;
   * e305101 - Cancelamento de NFS-e por Ofício;
   * xsd:TSCodigoEventoNFSe
   */
  codEvento: TSCodigoEventoNFSe;
  /**
   * Descrição para explicitar o motivo indicado neste evento
   * xsd:TSMotivo, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/** xsd: TE305103 */
export type TE305103 = {
  /** Descrição do evento: "Desbloqueio de NFS-e por Ofício". */
  xDesc: "Desbloqueio de NFS-e por Ofício";
  /**
   * CPF do agente da administração tributária municipal que efetuou o desbloqueio de NFS-e por ofício
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAgTrib: string;
  /**
   * Referência ao "id" do "Bloqueio de ofício" que originou o presente evento de desbloqueio
   * xsd:TSIdNumEvento, pattern `[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}`
   */
  idBloqOfic: string;
};

/** xsd: TCInfPedReg */
export type TCInfPedReg = {
  /** @attribute xsd:TSIdPedRegEvt, tamanho 0..59, pattern `PRE[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}` */
  Id: string;
  /**
   * Tipo de ambiente:
   * 1 - Produção;
   * 2 - Homologação;
   * xsd:TSTipoAmbiente
   */
  tpAmb: TSTipoAmbiente;
  /**
   * Versão do aplicativo que gerou o pedido de registro de evento
   * xsd:TSVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Data e hora do evento no formato AAAA-MM-DDThh:mm:ssTZD (UTC - Universal Coordinated Time, onde TZD pode ser -02:00 (Fernando de Noronha), -03:00 (Brasília) ou -04:00 (Manaus), no horário de verão serão -01:00, -02:00 e -03:00. Ex.: 2010-08-19T13:00:15-03:00.
   * xsd:TSDateTimeUTC
   */
  dhEvento: string;
  /**
   * Identificador da NFS-e à qual o evento será vinculado
   * xsd:TSChaveNFSe, tamanho 0..50, pattern `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`
   */
  chNFSe: string;
} & (
  ({
  /**
   * Número de inscrição federal (CNPJ) do autor do evento.
   * CNPJ do autor do evento (parte interessada ou pessoa que figure na NFS-e.
   * O autor do evento não é o procurador)
   * xsd:TSCNPJ, tamanho 0..14, pattern `[0-9A-Z]{14}`
   */
  CNPJAutor: string;
  CPFAutor?: never;
})
  | ({
  /**
   * Número de inscrição federal (CPF) do autor do evento.
   * CPF do autor do evento (parte interessada ou pessoa que figure na NFS-e como prestador, tomador, intermediário.
   * O autor do evento poderá ser o procurador)
   * xsd:TSCPF, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFAutor: string;
  CNPJAutor?: never;
})
) & (
  ({
  /** Evento de cancelamento */
  e101101: TE101101;
  e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Evento de cancelamento por substituição */
  e105102: TE105102;
  e101101?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Solicitação de Análise Fiscal para Cancelamento de NFS-e */
  e101103: TE101103;
  e101101?: never; e105102?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Cancelamento de NFS-e Deferido por Análise Fiscal */
  e105104: TE105104;
  e101101?: never; e105102?: never; e101103?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Cancelamento de NFS-e Indeferido por Análise Fiscal */
  e105105: TE105105;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Confirmação do Prestador */
  e202201: TE202201;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Confirmação do Tomador */
  e203202: TE203202;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Confirmação do Intermediário */
  e204203: TE204203;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Confirmação Tácita */
  e205204: TE205204;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Rejeição do Prestador */
  e202205: TE202205;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Rejeição do Tomador */
  e203206: TE203206;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Rejeição do Intermediário */
  e204207: TE204207;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e205208?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Anulação da Rejeição */
  e205208: TE205208;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e305101?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Cancelamento de NFS-e por Ofício */
  e305101: TE305101;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305102?: never; e305103?: never;
})
  | ({
  /** Bloqueio de NFS-e por Ofício */
  e305102: TE305102;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305103?: never;
})
  | ({
  /** Desbloqueio de NFS-e por Ofício */
  e305103: TE305103;
  e101101?: never; e105102?: never; e101103?: never; e105104?: never; e105105?: never; e202201?: never; e203202?: never; e204203?: never; e205204?: never; e202205?: never; e203206?: never; e204207?: never; e205208?: never; e305101?: never; e305102?: never;
})
);

/** xsd: TCPedRegEvt */
export type TCPedRegEvt = {
  /** @attribute xsd:TVerNFSe, tamanho 0..4, pattern `1\.00|1\.01` */
  versao: string;
  infPedReg: TCInfPedReg;
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any?: string[];
};

/**
 * Tipo Ambiente gerador do evento:
 * 1- Prefeitura;
 * 2- Sefin Nacional;
 * 3- Ambiente Nacional.
 * xsd:TSAmbGeradorEvt
 */
export type TSAmbGeradorEvt = "1" | "2" | "3";

/** xsd: TCInfEvento */
export type TCInfEvento = {
  /** @attribute xsd:TSIdEvento, tamanho 0..62, pattern `EVT[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{36}` */
  Id: string;
  /**
   * Versão do aplicativo que gerou o evento
   * xsd:TSVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Ambiente gerador do evento:
   * 1 - Sistema próprio do município;
   * 2 - Sefin Nacional NFS-e;
   * 3 - ADN NFS-e;
   * xsd:TSAmbGeradorEvt
   */
  ambGer: TSAmbGeradorEvt;
  /**
   * Número sequencial do evento para o mesmo tipo de evento.
   * Para os eventos que ocorrem somente uma vez, como é o caso do cancelamento, o nSeqEvento = 001.
   * Para os eventos que possam existir mais de um evento do mesmo tipo o ambiente gerador deverá numerar de forma sequencial.
   * xsd:TSNum3Dig, tamanho 0..3, pattern `[0-9]{1}[0-9]{0,2}`
   */
  nSeqEvento: string;
  /**
   * Data/Hora do registro do evento.
   * Data e hora no formato UTC (Universal Coordinated Time): AAAA-MM-DDThh:mm:ssTZD
   * xsd:TSDateTimeUTC
   */
  dhProc: string;
  /**
   * Número sequencial do documento gerado por ambiente gerador de DFSe do município
   * xsd:TSNumDFe, pattern `[0-9]{1,13}`
   */
  nDFSe: string;
  /** Leiaute do pedido de registro do evento gerado pelo autor do evento */
  pedRegEvento: TCPedRegEvt;
};

/** xsd: TCEvento */
export type TCEvento = {
  /** @attribute xsd:TVerNFSe, tamanho 0..4, pattern `1\.00|1\.01` */
  versao: string;
  infEvento: TCInfEvento;
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any: string[];
};


// ---------- descritores de tipo simples ----------
const st_TVerNFSe: SimpleType = { b: "string", p: [["1\\.00|1\\.01"]], mx: 4, nm: "TVerNFSe" };
const st_TSIdDPS: SimpleType = { b: "string", p: [["DPS[0-9]{7}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{20}"]], mx: 45, nm: "TSIdDPS" };
const st_TSTipoAmbiente: SimpleType = { b: "string", e: ["1","2"], nm: "TSTipoAmbiente" };
const st_TSDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[13-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([-+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TSDateTimeUTC" };
const st_TSVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TSVerAplic" };
const st_TSSerieDPS: SimpleType = { b: "string", p: [["[0-9]{1,4}|[0-8][0-9]{4}"]], mx: 5, nm: "TSSerieDPS" };
const st_TSNumDPS: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,14}"]], mx: 15, nm: "TSNumDPS" };
const st_TSData: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))"]], nm: "TSData" };
const st_TSEmitenteDPS: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSEmitenteDPS" };
const st_TSMotivoEmisTI: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TSMotivoEmisTI" };
const st_TSChaveNFSe: SimpleType = { b: "string", p: [["[0-9]{6}([0-9A-Z]{14})[0-9]{30}"]], mx: 50, nm: "TSChaveNFSe" };
const st_TSCodMunIBGE: SimpleType = { b: "string", p: [["[0-9]{7}"]], nm: "TSCodMunIBGE" };
const st_TSCodJustSubst: SimpleType = { b: "string", e: ["01","02","03","04","05","99"], nm: "TSCodJustSubst" };
const st_TSMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 15, mx: 255, nm: "TSMotivo" };
const st_TSCNPJ: SimpleType = { b: "string", p: [["[0-9A-Z]{14}"]], mx: 14, nm: "TSCNPJ" };
const st_TSCPF: SimpleType = { b: "string", p: [["[0-9]{11}"]], mx: 11, nm: "TSCPF" };
const st_TSNIF: SimpleType = { b: "string", mn: 1, mx: 40, nm: "TSNIF" };
const st_TSCodNaoNIF: SimpleType = { b: "string", e: ["0","1","2"], nm: "TSCodNaoNIF" };
const st_TSCAEPF: SimpleType = { b: "string", p: [["[0-9]{14}"]], mx: 14, nm: "TSCAEPF" };
const st_TSInscMun: SimpleType = { b: "string", mn: 1, mx: 15, nm: "TSInscMun" };
const st_TSNomeRazaoSocial: SimpleType = { b: "string", mn: 1, mx: 300, nm: "TSNomeRazaoSocial" };
const st_TSCEP: SimpleType = { b: "string", p: [["[0-9]{8}"]], nm: "TSCEP" };
const st_TSCodPaisISO: SimpleType = { b: "string", p: [["[A-Z]{2}"]], nm: "TSCodPaisISO" };
const st_TSCodigoEndPostal: SimpleType = { b: "string", mn: 1, mx: 11, nm: "TSCodigoEndPostal" };
const st_TSCidade: SimpleType = { b: "string", mn: 1, mx: 60, nm: "TSCidade" };
const st_TSEstadoProvRegiao: SimpleType = { b: "string", mn: 1, mx: 60, nm: "TSEstadoProvRegiao" };
const st_TSLogradouro: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TSLogradouro" };
const st_TSNumeroEndereco: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TSNumeroEndereco" };
const st_TSComplementoEndereco: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 156, nm: "TSComplementoEndereco" };
const st_TSBairro: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TSBairro" };
const st_TSTelefone: SimpleType = { b: "string", p: [["[0-9]{6,20}"]], nm: "TSTelefone" };
const st_TSEmail: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 80, nm: "TSEmail" };
const st_TSOpSimpNac: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSOpSimpNac" };
const st_TSRegimeApuracaoSimpNac: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSRegimeApuracaoSimpNac" };
const st_TSRegEspTrib: SimpleType = { b: "string", e: ["0","1","2","3","4","5","6","9"], nm: "TSRegEspTrib" };
const st_TSCodTribNac: SimpleType = { b: "string", p: [["[0-9]{6}"]], nm: "TSCodTribNac" };
const st_TCCodTribMun: SimpleType = { b: "string", p: [["[0-9]{3}"]], nm: "TCCodTribMun" };
const st_TSDesc2000: SimpleType = { b: "string", p: [["[\\s\\S!-ÿ]{1}[\\s\\S -ÿ]{0,}[\\s\\S!-ÿ]{1}|[\\s\\S!-ÿ]{1}"],["[\\s\\S]*[^\\s][\\s\\S]*"]], mn: 1, mx: 2000, nm: "TSDesc2000" };
const st_TSCodNBS: SimpleType = { b: "string", p: [["[0-9]{9}"]], nm: "TSCodNBS" };
const st_TSCodigoInternoContribuinte: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[a-zA-Z0-9]{1,20}"]], mn: 1, mx: 20, nm: "TSCodigoInternoContribuinte" };
const st_TSModoPrestacao: SimpleType = { b: "string", e: ["0","1","2","3","4"], nm: "TSModoPrestacao" };
const st_TSVincPrest: SimpleType = { b: "string", e: ["0","1","2","3","4","5","6","9"], nm: "TSVincPrest" };
const st_TSCodMoeda: SimpleType = { b: "string", p: [["[0-9]{3}"]], mx: 3, nm: "TSCodMoeda" };
const st_TSDec15V2: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,14}(\\.[0-9]{2})?"]], nm: "TSDec15V2" };
const st_TSMecAFComExPrest: SimpleType = { b: "string", e: ["00","01","02","03","04","05","06","07","08"], nm: "TSMecAFComExPrest" };
const st_TSMecAFComExToma: SimpleType = { b: "string", e: ["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26"], nm: "TSMecAFComExToma" };
const st_TSMovTempBens: SimpleType = { b: "string", e: ["0","1","2","3"], nm: "TSMovTempBens" };
const st_TSNumDocImport: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 12, nm: "TSNumDocImport" };
const st_TSNumRegExport: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 12, nm: "TSNumRegExport" };
const st_TSEnvMDIC: SimpleType = { b: "string", e: ["0","1"], nm: "TSEnvMDIC" };
const st_TSInscImobFisc: SimpleType = { b: "string", mn: 1, mx: 30, nm: "TSInscImobFisc" };
const st_TSCodObra: SimpleType = { b: "string", mn: 1, mx: 30, nm: "TSCodObra" };
const st_TSCodCIB: SimpleType = { b: "string", l: 8, nm: "TSCodCIB" };
const st_TSDesc255: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[\\s\\S]*[^\\s][\\s\\S]*"]], mn: 1, mx: 255, nm: "TSDesc255" };
const st_TSIdeEvento: SimpleType = { b: "string", mn: 1, mx: 30, nm: "TSIdeEvento" };
const st_TSDRT: SimpleType = { b: "string", mn: 1, mx: 40, nm: "TSDRT" };
const st_TSDescInfCompl: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[\\s\\S]*[^\\s][\\s\\S]*"]], mn: 1, mx: 2000, nm: "TSDescInfCompl" };
const st_TSDec3V2: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\\.[0-9]{2})?"]], nm: "TSDec3V2" };
const st_TSChaveNFe: SimpleType = { b: "string", p: [["[0-9]{6}([0-9A-Z]{14})[0-9]{24}"]], mx: 44, nm: "TSChaveNFe" };
const st_TSNum15Dig: SimpleType = { b: "string", p: [["[0-9]{15}"]], mx: 15, nm: "TSNum15Dig" };
const st_TSCodVerificacao: SimpleType = { b: "string", p: [["[a-zA-Z0-9]{1,9}"]], mn: 1, mx: 9, nm: "TSCodVerificacao" };
const st_TSNum7Dig: SimpleType = { b: "string", p: [["[0-9]{7}"]], mx: 7, nm: "TSNum7Dig" };
const st_TSSerieNFNFS: SimpleType = { b: "string", p: [["[a-zA-Z0-9]{1,15}"]], mn: 1, mx: 15, nm: "TSSerieNFNFS" };
const st_TSIdeDedRed: SimpleType = { b: "string", e: ["1","2","3","4","5","6","7","8","9","99"], nm: "TSIdeDedRed" };
const st_TSDescOutDedRed: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 150, nm: "TSDescOutDedRed" };
const st$0: SimpleType = { b: "date" };
const st_TSTribISSQN: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TSTribISSQN" };
const st_TSTipoImunidadeISSQN: SimpleType = { b: "string", e: ["0","1","2","3","4","5"], nm: "TSTipoImunidadeISSQN" };
const st_TSOpExigSuspensa: SimpleType = { b: "string", e: ["1","2"], nm: "TSOpExigSuspensa" };
const st_TSNumProcExigSuspensa: SimpleType = { b: "string", p: [["[0-9]{30}"]], nm: "TSNumProcExigSuspensa" };
const st_TSNumBeneficioMunicipal: SimpleType = { b: "string", p: [["[0-9]{14}"]], nm: "TSNumBeneficioMunicipal" };
const st_TSTipoRetISSQN: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSTipoRetISSQN" };
const st_TSDec1V2: SimpleType = { b: "string", p: [["0|[0-9]{1}(\\.[0-9]{2})?"]], nm: "TSDec1V2" };
const st_TSTipoCST: SimpleType = { b: "string", e: ["00","01","02","03","04","05","06","07","08","09","49","50","51","52","53","54","55","56","60","61","62","63","64","65","66","67","70","71","72","73","74","75","98","99"], nm: "TSTipoCST" };
const st_TSDec2V2: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,1}(\\.[0-9]{2})?"]], nm: "TSDec2V2" };
const st_TSTipoRetPISCofins: SimpleType = { b: "string", e: ["0","1","2","3","4","5","6","7","8","9"], nm: "TSTipoRetPISCofins" };
const st_TSTipoIndTotTrib: SimpleType = { b: "string", e: ["0"], nm: "TSTipoIndTotTrib" };
const st_TSRTCFinNFSe: SimpleType = { b: "string", e: ["0"], nm: "TSRTCFinNFSe" };
const st_TSRTCIndFinal: SimpleType = { b: "string", e: ["0","1"], nm: "TSRTCIndFinal" };
const st_TSRTCCodIndOp: SimpleType = { b: "string", p: [["[0-9]{6}"]], nm: "TSRTCCodIndOp" };
const st_TSRTCTpOper: SimpleType = { b: "string", e: ["1","2","3","4","5"], nm: "TSRTCTpOper" };
const st_TSRTCTpEnteGov: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TSRTCTpEnteGov" };
const st_TSRTCIndDest: SimpleType = { b: "string", e: ["0","1"], nm: "TSRTCIndDest" };
const st_TSDesc150: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[\\s\\S]*[^\\s][\\s\\S]*"]], mn: 1, mx: 150, nm: "TSDesc150" };
const st_TSRTCTipoChaveDFe: SimpleType = { b: "string", e: ["1","2","3","9"], nm: "TSRTCTipoChaveDFe" };
const st_TSRTCChaveDFe: SimpleType = { b: "string", mn: 1, mx: 50, nm: "TSRTCChaveDFe" };
const st_TSRTCTpReeRepRes: SimpleType = { b: "string", e: ["01","02","03","04","99"], nm: "TSRTCTpReeRepRes" };
const st_TSRTCCodSitTrib: SimpleType = { b: "string", p: [["[0-9]{3}"]], nm: "TSRTCCodSitTrib" };
const st_TSRTCCodClassTrib: SimpleType = { b: "string", p: [["[0-9]{6}"]], nm: "TSRTCCodClassTrib" };
const st_TSRTCCodCredPres: SimpleType = { b: "string", p: [["[0-9]{2}"]], nm: "TSRTCCodCredPres" };
const st_TSIdNFSe: SimpleType = { b: "string", p: [["NFS[0-9]{9}[0-9A-Z]{14}[0-9]{27}"]], mx: 53, nm: "TSIdNFSe" };
const st_TSNNFSe: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,12}"]], mx: 13, nm: "TSNNFSe" };
const st_TSDesc600: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[\\s\\S]*[^\\s][\\s\\S]*"]], mn: 1, mx: 600, nm: "TSDesc600" };
const st_TSAmbGeradorNFSe: SimpleType = { b: "string", e: ["1","2"], nm: "TSAmbGeradorNFSe" };
const st_TSTipoEmissao: SimpleType = { b: "string", e: ["1","2"], nm: "TSTipoEmissao" };
const st_TSProcEmissao: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSProcEmissao" };
const st_TStat: SimpleType = { b: "string", e: ["100","102","103","107"], nm: "TStat" };
const st_TSNDFSe: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,12}"]], mx: 13, nm: "TSNDFSe" };
const st_TSNomeFantasia: SimpleType = { b: "string", mn: 1, mx: 150, nm: "TSNomeFantasia" };
const st_TSUF: SimpleType = { b: "string", e: ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"], nm: "TSUF" };
const st_TBMISSQN: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TBMISSQN" };
const st_TSIdPedRegEvt: SimpleType = { b: "string", p: [["PRE[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}"]], mx: 59, nm: "TSIdPedRegEvt" };
const st$1: SimpleType = { b: "string", e: ["Cancelamento de NFS-e"] };
const st_TSCodJustCanc: SimpleType = { b: "string", e: ["1","2","9"], nm: "TSCodJustCanc" };
const st$2: SimpleType = { b: "string", e: ["Cancelamento de NFS-e por Substituição"] };
const st$3: SimpleType = { b: "string", e: ["Solicitação de Análise Fiscal para Cancelamento de NFS-e"] };
const st_TSCodJustAnaliseFiscalCanc: SimpleType = { b: "string", e: ["1","2","9"], nm: "TSCodJustAnaliseFiscalCanc" };
const st$4: SimpleType = { b: "string", e: ["Cancelamento de NFS-e Deferido por Análise Fiscal"] };
const st_TSNumProcAdmAnaliseFiscalCanc: SimpleType = { b: "string", p: [["[0-9]{1,30}"]], mn: 1, mx: 30, nm: "TSNumProcAdmAnaliseFiscalCanc" };
const st_TSCodJustAnaliseFiscalCancDef: SimpleType = { b: "string", e: ["1"], nm: "TSCodJustAnaliseFiscalCancDef" };
const st$5: SimpleType = { b: "string", e: ["Cancelamento de NFS-e Indeferido por Análise Fiscal"] };
const st_TSCodJustAnaliseFiscalCancIndef: SimpleType = { b: "string", e: ["1","2"], nm: "TSCodJustAnaliseFiscalCancIndef" };
const st$6: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Confirmação do Prestador"] };
const st$7: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Confirmação do Tomador"] };
const st$8: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Confirmação do Intermediário"] };
const st$9: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Confirmação Tácita"] };
const st$10: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Rejeição do Prestador"] };
const st_TSCodMotivoRejeicao: SimpleType = { b: "string", e: ["1","2","3","4","5","9"], nm: "TSCodMotivoRejeicao" };
const st$11: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Rejeição do Tomador"] };
const st$12: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Rejeição do Intermediário"] };
const st$13: SimpleType = { b: "string", e: ["Manifestação de NFS-e - Anulação da Rejeição"] };
const st_TSIdNumEvento: SimpleType = { b: "string", p: [["[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}"]], nm: "TSIdNumEvento" };
const st$14: SimpleType = { b: "string", e: ["Cancelamento de NFS-e por Ofício"] };
const st$15: SimpleType = { b: "string", e: ["Bloqueio de NFS-e por Ofício"] };
const st_TSCodigoEventoNFSe: SimpleType = { b: "string", e: ["e101101","e105102","e105104","e105105","e305101"], nm: "TSCodigoEventoNFSe" };
const st$16: SimpleType = { b: "string", e: ["Desbloqueio de NFS-e por Ofício"] };
const st_TSIdEvento: SimpleType = { b: "string", p: [["EVT[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{36}"]], mx: 62, nm: "TSIdEvento" };
const st_TSAmbGeradorEvt: SimpleType = { b: "string", e: ["1","2","3"], nm: "TSAmbGeradorEvt" };
const st_TSNum3Dig: SimpleType = { b: "string", p: [["[0-9]{1}[0-9]{0,2}"]], mx: 3, nm: "TSNum3Dig" };
const st_TSNumDFe: SimpleType = { b: "string", p: [["[0-9]{1,13}"]], nm: "TSNumDFe" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TCSubstituicao: ComplexType<TCSubstituicao> = { id: "TCSubstituicao", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "chSubstda", t: st_TSChaveNFSe }, { e: "cMotivo", t: st_TSCodJustSubst }, { e: "xMotivo", t: st_TSMotivo, n: 0 }] } };
export const TCEnderNac: ComplexType<TCEnderNac> = { id: "TCEnderNac", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cMun", t: st_TSCodMunIBGE }, { e: "CEP", t: st_TSCEP }] } };
export const TCEnderExt: ComplexType<TCEnderExt> = { id: "TCEnderExt", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cPais", t: st_TSCodPaisISO }, { e: "cEndPost", t: st_TSCodigoEndPostal }, { e: "xCidade", t: st_TSCidade }, { e: "xEstProvReg", t: st_TSEstadoProvRegiao }] } };
export const TCEndereco: ComplexType<TCEndereco> = { id: "TCEndereco", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "endNac", t: TCEnderNac }, { e: "endExt", t: TCEnderExt }] }, { e: "xLgr", t: st_TSLogradouro }, { e: "nro", t: st_TSNumeroEndereco }, { e: "xCpl", t: st_TSComplementoEndereco, n: 0 }, { e: "xBairro", t: st_TSBairro }] } };
export const TCRegTrib: ComplexType<TCRegTrib> = { id: "TCRegTrib", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "opSimpNac", t: st_TSOpSimpNac }, { e: "regApTribSN", t: st_TSRegimeApuracaoSimpNac, n: 0 }, { e: "regEspTrib", t: st_TSRegEspTrib }] } };
export const TCInfoPrestador: ComplexType<TCInfoPrestador> = { id: "TCInfoPrestador", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TSCNPJ }, { e: "CPF", t: st_TSCPF }, { e: "NIF", t: st_TSNIF }, { e: "cNaoNIF", t: st_TSCodNaoNIF }] }, { e: "CAEPF", t: st_TSCAEPF, n: 0 }, { e: "IM", t: st_TSInscMun, n: 0 }, { e: "xNome", t: st_TSNomeRazaoSocial, n: 0 }, { e: "end", t: TCEndereco, n: 0 }, { e: "fone", t: st_TSTelefone, n: 0 }, { e: "email", t: st_TSEmail, n: 0 }, { e: "regTrib", t: TCRegTrib }] } };
export const TCInfoPessoa: ComplexType<TCInfoPessoa> = { id: "TCInfoPessoa", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TSCNPJ }, { e: "CPF", t: st_TSCPF }, { e: "NIF", t: st_TSNIF }, { e: "cNaoNIF", t: st_TSCodNaoNIF }] }, { e: "CAEPF", t: st_TSCAEPF, n: 0 }, { e: "IM", t: st_TSInscMun, n: 0 }, { e: "xNome", t: st_TSNomeRazaoSocial }, { e: "end", t: TCEndereco, n: 0 }, { e: "fone", t: st_TSTelefone, n: 0 }, { e: "email", t: st_TSEmail, n: 0 }] } };
export const TCLocPrest: ComplexType<TCLocPrest> = { id: "TCLocPrest", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "c", i: [{ e: "cLocPrestacao", t: st_TSCodMunIBGE }, { e: "cPaisPrestacao", t: st_TSCodPaisISO }] } };
export const TCCServ: ComplexType<TCCServ> = { id: "TCCServ", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cTribNac", t: st_TSCodTribNac }, { e: "cTribMun", t: st_TCCodTribMun, n: 0 }, { e: "xDescServ", t: st_TSDesc2000 }, { e: "cNBS", t: st_TSCodNBS, n: 0 }, { e: "cIntContrib", t: st_TSCodigoInternoContribuinte, n: 0 }] } };
export const TCComExterior: ComplexType<TCComExterior> = { id: "TCComExterior", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "mdPrestacao", t: st_TSModoPrestacao }, { e: "vincPrest", t: st_TSVincPrest }, { e: "tpMoeda", t: st_TSCodMoeda }, { e: "vServMoeda", t: st_TSDec15V2 }, { e: "mecAFComexP", t: st_TSMecAFComExPrest }, { e: "mecAFComexT", t: st_TSMecAFComExToma }, { e: "movTempBens", t: st_TSMovTempBens }, { e: "nDI", t: st_TSNumDocImport, n: 0 }, { e: "nRE", t: st_TSNumRegExport, n: 0 }, { e: "mdic", t: st_TSEnvMDIC }] } };
export const TCEnderExtSimples: ComplexType<TCEnderExtSimples> = { id: "TCEnderExtSimples", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cEndPost", t: st_TSCodigoEndPostal }, { e: "xCidade", t: st_TSCidade }, { e: "xEstProvReg", t: st_TSEstadoProvRegiao }] } };
export const TCEnderObraEvento: ComplexType<TCEnderObraEvento> = { id: "TCEnderObraEvento", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CEP", t: st_TSCEP }, { e: "endExt", t: TCEnderExtSimples }] }, { e: "xLgr", t: st_TSLogradouro }, { e: "nro", t: st_TSNumeroEndereco }, { e: "xCpl", t: st_TSComplementoEndereco, n: 0 }, { e: "xBairro", t: st_TSBairro }] } };
export const TCInfoObra: ComplexType<TCInfoObra> = { id: "TCInfoObra", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "inscImobFisc", t: st_TSInscImobFisc, n: 0 }, { g: "c", i: [{ e: "cObra", t: st_TSCodObra }, { e: "cCIB", t: st_TSCodCIB }, { e: "end", t: TCEnderObraEvento }] }] } };
export const TCEnderecoSimples: ComplexType<TCEnderecoSimples> = { id: "TCEnderecoSimples", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CEP", t: st_TSCEP }, { e: "endExt", t: TCEnderExtSimples }] }, { e: "xLgr", t: st_TSLogradouro }, { e: "nro", t: st_TSNumeroEndereco }, { e: "xCpl", t: st_TSComplementoEndereco, n: 0 }, { e: "xBairro", t: st_TSBairro }] } };
export const TCAtvEvento: ComplexType<TCAtvEvento> = { id: "TCAtvEvento", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xNome", t: st_TSDesc255 }, { e: "dtIni", t: st_TSData }, { e: "dtFim", t: st_TSData }, { g: "c", i: [{ e: "idAtvEvt", t: st_TSIdeEvento }, { e: "end", t: TCEnderecoSimples }] }] } };
export const TCInfoItemPed: ComplexType<TCInfoItemPed> = { id: "TCInfoItemPed", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xItemPed", t: st_TSNumeroEndereco, x: 99 }] } };
export const TCInfoCompl: ComplexType<TCInfoCompl> = { id: "TCInfoCompl", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "idDocTec", t: st_TSDRT, n: 0 }, { e: "docRef", t: st_TSDesc255, n: 0 }, { e: "xPed", t: st_TSNumeroEndereco, n: 0 }, { e: "gItemPed", t: TCInfoItemPed, n: 0 }, { e: "xInfComp", t: st_TSDescInfCompl, n: 0 }] } };
export const TCServ: ComplexType<TCServ> = { id: "TCServ", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "locPrest", t: TCLocPrest }, { e: "cServ", t: TCCServ }, { e: "comExt", t: TCComExterior, n: 0 }, { e: "obra", t: TCInfoObra, n: 0 }, { e: "atvEvento", t: TCAtvEvento, n: 0 }, { e: "infoCompl", t: TCInfoCompl, n: 0 }] } };
export const TCVServPrest: ComplexType<TCVServPrest> = { id: "TCVServPrest", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vReceb", t: st_TSDec15V2, n: 0 }, { e: "vServ", t: st_TSDec15V2 }] } };
export const TCVDescCondIncond: ComplexType<TCVDescCondIncond> = { id: "TCVDescCondIncond", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vDescIncond", t: st_TSDec15V2, n: 0 }, { e: "vDescCond", t: st_TSDec15V2, n: 0 }] } };
export const TCDocOutNFSe: ComplexType<TCDocOutNFSe> = { id: "TCDocOutNFSe", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cMunNFSeMun", t: st_TSCodMunIBGE }, { e: "nNFSeMun", t: st_TSNum15Dig }, { e: "cVerifNFSeMun", t: st_TSCodVerificacao }] } };
export const TCDocNFNFS: ComplexType<TCDocNFNFS> = { id: "TCDocNFNFS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "nNFS", t: st_TSNum7Dig }, { e: "modNFS", t: st_TSNum15Dig }, { e: "serieNFS", t: st_TSSerieNFNFS }] } };
export const TCDocDedRed: ComplexType<TCDocDedRed> = { id: "TCDocDedRed", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "chNFSe", t: st_TSChaveNFSe }, { e: "chNFe", t: st_TSChaveNFe }, { e: "NFSeMun", t: TCDocOutNFSe }, { e: "NFNFS", t: TCDocNFNFS }, { e: "nDocFisc", t: st_TSDesc255 }, { e: "nDoc", t: st_TSDesc255 }] }, { e: "tpDedRed", t: st_TSIdeDedRed }, { e: "xDescOutDed", t: st_TSDescOutDedRed, n: 0 }, { e: "dtEmiDoc", t: st$0 }, { e: "vDedutivelRedutivel", t: st_TSDec15V2 }, { e: "vDeducaoReducao", t: st_TSDec15V2 }, { e: "fornec", t: TCInfoPessoa, n: 0 }] } };
export const TCListaDocDedRed: ComplexType<TCListaDocDedRed> = { id: "TCListaDocDedRed", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "docDedRed", t: TCDocDedRed, x: 1000 }] } };
export const TCInfoDedRed: ComplexType<TCInfoDedRed> = { id: "TCInfoDedRed", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "pDR", t: st_TSDec3V2 }, { e: "vDR", t: st_TSDec15V2 }, { e: "documentos", t: TCListaDocDedRed }] }] } };
export const TCExigSuspensa: ComplexType<TCExigSuspensa> = { id: "TCExigSuspensa", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "tpSusp", t: st_TSOpExigSuspensa }, { e: "nProcesso", t: st_TSNumProcExigSuspensa }] } };
export const TCBeneficioMunicipal: ComplexType<TCBeneficioMunicipal> = { id: "TCBeneficioMunicipal", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "nBM", t: st_TSNumBeneficioMunicipal }, { g: "c", i: [{ e: "vRedBCBM", t: st_TSDec15V2, n: 0 }, { e: "pRedBCBM", t: st_TSDec3V2, n: 0 }] }] } };
export const TCTribMunicipal: ComplexType<TCTribMunicipal> = { id: "TCTribMunicipal", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "tribISSQN", t: st_TSTribISSQN }, { e: "cPaisResult", t: st_TSCodPaisISO, n: 0 }, { e: "tpImunidade", t: st_TSTipoImunidadeISSQN, n: 0 }, { e: "exigSusp", t: TCExigSuspensa, n: 0 }, { e: "BM", t: TCBeneficioMunicipal, n: 0 }, { e: "tpRetISSQN", t: st_TSTipoRetISSQN }, { e: "pAliq", t: st_TSDec1V2, n: 0 }] } };
export const TCTribOutrosPisCofins: ComplexType<TCTribOutrosPisCofins> = { id: "TCTribOutrosPisCofins", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "CST", t: st_TSTipoCST }, { e: "vBCPisCofins", t: st_TSDec15V2, n: 0 }, { e: "pAliqPis", t: st_TSDec2V2, n: 0 }, { e: "pAliqCofins", t: st_TSDec2V2, n: 0 }, { e: "vPis", t: st_TSDec15V2, n: 0 }, { e: "vCofins", t: st_TSDec15V2, n: 0 }, { e: "tpRetPisCofins", t: st_TSTipoRetPISCofins, n: 0 }] } };
export const TCTribFederal: ComplexType<TCTribFederal> = { id: "TCTribFederal", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "piscofins", t: TCTribOutrosPisCofins, n: 0 }, { e: "vRetCP", t: st_TSDec15V2, n: 0 }, { e: "vRetIRRF", t: st_TSDec15V2, n: 0 }, { e: "vRetCSLL", t: st_TSDec15V2, n: 0 }] } };
export const TCTribTotalMonet: ComplexType<TCTribTotalMonet> = { id: "TCTribTotalMonet", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vTotTribFed", t: st_TSDec15V2 }, { e: "vTotTribEst", t: st_TSDec15V2 }, { e: "vTotTribMun", t: st_TSDec15V2 }] } };
export const TCTribTotalPercent: ComplexType<TCTribTotalPercent> = { id: "TCTribTotalPercent", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pTotTribFed", t: st_TSDec3V2 }, { e: "pTotTribEst", t: st_TSDec3V2 }, { e: "pTotTribMun", t: st_TSDec3V2 }] } };
export const TCTribTotal: ComplexType<TCTribTotal> = { id: "TCTribTotal", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "vTotTrib", t: TCTribTotalMonet }, { e: "pTotTrib", t: TCTribTotalPercent }, { e: "indTotTrib", t: st_TSTipoIndTotTrib }, { e: "pTotTribSN", t: st_TSDec2V2 }] }] } };
export const TCInfoTributacao: ComplexType<TCInfoTributacao> = { id: "TCInfoTributacao", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "tribMun", t: TCTribMunicipal }, { e: "tribFed", t: TCTribFederal, n: 0 }, { e: "totTrib", t: TCTribTotal }] } };
export const TCInfoValores: ComplexType<TCInfoValores> = { id: "TCInfoValores", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vServPrest", t: TCVServPrest }, { e: "vDescCondIncond", t: TCVDescCondIncond, n: 0 }, { e: "vDedRed", t: TCInfoDedRed, n: 0 }, { e: "trib", t: TCInfoTributacao }] } };
export const TCInfoRefNFSe: ComplexType<TCInfoRefNFSe> = { id: "TCInfoRefNFSe", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "refNFSe", t: st_TSChaveNFSe, x: 99 }] } };
export const TCRTCInfoDest: ComplexType<TCRTCInfoDest> = { id: "TCRTCInfoDest", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TSCNPJ }, { e: "CPF", t: st_TSCPF }, { e: "NIF", t: st_TSNIF }, { e: "cNaoNIF", t: st_TSCodNaoNIF }] }, { e: "xNome", t: st_TSDesc150 }, { e: "end", t: TCEndereco, n: 0 }, { e: "fone", t: st_TSTelefone, n: 0 }, { e: "email", t: st_TSEmail, n: 0 }] } };
export const TCRTCInfoImovel: ComplexType<TCRTCInfoImovel> = { id: "TCRTCInfoImovel", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "inscImobFisc", t: st_TSInscImobFisc, n: 0 }, { g: "c", i: [{ e: "cCIB", t: st_TSCodCIB }, { e: "end", t: TCEnderObraEvento }] }] } };
export const TCRTCListaDocDFe: ComplexType<TCRTCListaDocDFe> = { id: "TCRTCListaDocDFe", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "tipoChaveDFe", t: st_TSRTCTipoChaveDFe }, { e: "xTipoChaveDFe", t: st_TSDesc255, n: 0 }, { e: "chaveDFe", t: st_TSRTCChaveDFe }] } };
export const TCRTCListaDocFiscalOutro: ComplexType<TCRTCListaDocFiscalOutro> = { id: "TCRTCListaDocFiscalOutro", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cMunDocFiscal", t: st_TSNum7Dig }, { e: "nDocFiscal", t: st_TSDesc255 }, { e: "xDocFiscal", t: st_TSDesc255 }] } };
export const TCRTCListaDocOutro: ComplexType<TCRTCListaDocOutro> = { id: "TCRTCListaDocOutro", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "nDoc", t: st_TSDesc255 }, { e: "xDoc", t: st_TSDesc255 }] } };
export const TCRTCListaDocFornec: ComplexType<TCRTCListaDocFornec> = { id: "TCRTCListaDocFornec", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TSCNPJ }, { e: "CPF", t: st_TSCPF }, { e: "NIF", t: st_TSNIF }, { e: "cNaoNIF", t: st_TSCodNaoNIF }] }, { e: "xNome", t: st_TSDesc150 }] } };
export const TCRTCListaDoc: ComplexType<TCRTCListaDoc> = { id: "TCRTCListaDoc", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "dFeNacional", t: TCRTCListaDocDFe }, { e: "docFiscalOutro", t: TCRTCListaDocFiscalOutro }, { e: "docOutro", t: TCRTCListaDocOutro }] }, { e: "fornec", t: TCRTCListaDocFornec, n: 0 }, { e: "dtEmiDoc", t: st_TSData }, { e: "dtCompDoc", t: st_TSData }, { e: "tpReeRepRes", t: st_TSRTCTpReeRepRes }, { e: "xTpReeRepRes", t: st_TSDesc150, n: 0 }, { e: "vlrReeRepRes", t: st_TSDec15V2 }] } };
export const TCRTCInfoReeRepRes: ComplexType<TCRTCInfoReeRepRes> = { id: "TCRTCInfoReeRepRes", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "documentos", t: TCRTCListaDoc, x: 1000 }] } };
export const TCRTCInfoTributosTribRegular: ComplexType<TCRTCInfoTributosTribRegular> = { id: "TCRTCInfoTributosTribRegular", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "CSTReg", t: st_TSRTCCodSitTrib }, { e: "cClassTribReg", t: st_TSRTCCodClassTrib }] } };
export const TCRTCInfoTributosDif: ComplexType<TCRTCInfoTributosDif> = { id: "TCRTCInfoTributosDif", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pDifUF", t: st_TSDec3V2 }, { e: "pDifMun", t: st_TSDec3V2 }, { e: "pDifCBS", t: st_TSDec3V2 }] } };
export const TCRTCInfoTributosSitClas: ComplexType<TCRTCInfoTributosSitClas> = { id: "TCRTCInfoTributosSitClas", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "CST", t: st_TSRTCCodSitTrib }, { e: "cClassTrib", t: st_TSRTCCodClassTrib }, { e: "cCredPres", t: st_TSRTCCodCredPres, n: 0 }, { e: "gTribRegular", t: TCRTCInfoTributosTribRegular, n: 0 }, { e: "gDif", t: TCRTCInfoTributosDif, n: 0 }] } };
export const TCRTCInfoTributosIBSCBS: ComplexType<TCRTCInfoTributosIBSCBS> = { id: "TCRTCInfoTributosIBSCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "gIBSCBS", t: TCRTCInfoTributosSitClas }] } };
export const TCRTCInfoValoresIBSCBS: ComplexType<TCRTCInfoValoresIBSCBS> = { id: "TCRTCInfoValoresIBSCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "gReeRepRes", t: TCRTCInfoReeRepRes, n: 0 }, { e: "trib", t: TCRTCInfoTributosIBSCBS }] } };
export const TCRTCInfoIBSCBS: ComplexType<TCRTCInfoIBSCBS> = { id: "TCRTCInfoIBSCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "finNFSe", t: st_TSRTCFinNFSe }, { e: "indFinal", t: st_TSRTCIndFinal, n: 0 }, { e: "cIndOp", t: st_TSRTCCodIndOp }, { e: "tpOper", t: st_TSRTCTpOper, n: 0 }, { e: "gRefNFSe", t: TCInfoRefNFSe, n: 0 }, { e: "tpEnteGov", t: st_TSRTCTpEnteGov, n: 0 }, { e: "indDest", t: st_TSRTCIndDest }, { e: "dest", t: TCRTCInfoDest, n: 0 }, { e: "imovel", t: TCRTCInfoImovel, n: 0 }, { e: "valores", t: TCRTCInfoValoresIBSCBS }] } };
export const TCInfDPS: ComplexType<TCInfDPS> = { id: "TCInfDPS", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "Id", t: st_TSIdDPS, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TSTipoAmbiente }, { e: "dhEmi", t: st_TSDateTimeUTC }, { e: "verAplic", t: st_TSVerAplic }, { e: "serie", t: st_TSSerieDPS }, { e: "nDPS", t: st_TSNumDPS }, { e: "dCompet", t: st_TSData }, { e: "tpEmit", t: st_TSEmitenteDPS }, { e: "cMotivoEmisTI", t: st_TSMotivoEmisTI, n: 0 }, { e: "chNFSeRej", t: st_TSChaveNFSe, n: 0 }, { e: "cLocEmi", t: st_TSCodMunIBGE }, { e: "subst", t: TCSubstituicao, n: 0 }, { e: "prest", t: TCInfoPrestador }, { e: "toma", t: TCInfoPessoa, n: 0 }, { e: "interm", t: TCInfoPessoa, n: 0 }, { e: "serv", t: TCServ }, { e: "valores", t: TCInfoValores }, { e: "IBSCBS", t: TCRTCInfoIBSCBS, n: 0 }] } };
export const TCDPS: ComplexType<TCDPS> = { id: "TCDPS", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "versao", t: st_TVerNFSe, r: 1 }], c: { g: "s", i: [{ e: "infDPS", t: TCInfDPS }, { w: 1, n: 0 }] } };
export const TCEnderecoEmitente: ComplexType<TCEnderecoEmitente> = { id: "TCEnderecoEmitente", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xLgr", t: st_TSLogradouro }, { e: "nro", t: st_TSNumeroEndereco }, { e: "xCpl", t: st_TSComplementoEndereco, n: 0 }, { e: "xBairro", t: st_TSBairro }, { e: "cMun", t: st_TSCodMunIBGE }, { e: "UF", t: st_TSUF }, { e: "CEP", t: st_TSCEP }] } };
export const TCEmitente: ComplexType<TCEmitente> = { id: "TCEmitente", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TSCNPJ }, { e: "CPF", t: st_TSCPF }] }, { e: "IM", t: st_TSInscMun, n: 0 }, { e: "xNome", t: st_TSNomeRazaoSocial }, { e: "xFant", t: st_TSNomeFantasia, n: 0 }, { e: "enderNac", t: TCEnderecoEmitente }, { e: "fone", t: st_TSTelefone, n: 0 }, { e: "email", t: st_TSEmail, n: 0 }] } };
export const TCValoresNFSe: ComplexType<TCValoresNFSe> = { id: "TCValoresNFSe", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vCalcDR", t: st_TSDec15V2, n: 0 }, { e: "tpBM", t: st_TBMISSQN, n: 0 }, { e: "vCalcBM", t: st_TSDec15V2, n: 0 }, { e: "vBC", t: st_TSDec15V2, n: 0 }, { e: "pAliqAplic", t: st_TSDec1V2, n: 0 }, { e: "vISSQN", t: st_TSDec15V2, n: 0 }, { e: "vTotalRet", t: st_TSDec15V2, n: 0 }, { e: "vLiq", t: st_TSDec15V2 }] } };
export const TCRTCValoresIBSCBSUF: ComplexType<TCRTCValoresIBSCBSUF> = { id: "TCRTCValoresIBSCBSUF", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pIBSUF", t: st_TSDec2V2 }, { e: "pRedAliqUF", t: st_TSDec3V2, n: 0 }, { e: "pAliqEfetUF", t: st_TSDec2V2 }] } };
export const TCRTCValoresIBSCBSMun: ComplexType<TCRTCValoresIBSCBSMun> = { id: "TCRTCValoresIBSCBSMun", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pIBSMun", t: st_TSDec2V2 }, { e: "pRedAliqMun", t: st_TSDec3V2, n: 0 }, { e: "pAliqEfetMun", t: st_TSDec2V2 }] } };
export const TCRTCValoresIBSCBSFed: ComplexType<TCRTCValoresIBSCBSFed> = { id: "TCRTCValoresIBSCBSFed", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pCBS", t: st_TSDec2V2 }, { e: "pRedAliqCBS", t: st_TSDec3V2, n: 0 }, { e: "pAliqEfetCBS", t: st_TSDec2V2 }] } };
export const TCRTCValoresIBSCBS: ComplexType<TCRTCValoresIBSCBS> = { id: "TCRTCValoresIBSCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vBC", t: st_TSDec15V2 }, { e: "vCalcReeRepRes", t: st_TSDec15V2, n: 0 }, { e: "uf", t: TCRTCValoresIBSCBSUF }, { e: "mun", t: TCRTCValoresIBSCBSMun }, { e: "fed", t: TCRTCValoresIBSCBSFed }] } };
export const TCRTCTotalIBSCredPres: ComplexType<TCRTCTotalIBSCredPres> = { id: "TCRTCTotalIBSCredPres", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pCredPresIBS", t: st_TSDec2V2 }, { e: "vCredPresIBS", t: st_TSDec15V2 }] } };
export const TCRTCTotalIBSUF: ComplexType<TCRTCTotalIBSUF> = { id: "TCRTCTotalIBSUF", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vDifUF", t: st_TSDec15V2, n: 0 }, { e: "vIBSUF", t: st_TSDec15V2 }] } };
export const TCRTCTotalIBSMun: ComplexType<TCRTCTotalIBSMun> = { id: "TCRTCTotalIBSMun", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vDifMun", t: st_TSDec15V2, n: 0 }, { e: "vIBSMun", t: st_TSDec15V2 }] } };
export const TCRTCTotalIBS: ComplexType<TCRTCTotalIBS> = { id: "TCRTCTotalIBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vIBSTot", t: st_TSDec15V2 }, { e: "gIBSCredPres", t: TCRTCTotalIBSCredPres, n: 0 }, { e: "gIBSUFTot", t: TCRTCTotalIBSUF }, { e: "gIBSMunTot", t: TCRTCTotalIBSMun }] } };
export const TCRTCTotalCBSCredPres: ComplexType<TCRTCTotalCBSCredPres> = { id: "TCRTCTotalCBSCredPres", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pCredPresCBS", t: st_TSDec2V2 }, { e: "vCredPresCBS", t: st_TSDec15V2 }] } };
export const TCRTCTotalCBS: ComplexType<TCRTCTotalCBS> = { id: "TCRTCTotalCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "gCBSCredPres", t: TCRTCTotalCBSCredPres, n: 0 }, { e: "vDifCBS", t: st_TSDec15V2, n: 0 }, { e: "vCBS", t: st_TSDec15V2 }] } };
export const TCRTCTotalTribRegular: ComplexType<TCRTCTotalTribRegular> = { id: "TCRTCTotalTribRegular", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pAliqEfeRegIBSUF", t: st_TSDec2V2 }, { e: "vTribRegIBSUF", t: st_TSDec15V2 }, { e: "pAliqEfeRegIBSMun", t: st_TSDec2V2 }, { e: "vTribRegIBSMun", t: st_TSDec15V2 }, { e: "pAliqEfeRegCBS", t: st_TSDec2V2 }, { e: "vTribRegCBS", t: st_TSDec15V2 }] } };
export const TCRTCTotalTribCompraGov: ComplexType<TCRTCTotalTribCompraGov> = { id: "TCRTCTotalTribCompraGov", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "pIBSUF", t: st_TSDec2V2 }, { e: "vIBSUF", t: st_TSDec15V2 }, { e: "pIBSMun", t: st_TSDec2V2 }, { e: "vIBSMun", t: st_TSDec15V2 }, { e: "pCBS", t: st_TSDec2V2 }, { e: "vCBS", t: st_TSDec15V2 }] } };
export const TCRTCTotalCIBS: ComplexType<TCRTCTotalCIBS> = { id: "TCRTCTotalCIBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "vTotNF", t: st_TSDec15V2 }, { e: "gIBS", t: TCRTCTotalIBS }, { e: "gCBS", t: TCRTCTotalCBS }, { e: "gTribRegular", t: TCRTCTotalTribRegular, n: 0 }, { e: "gTribCompraGov", t: TCRTCTotalTribCompraGov, n: 0 }] } };
export const TCRTCIBSCBS: ComplexType<TCRTCIBSCBS> = { id: "TCRTCIBSCBS", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "cLocalidadeIncid", t: st_TSCodMunIBGE }, { e: "xLocalidadeIncid", t: st_TSDesc600 }, { e: "pRedutor", t: st_TSDec2V2, n: 0 }, { e: "valores", t: TCRTCValoresIBSCBS }, { e: "totCIBS", t: TCRTCTotalCIBS }] } };
export const TCInfNFSe: ComplexType<TCInfNFSe> = { id: "TCInfNFSe", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "Id", t: st_TSIdNFSe, r: 1 }], c: { g: "s", i: [{ e: "xLocEmi", t: st_TSDesc150 }, { e: "xLocPrestacao", t: st_TSDesc150 }, { e: "nNFSe", t: st_TSNNFSe }, { e: "cLocIncid", t: st_TSCodMunIBGE, n: 0 }, { e: "xLocIncid", t: st_TSDesc150, n: 0 }, { e: "xTribNac", t: st_TSDesc600 }, { e: "xTribMun", t: st_TSDesc600, n: 0 }, { e: "xNBS", t: st_TSDesc600, n: 0 }, { e: "verAplic", t: st_TSVerAplic }, { e: "ambGer", t: st_TSAmbGeradorNFSe }, { e: "tpEmis", t: st_TSTipoEmissao }, { e: "procEmi", t: st_TSProcEmissao, n: 0 }, { e: "cStat", t: st_TStat }, { e: "dhProc", t: st_TSDateTimeUTC }, { e: "nDFSe", t: st_TSNDFSe }, { e: "emit", t: TCEmitente }, { e: "valores", t: TCValoresNFSe }, { e: "xOutInf", t: st_TSDesc2000, n: 0 }, { e: "IBSCBS", t: TCRTCIBSCBS, n: 0 }, { e: "DPS", t: TCDPS }] } };
export const TCNFSe: ComplexType<TCNFSe> = { id: "TCNFSe", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "versao", t: st_TVerNFSe, r: 1 }], c: { g: "s", i: [{ e: "infNFSe", t: TCInfNFSe }, { w: 1 }] } };
export const TE101101: ComplexType<TE101101> = { id: "TE101101", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$1 }, { e: "cMotivo", t: st_TSCodJustCanc }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE105102: ComplexType<TE105102> = { id: "TE105102", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$2 }, { e: "cMotivo", t: st_TSCodJustSubst }, { e: "xMotivo", t: st_TSMotivo, n: 0 }, { e: "chSubstituta", t: st_TSChaveNFSe }] } };
export const TE101103: ComplexType<TE101103> = { id: "TE101103", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$3 }, { e: "cMotivo", t: st_TSCodJustAnaliseFiscalCanc }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE105104: ComplexType<TE105104> = { id: "TE105104", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$4 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "nProcAdm", t: st_TSNumProcAdmAnaliseFiscalCanc, n: 0 }, { e: "cMotivo", t: st_TSCodJustAnaliseFiscalCancDef }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE105105: ComplexType<TE105105> = { id: "TE105105", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$5 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "nProcAdm", t: st_TSNumProcAdmAnaliseFiscalCanc, n: 0 }, { e: "cMotivo", t: st_TSCodJustAnaliseFiscalCancIndef }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE202201: ComplexType<TE202201> = { id: "TE202201", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$6 }] } };
export const TE203202: ComplexType<TE203202> = { id: "TE203202", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$7 }] } };
export const TE204203: ComplexType<TE204203> = { id: "TE204203", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$8 }] } };
export const TE205204: ComplexType<TE205204> = { id: "TE205204", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$9 }] } };
export const TE202205: ComplexType<TE202205> = { id: "TE202205", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$10 }, { e: "cMotivo", t: st_TSCodMotivoRejeicao }, { e: "xMotivo", t: st_TSMotivo, n: 0 }] } };
export const TE203206: ComplexType<TE203206> = { id: "TE203206", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$11 }, { e: "cMotivo", t: st_TSCodMotivoRejeicao }, { e: "xMotivo", t: st_TSMotivo, n: 0 }] } };
export const TE204207: ComplexType<TE204207> = { id: "TE204207", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$12 }, { e: "cMotivo", t: st_TSCodMotivoRejeicao }, { e: "xMotivo", t: st_TSMotivo, n: 0 }] } };
export const TE205208: ComplexType<TE205208> = { id: "TE205208", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$13 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "idEvManifRej", t: st_TSIdNumEvento }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE305101: ComplexType<TE305101> = { id: "TE305101", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$14 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "nProcAdm", t: st_TSNumProcAdmAnaliseFiscalCanc }, { e: "xProcAdm", t: st_TSMotivo }] } };
export const TE305102: ComplexType<TE305102> = { id: "TE305102", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$15 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "codEvento", t: st_TSCodigoEventoNFSe }, { e: "xMotivo", t: st_TSMotivo }] } };
export const TE305103: ComplexType<TE305103> = { id: "TE305103", ns: "http://www.sped.fazenda.gov.br/nfse", c: { g: "s", i: [{ e: "xDesc", t: st$16 }, { e: "CPFAgTrib", t: st_TSCPF }, { e: "idBloqOfic", t: st_TSIdNumEvento }] } };
export const TCInfPedReg: ComplexType<TCInfPedReg> = { id: "TCInfPedReg", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "Id", t: st_TSIdPedRegEvt, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TSTipoAmbiente }, { e: "verAplic", t: st_TSVerAplic }, { e: "dhEvento", t: st_TSDateTimeUTC }, { g: "c", i: [{ e: "CNPJAutor", t: st_TSCNPJ }, { e: "CPFAutor", t: st_TSCPF }] }, { e: "chNFSe", t: st_TSChaveNFSe }, { g: "c", i: [{ e: "e101101", t: TE101101 }, { e: "e105102", t: TE105102 }, { e: "e101103", t: TE101103 }, { e: "e105104", t: TE105104 }, { e: "e105105", t: TE105105 }, { e: "e202201", t: TE202201 }, { e: "e203202", t: TE203202 }, { e: "e204203", t: TE204203 }, { e: "e205204", t: TE205204 }, { e: "e202205", t: TE202205 }, { e: "e203206", t: TE203206 }, { e: "e204207", t: TE204207 }, { e: "e205208", t: TE205208 }, { e: "e305101", t: TE305101 }, { e: "e305102", t: TE305102 }, { e: "e305103", t: TE305103 }] }] } };
export const TCPedRegEvt: ComplexType<TCPedRegEvt> = { id: "TCPedRegEvt", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "versao", t: st_TVerNFSe, r: 1 }], c: { g: "s", i: [{ e: "infPedReg", t: TCInfPedReg }, { w: 1, n: 0 }] } };
export const TCInfEvento: ComplexType<TCInfEvento> = { id: "TCInfEvento", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "Id", t: st_TSIdEvento, r: 1 }], c: { g: "s", i: [{ e: "verAplic", t: st_TSVerAplic }, { e: "ambGer", t: st_TSAmbGeradorEvt }, { e: "nSeqEvento", t: st_TSNum3Dig }, { e: "dhProc", t: st_TSDateTimeUTC }, { e: "nDFSe", t: st_TSNumDFe }, { e: "pedRegEvento", t: TCPedRegEvt }] } };
export const TCEvento: ComplexType<TCEvento> = { id: "TCEvento", ns: "http://www.sped.fazenda.gov.br/nfse", a: [{ a: "versao", t: st_TVerNFSe, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TCInfEvento }, { w: 1 }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `DPS` (tipo TCDPS). */
export const DPSElement: ElementoRaiz<TCDPS> = { nome: "DPS", ns: "http://www.sped.fazenda.gov.br/nfse", tipo: TCDPS };
/** Elemento raiz `NFSe` (tipo TCNFSe). */
export const NFSeElement: ElementoRaiz<TCNFSe> = { nome: "NFSe", ns: "http://www.sped.fazenda.gov.br/nfse", tipo: TCNFSe };
/** Elemento raiz `pedRegEvento` (tipo TCPedRegEvt). */
export const pedRegEventoElement: ElementoRaiz<TCPedRegEvt> = { nome: "pedRegEvento", ns: "http://www.sped.fazenda.gov.br/nfse", tipo: TCPedRegEvt };
/** Elemento raiz `evento` (tipo TCEvento). */
export const eventoElement: ElementoRaiz<TCEvento> = { nome: "evento", ns: "http://www.sped.fazenda.gov.br/nfse", tipo: TCEvento };
