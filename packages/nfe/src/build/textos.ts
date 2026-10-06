/**
 * Texto e tamanho dos campos de texto da NF-e conferidos na entrada (ADR 0011, revisão de 01/10/2026).
 *
 * Antes, o caractere que o XML não representa e o texto fora do tipo do leiaute (tamanho, espaço nas pontas,
 * caractere fora do `TString`) só apareciam na montagem, com o caminho do XML (`infNFe.det[0].prod.xProd` ou
 * `/infNFe/det[1]/prod/xProd`). Conferidos aqui, saem como `campo_invalido`, com `origem: 'entrada'`, o caminho da
 * entrada (`itens[0].produto.xProd`) e uma mensagem para quem preenche o campo (`no máximo 60 caracteres`), sem nome
 * de validador nem de tipo do XSD.
 *
 * O tipo de cada campo vem do schema do PL da montagem (o `TString` com o `maxLength` do elemento), nunca de um número
 * escrito aqui: a tabela abaixo só diz qual elemento do `infNFe` recebe cada campo da entrada.
 */

import type { CampoDeTexto, ComplexType } from '@sinete/schemas';
import { conferirTextos } from '@sinete/schemas';
import type { Issues } from '../issues.ts';
import type { DadosNfe } from '../model.ts';

export { textoXmlValido } from '@sinete/schemas';

/**
 * Campo de texto da entrada (com `[]` onde a entrada é uma lista) e o elemento do `infNFe` que o recebe como veio. Só
 * os campos copiados sem transformação: o que a montagem calcula ou formata é conferido por ela.
 */
const CAMPOS: readonly CampoDeTexto[] = [
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

/**
 * Confere os textos da entrada: em qualquer campo, o caractere que o XML não representa; nos campos da tabela, o tipo
 * do elemento no PL (tamanho, espaço nas pontas, caractere fora do conjunto aceito). Tudo sai como `campo_invalido`,
 * com o caminho da entrada, `origem: 'entrada'` e uma ocorrência por regra violada. O campo que já tem ocorrência (de
 * outra conferência da entrada) não ganha outra. `substituidos` são os campos que a montagem troca por um texto fixo
 * (o nome do destinatário em homologação): o tipo deles não é conferido, porque o texto informado não vai ao XML.
 */
export function conferirTextosDaEntrada(
  entrada: DadosNfe,
  infNFe: ComplexType,
  issues: Issues,
  substituidos: ReadonlySet<string> = new Set(),
): void {
  const pular = new Set([...issues.list.map((i) => i.caminho), ...substituidos]);
  for (const t of conferirTextos(entrada, infNFe, CAMPOS, pular)) issues.add(t.caminho, 'campo_invalido', t.mensagem);
}
