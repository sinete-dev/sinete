/**
 * Erros tipados do sinete (princípio 7).
 *
 * Todo erro lançado por um pacote `@sinete/*` é um `ErroSinete` com um `code` estável: snake_case, em português,
 * sem acento. O `code` faz parte da API pública; renomear um código é mudança incompatível (major). A mensagem é
 * para gente e pode mudar a qualquer versão, então nunca decida nada pela mensagem.
 *
 * Rejeição da SEFAZ não é erro: é um `ResultadoSefaz` (ver `result.ts`). Erro é o que impede de obter uma resposta
 * (configuração, validação local, transporte, resposta malformada) ou o `exigirAutorizado` de um resultado não
 * autorizado.
 */

/**
 * Marca registrada no registro global de símbolos. Duas cópias do `@sinete/core` no mesmo processo (versões
 * diferentes na árvore de dependências) não compartilham a classe, então `instanceof` falha entre elas; a marca não.
 */
const SINETE_ERROR: unique symbol = Symbol.for('sinete.error');

/** Detalhes estruturados do erro, serializáveis e sem segredo (nunca PIN, chave ou certificado). */
export type DetalhesDoErro = Readonly<Record<string, unknown>>;

export interface ErroSineteOpcoes {
  /** Erro original, preservado como `Error.cause`. */
  readonly cause?: unknown;
  readonly detalhes?: DetalhesDoErro;
}

/** Forma do erro em `JSON.stringify`, para log estruturado. */
export interface ErroSerializado {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  /** Página do código na documentação embarcada (veja `ErroSinete.pagina`). */
  readonly pagina?: string;
  readonly detalhes?: DetalhesDoErro;
  readonly cause?: ErroSerializado | { readonly name: string; readonly message: string } | string;
}

function serializeCause(cause: unknown): NonNullable<ErroSerializado['cause']> {
  if (ehErroSinete(cause)) return cause.toJSON();
  if (cause instanceof Error) return { name: cause.name, message: cause.message };
  return String(cause);
}

/**
 * Página de um código de erro na documentação embarcada, relativa à pasta `docs/` do pacote `sinete` ou do
 * `@sinete/emissor` (`node_modules/sinete/docs/erros/<code>.md`). O `bun run check` confere que todo código lançado
 * pelos pacotes tem a página.
 */
export function paginaDoErro(code: string): string {
  return `erros/${code}.md`;
}

/** Base de todos os erros do sinete. */
export class ErroSinete<C extends string = string> extends Error {
  static {
    Object.defineProperty(ErroSinete.prototype, SINETE_ERROR, { value: true });
  }

  readonly code: C;
  readonly detalhes: DetalhesDoErro | undefined;
  /**
   * Caminho da página deste código na documentação embarcada (`erros/<code>.md`), relativo à pasta `docs/` do pacote
   * `sinete` ou do `@sinete/emissor` instalado: causa, correção canônica e armadilha. Propriedade própria, para aparecer
   * quando o runtime imprime o erro.
   */
  readonly pagina: string;

  constructor(code: C, message: string, options: ErroSineteOpcoes = {}) {
    super(message, 'cause' in options ? { cause: options.cause } : undefined);
    // Nome fixo em cada classe: `constructor.name` não sobrevive à minificação do bundler do consumidor.
    this.name = 'ErroSinete';
    this.code = code;
    this.detalhes = options.detalhes;
    this.pagina = paginaDoErro(code);
  }

  toJSON(): ErroSerializado {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      pagina: this.pagina,
      ...(this.detalhes === undefined ? {} : { detalhes: this.detalhes }),
      ...(this.cause === undefined ? {} : { cause: serializeCause(this.cause) }),
    };
  }
}

/**
 * Confere se `valor` é um `ErroSinete`, inclusive vindo de outra cópia do pacote. Com `code`, confere também o
 * código.
 */
export function ehErroSinete(valor: unknown, code?: string): valor is ErroSinete {
  if (typeof valor !== 'object' || valor === null) return false;
  if ((valor as { [SINETE_ERROR]?: unknown })[SINETE_ERROR] !== true) return false;
  return code === undefined || (valor as { code?: unknown }).code === code;
}

/** Configuração inválida passada pelo chamador (opção ausente, valor fora do domínio, data inválida). */
export class ErroDeConfiguracao extends ErroSinete<'config_invalida'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('config_invalida', message, options);
    this.name = 'ErroDeConfiguracao';
  }
}

/**
 * De onde vem uma ocorrência (ADR 0011):
 * - `entrada`: conferência feita sobre a entrada do domínio (`NfeInput`, `MdfeInput`, `DpsInput`), antes de montar o
 *   documento. O `caminho` é um caminho da entrada (`emitente.IE`, `itens[0].produto.NCM`) e corrigir o valor ali resolve.
 * - `montagem`: conferência feita sobre o que o sinete produziu a partir da entrada: o XML contra o XSD e o PL, a chave
 *   gerada, o grupo IBS/CBS devolvido pela calculadora e as regras da NT sobre ele. O `caminho` é do documento montado
 *   (`/infNFe/ide/natOp`, `infNFe.det[0].prod.xProd`) ou o item da entrada a que o resultado pertence. A causa pode
 *   ainda ser um valor da entrada (um texto longo copiado como veio), mas o sinete não sabe qual.
 */
export type OrigemOcorrencia = 'entrada' | 'montagem';

/** Uma ocorrência de validação local, com o caminho do campo (`infNFe.emit.CNPJ`, `[3].cUF`). */
export interface Ocorrencia {
  readonly caminho: string;
  /** Código estável da ocorrência, no mesmo formato dos códigos de erro. */
  readonly code: string;
  readonly mensagem: string;
  /**
   * De onde vem a ocorrência (veja `OrigemOcorrencia`). Os montadores do sinete (`buildNfe`, `buildMdfe`, `buildDps`)
   * sempre preenchem; ausente, a ocorrência não foi classificada (validadores avulsos, ocorrência criada fora do
   * sinete).
   */
  readonly origem?: OrigemOcorrencia;
}

/** Dado recusado pela validação local, antes de chegar à SEFAZ. Traz todas as ocorrências, não só a primeira. */
export class ErroDeValidacao extends ErroSinete<'validacao_falhou'> {
  readonly ocorrencias: readonly Ocorrencia[];

  constructor(message: string, ocorrencias: readonly Ocorrencia[], options?: ErroSineteOpcoes) {
    super('validacao_falhou', message, options);
    this.name = 'ErroDeValidacao';
    this.ocorrencias = ocorrencias;
  }

  override toJSON(): ErroSerializado {
    return { ...super.toJSON(), detalhes: { ...this.detalhes, ocorrencias: this.ocorrencias } };
  }
}

/** A runtime ou o ambiente não suporta o recurso pedido (ex.: o transporte do Deno para um host com renegociação). */
export class ErroNaoSuportado extends ErroSinete<'nao_suportado'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('nao_suportado', message, options);
    this.name = 'ErroNaoSuportado';
  }
}

/**
 * O autorizador não oferece o serviço pedido para a UF ou o ambiente, segundo a tabela oficial de web services (ex.: a
 * Distribuição DF-e da NFC-e, um serviço que o autorizador pedido não tem naquele ambiente). É um fato dos dados,
 * não um erro de configuração: repetir falha igual, e o integrador decide o que fazer sem o serviço. `detalhes` traz
 * `autorizador`, `servico`, `ambiente` e, quando houver, `uf` e a `source` da tabela.
 */
export class ErroServicoNaoOferecido extends ErroSinete<'servico_nao_oferecido'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('servico_nao_oferecido', message, options);
    this.name = 'ErroServicoNaoOferecido';
  }
}

/** Uma operação passou do prazo configurado. */
export class ErroDeTempoEsgotado extends ErroSinete<'tempo_esgotado'> {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, options?: ErroSineteOpcoes) {
    super('tempo_esgotado', message, options);
    this.name = 'ErroDeTempoEsgotado';
    this.timeoutMs = timeoutMs;
  }
}

/** A resposta recebida não segue o leiaute esperado (XML malformado, grupo obrigatório ausente, cStat inválido). */
export class ErroRespostaInvalida extends ErroSinete<'resposta_invalida'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('resposta_invalida', message, options);
    this.name = 'ErroRespostaInvalida';
  }
}

/** Códigos lançados pelas classes do `@sinete/core`. Os outros pacotes declaram os próprios. */
export type CodigoErroCore =
  | 'config_invalida'
  | 'validacao_falhou'
  | 'nao_suportado'
  | 'servico_nao_oferecido'
  | 'tempo_esgotado'
  | 'resposta_invalida'
  | CodigoErroSefaz;

/** Códigos do `ErroSefaz`, um por desfecho não autorizado. */
export type CodigoErroSefaz = 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente';

/** Lançado por `exigirAutorizado` quando o desfecho não é autorização. Carrega `cStat` e `xMotivo` oficiais. */
export class ErroSefaz extends ErroSinete<CodigoErroSefaz> {
  readonly cStat: string;
  readonly xMotivo: string;

  constructor(code: CodigoErroSefaz, cStat: string, xMotivo: string, options?: ErroSineteOpcoes) {
    super(code, `SEFAZ ${cStat}: ${xMotivo}`, options);
    this.name = 'ErroSefaz';
    this.cStat = cStat;
    this.xMotivo = xMotivo;
  }

  override toJSON(): ErroSerializado {
    return { ...super.toJSON(), detalhes: { ...this.detalhes, cStat: this.cStat, xMotivo: this.xMotivo } };
  }
}
