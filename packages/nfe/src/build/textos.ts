/**
 * Texto e tamanho dos campos de texto da NF-e conferidos na entrada (ADR 0011, revisão de 01/10/2026).
 *
 * Antes, o caractere que o XML não representa e o texto fora do tipo do leiaute (tamanho, espaço nas pontas,
 * caractere fora do `TString`) só apareciam na montagem, com o caminho do XML (`infNFe.det[0].prod.xProd` ou
 * `/infNFe/det[1]/prod/xProd`). Conferidos aqui, saem com `origem: 'entrada'` e o caminho da entrada
 * (`itens[0].produto.xProd`), que é o que a pessoa corrige.
 *
 * O tipo de cada campo vem do schema do PL da montagem (o `TString` com o `maxLength` do elemento), nunca de um número
 * escrito aqui: a tabela abaixo só diz qual elemento do `infNFe` recebe cada campo da entrada.
 */

import type { ComplexType, OcorrenciaSchema, Particle, SimpleType } from '@sinete/schemas';
import { conferirTipoSimples, ehComplexType, ehElementParticle, ehWildcard } from '@sinete/schemas';
import type { Issues } from '../issues.ts';
import type { DadosNfe } from '../model.ts';

/** Produção `Char` do XML 1.0: tab, LF, CR, U+0020 a U+D7FF, U+E000 a U+FFFD e U+10000 a U+10FFFF. */
export function textoXmlValido(texto: string): boolean {
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    const ok =
      c === 0x9 ||
      c === 0xa ||
      c === 0xd ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      (c >= 0x10000 && c <= 0x10ffff);
    if (!ok) return false;
  }
  return true;
}

/**
 * Campo de texto da entrada (com `[]` onde a entrada é uma lista) e o elemento do `infNFe` que o recebe como veio. Só
 * os campos copiados sem transformação: o que a montagem calcula ou formata é conferido por ela.
 */
const CAMPOS: readonly (readonly [entrada: string, xml: string])[] = [
  ['natOp', 'ide.natOp'],
  ['emitente.xNome', 'emit.xNome'],
  ['emitente.xFant', 'emit.xFant'],
  ['emitente.endereco.xLgr', 'emit.enderEmit.xLgr'],
  ['emitente.endereco.nro', 'emit.enderEmit.nro'],
  ['emitente.endereco.xCpl', 'emit.enderEmit.xCpl'],
  ['emitente.endereco.xBairro', 'emit.enderEmit.xBairro'],
  ['emitente.endereco.xMun', 'emit.enderEmit.xMun'],
  ['destinatario.xNome', 'dest.xNome'],
  ['destinatario.email', 'dest.email'],
  ['destinatario.endereco.xLgr', 'dest.enderDest.xLgr'],
  ['destinatario.endereco.nro', 'dest.enderDest.nro'],
  ['destinatario.endereco.xCpl', 'dest.enderDest.xCpl'],
  ['destinatario.endereco.xBairro', 'dest.enderDest.xBairro'],
  ['destinatario.endereco.xMun', 'dest.enderDest.xMun'],
  ['destinatario.endereco.xPais', 'dest.enderDest.xPais'],
  ...(['retirada', 'entrega'] as const).flatMap((g) =>
    (['xNome', 'xLgr', 'nro', 'xCpl', 'xBairro', 'xMun', 'email'] as const).map(
      (c) => [`${g}.${c}`, `${g}.${c}`] as const,
    ),
  ),
  ['itens[].produto.cProd', 'det.prod.cProd'],
  ['itens[].produto.xProd', 'det.prod.xProd'],
  ['itens[].produto.uCom', 'det.prod.uCom'],
  ['itens[].produto.uTrib', 'det.prod.uTrib'],
  ['itens[].produto.xPed', 'det.prod.xPed'],
  ['itens[].infAdProd', 'det.infAdProd'],
  ['transporte.transportador.xNome', 'transp.transporta.xNome'],
  ['transporte.transportador.xEnder', 'transp.transporta.xEnder'],
  ['transporte.transportador.xMun', 'transp.transporta.xMun'],
  ['transporte.volumes[].esp', 'transp.vol.esp'],
  ['transporte.volumes[].marca', 'transp.vol.marca'],
  ['transporte.volumes[].nVol', 'transp.vol.nVol'],
  ['cobranca.fatura.nFat', 'cobr.fat.nFat'],
  ['cobranca.duplicatas[].nDup', 'cobr.dup.nDup'],
  ['pagamento.detPag[].xPag', 'pag.detPag.xPag'],
  ['informacoesAdicionais.infAdFisco', 'infAdic.infAdFisco'],
  ['informacoesAdicionais.infCpl', 'infAdic.infCpl'],
  ['informacoesAdicionais.obsCont[].xTexto', 'infAdic.obsCont.xTexto'],
  ['informacoesAdicionais.obsFisco[].xTexto', 'infAdic.obsFisco.xTexto'],
  ['compra.xNEmp', 'compra.xNEmp'],
  ['compra.xPed', 'compra.xPed'],
  ['compra.xCont', 'compra.xCont'],
];

/** O tipo do elemento `nome` entre as partículas (sequências e escolhas aninhadas). */
function elemento(p: Particle | undefined, nome: string): ComplexType | SimpleType | undefined {
  if (p === undefined || ehWildcard(p)) return undefined;
  if (ehElementParticle(p)) return p.e === nome ? p.t : undefined;
  for (const i of p.i) {
    const t = elemento(i, nome);
    if (t !== undefined) return t;
  }
  return undefined;
}

/** O tipo simples do elemento em `caminho` (pontos) a partir do `infNFe`; `undefined` se o PL não o tem. */
function tipoEm(infNFe: ComplexType, caminho: string): SimpleType | undefined {
  let t: ComplexType | SimpleType | undefined = infNFe;
  for (const nome of caminho.split('.')) {
    if (t === undefined || !ehComplexType(t)) return undefined;
    t = elemento(t.c, nome);
  }
  return t === undefined || ehComplexType(t) ? undefined : t;
}

const tiposPorPl = new WeakMap<ComplexType, ReadonlyMap<string, SimpleType>>();

/** Tipo de cada campo da tabela no PL, calculado uma vez por PL. */
function tiposDoPl(infNFe: ComplexType): ReadonlyMap<string, SimpleType> {
  let m = tiposPorPl.get(infNFe);
  if (m === undefined) {
    const novo = new Map<string, SimpleType>();
    for (const [entrada, xml] of CAMPOS) {
      const t = tipoEm(infNFe, xml);
      if (t !== undefined) novo.set(entrada, t);
    }
    m = novo;
    tiposPorPl.set(infNFe, m);
  }
  return m;
}

/** Os valores de `caminho` (com `[]` nas listas) na entrada, com o caminho concreto de cada um. */
function valoresEm(raiz: unknown, caminho: string): [string, unknown][] {
  let atuais: [string, unknown][] = [['', raiz]];
  for (const parte of caminho.split('.')) {
    const lista = parte.endsWith('[]');
    const chave = lista ? parte.slice(0, -2) : parte;
    const proximos: [string, unknown][] = [];
    for (const [c, v] of atuais) {
      if (typeof v !== 'object' || v === null) continue;
      const filho = (v as Record<string, unknown>)[chave];
      const base = c === '' ? chave : `${c}.${chave}`;
      if (!lista) proximos.push([base, filho]);
      else if (Array.isArray(filho)) for (const [n, f] of filho.entries()) proximos.push([`${base}[${n}]`, f]);
    }
    atuais = proximos;
  }
  return atuais;
}

/** Caminhos de todos os textos da entrada com caractere que o XML não representa. */
function textosForaDoXml(valor: unknown, caminho: string, saida: string[]): void {
  if (typeof valor === 'string') {
    if (!textoXmlValido(valor)) saida.push(caminho);
  } else if (Array.isArray(valor)) {
    for (const [n, v] of valor.entries()) textosForaDoXml(v, `${caminho}[${n}]`, saida);
  } else if (typeof valor === 'object' && valor !== null) {
    for (const [k, v] of Object.entries(valor)) textosForaDoXml(v, caminho === '' ? k : `${caminho}.${k}`, saida);
  }
}

/**
 * Confere os textos da entrada: em qualquer campo, o caractere que o XML não representa (`campo_invalido`); nos campos
 * da tabela, o tipo do elemento no PL (`schema`, com o código do validador na mensagem, como na montagem). As
 * ocorrências são da entrada, com o caminho da entrada. O campo que já tem ocorrência (de outra conferência da entrada)
 * não ganha outra. `substituidos` são os campos que a montagem troca por um texto fixo (o nome do destinatário em
 * homologação): o tipo deles não é conferido, porque o texto informado não vai ao XML.
 */
export function conferirTextosDaEntrada(
  entrada: DadosNfe,
  infNFe: ComplexType,
  issues: Issues,
  substituidos: ReadonlySet<string> = new Set(),
): void {
  const jaRecusados = new Set(issues.list.map((i) => i.caminho));
  const foraDoXml: string[] = [];
  textosForaDoXml(entrada, '', foraDoXml);
  for (const c of foraDoXml) {
    if (jaRecusados.has(c) || substituidos.has(c)) continue;
    issues.add(c, 'campo_invalido', 'texto com caractere não permitido em XML');
    jaRecusados.add(c);
  }
  const tipos = tiposDoPl(infNFe);
  for (const [campo] of CAMPOS) {
    const tipo = tipos.get(campo);
    if (tipo === undefined) continue;
    for (const [caminho, valor] of valoresEm(entrada, campo)) {
      if (typeof valor !== 'string' || jaRecusados.has(caminho) || substituidos.has(caminho)) continue;
      const saida: OcorrenciaSchema[] = [];
      conferirTipoSimples(tipo, valor, caminho, saida);
      for (const o of saida) issues.add(caminho, 'schema', `${o.code}: ${o.mensagem}`);
    }
  }
}
