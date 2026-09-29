/**
 * Erros tipados do sinete (princípio 7).
 *
 * Todo erro lançado por um pacote `@sinete/*` é um `SineteError` com um `code` estável: snake_case, em português,
 * sem acento. O `code` faz parte da API pública; renomear um código é mudança incompatível (major). A mensagem é
 * para gente e pode mudar a qualquer versão, então nunca decida nada pela mensagem.
 *
 * Rejeição da SEFAZ não é erro: é um `SefazOutcome` (ver `result.ts`). Erro é o que impede de obter uma resposta
 * (configuração, validação local, transporte, resposta malformada) ou o `unwrapAuthorized` de um resultado não
 * autorizado.
 */

/**
 * Marca registrada no registro global de símbolos. Duas cópias do `@sinete/core` no mesmo processo (versões
 * diferentes na árvore de dependências) não compartilham a classe, então `instanceof` falha entre elas; a marca não.
 */
const SINETE_ERROR: unique symbol = Symbol.for('sinete.error');

/** Detalhes estruturados do erro, serializáveis e sem segredo (nunca PIN, chave ou certificado). */
export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface SineteErrorOptions {
  /** Erro original, preservado como `Error.cause`. */
  readonly cause?: unknown;
  readonly details?: ErrorDetails;
}

/** Forma do erro em `JSON.stringify`, para log estruturado. */
export interface SerializedError {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  /** Página do código na documentação embarcada (veja `SineteError.docs`). */
  readonly docs?: string;
  readonly details?: ErrorDetails;
  readonly cause?: SerializedError | { readonly name: string; readonly message: string } | string;
}

function serializeCause(cause: unknown): NonNullable<SerializedError['cause']> {
  if (isSineteError(cause)) return cause.toJSON();
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
export class SineteError<C extends string = string> extends Error {
  static {
    Object.defineProperty(SineteError.prototype, SINETE_ERROR, { value: true });
  }

  readonly code: C;
  readonly details: ErrorDetails | undefined;
  /**
   * Caminho da página deste código na documentação embarcada (`erros/<code>.md`), relativo à pasta `docs/` do pacote
   * `sinete` ou do `@sinete/emissor` instalado: causa, correção canônica e armadilha. Propriedade própria, para aparecer
   * quando o runtime imprime o erro.
   */
  readonly docs: string;

  constructor(code: C, message: string, options: SineteErrorOptions = {}) {
    super(message, 'cause' in options ? { cause: options.cause } : undefined);
    // Nome fixo em cada classe: `constructor.name` não sobrevive à minificação do bundler do consumidor.
    this.name = 'SineteError';
    this.code = code;
    this.details = options.details;
    this.docs = paginaDoErro(code);
  }

  toJSON(): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      docs: this.docs,
      ...(this.details === undefined ? {} : { details: this.details }),
      ...(this.cause === undefined ? {} : { cause: serializeCause(this.cause) }),
    };
  }
}

/**
 * Confere se `value` é um `SineteError`, inclusive vindo de outra cópia do pacote. Com `code`, confere também o
 * código.
 */
export function isSineteError(value: unknown, code?: string): value is SineteError {
  if (typeof value !== 'object' || value === null) return false;
  if ((value as { [SINETE_ERROR]?: unknown })[SINETE_ERROR] !== true) return false;
  return code === undefined || (value as { code?: unknown }).code === code;
}

/** Configuração inválida passada pelo chamador (opção ausente, valor fora do domínio, data inválida). */
export class ConfigError extends SineteError<'config_invalida'> {
  constructor(message: string, options?: SineteErrorOptions) {
    super('config_invalida', message, options);
    this.name = 'ConfigError';
  }
}

/**
 * De onde vem uma ocorrência (ADR 0011):
 * - `entrada`: conferência feita sobre a entrada do domínio (`NfeInput`, `MdfeInput`, `DpsInput`), antes de montar o
 *   documento. O `path` é um caminho da entrada (`emitente.IE`, `itens[0].produto.NCM`) e corrigir o valor ali resolve.
 * - `montagem`: conferência feita sobre o que o sinete produziu a partir da entrada: o XML contra o XSD e o PL, a chave
 *   gerada, o grupo IBS/CBS devolvido pela calculadora e as regras da NT sobre ele. O `path` é do documento montado
 *   (`/infNFe/ide/natOp`, `infNFe.det[0].prod.xProd`) ou o item da entrada a que o resultado pertence. A causa pode
 *   ainda ser um valor da entrada (um texto longo copiado como veio), mas o sinete não sabe qual.
 */
export type OrigemOcorrencia = 'entrada' | 'montagem';

/** Uma ocorrência de validação local, com o caminho do campo (`infNFe.emit.CNPJ`, `[3].cUF`). */
export interface ValidationIssue {
  readonly path: string;
  /** Código estável da ocorrência, no mesmo formato dos códigos de erro. */
  readonly code: string;
  readonly message: string;
  /**
   * De onde vem a ocorrência (veja `OrigemOcorrencia`). Os montadores do sinete (`buildNfe`, `buildMdfe`, `buildDps`)
   * sempre preenchem; ausente, a ocorrência não foi classificada (validadores avulsos, ocorrência criada fora do
   * sinete).
   */
  readonly origem?: OrigemOcorrencia;
}

/** Dado recusado pela validação local, antes de chegar à SEFAZ. Traz todas as ocorrências, não só a primeira. */
export class ValidationError extends SineteError<'validacao_falhou'> {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[], options?: SineteErrorOptions) {
    super('validacao_falhou', message, options);
    this.name = 'ValidationError';
    this.issues = issues;
  }

  override toJSON(): SerializedError {
    return { ...super.toJSON(), details: { ...this.details, issues: this.issues } };
  }
}

/** A runtime ou o ambiente não suporta o recurso pedido (ex.: o transporte do Deno para um host com renegociação). */
export class UnsupportedError extends SineteError<'nao_suportado'> {
  constructor(message: string, options?: SineteErrorOptions) {
    super('nao_suportado', message, options);
    this.name = 'UnsupportedError';
  }
}

/**
 * O autorizador não oferece o serviço pedido para a UF ou o ambiente, segundo a tabela oficial de web services (ex.: a
 * Distribuição DF-e da NFC-e, um serviço que o autorizador pedido não tem naquele ambiente). É um fato dos dados,
 * não um erro de configuração: repetir falha igual, e o integrador decide o que fazer sem o serviço. `details` traz
 * `autorizador`, `servico`, `ambiente` e, quando houver, `uf` e a `source` da tabela.
 */
export class ServicoNaoOferecidoError extends SineteError<'servico_nao_oferecido'> {
  constructor(message: string, options?: SineteErrorOptions) {
    super('servico_nao_oferecido', message, options);
    this.name = 'ServicoNaoOferecidoError';
  }
}

/** Uma operação passou do prazo configurado. */
export class TimeoutError extends SineteError<'tempo_esgotado'> {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, options?: SineteErrorOptions) {
    super('tempo_esgotado', message, options);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** A resposta recebida não segue o leiaute esperado (XML malformado, grupo obrigatório ausente, cStat inválido). */
export class ProtocolError extends SineteError<'resposta_invalida'> {
  constructor(message: string, options?: SineteErrorOptions) {
    super('resposta_invalida', message, options);
    this.name = 'ProtocolError';
  }
}

/** Códigos lançados pelas classes do `@sinete/core`. Os outros pacotes declaram os próprios. */
export type CoreErrorCode =
  | 'config_invalida'
  | 'validacao_falhou'
  | 'nao_suportado'
  | 'servico_nao_oferecido'
  | 'tempo_esgotado'
  | 'resposta_invalida'
  | SefazErrorCode;

/** Códigos do `SefazError`, um por desfecho não autorizado. */
export type SefazErrorCode = 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente';

/** Lançado por `unwrapAuthorized` quando o desfecho não é autorização. Carrega `cStat` e `xMotivo` oficiais. */
export class SefazError extends SineteError<SefazErrorCode> {
  readonly cStat: string;
  readonly xMotivo: string;

  constructor(code: SefazErrorCode, cStat: string, xMotivo: string, options?: SineteErrorOptions) {
    super(code, `SEFAZ ${cStat}: ${xMotivo}`, options);
    this.name = 'SefazError';
    this.cStat = cStat;
    this.xMotivo = xMotivo;
  }

  override toJSON(): SerializedError {
    return { ...super.toJSON(), details: { ...this.details, cStat: this.cStat, xMotivo: this.xMotivo } };
  }
}
