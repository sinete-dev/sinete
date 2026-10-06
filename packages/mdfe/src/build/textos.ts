/**
 * Texto e tamanho dos campos de texto do MDF-e conferidos na entrada (ADR 0011, revisão de 01/10/2026), como na NF-e.
 *
 * Antes, o caractere que o XML não representa e o texto fora do tipo do leiaute (tamanho, espaço nas pontas,
 * caractere fora do `TString`) só apareciam na montagem, com o caminho do XML (`infMDFe.prodPred.xProd` ou
 * `/infMDFe/emit/xNome`). Conferidos aqui, saem como `campo_invalido`, com `origem: 'entrada'`, o caminho da entrada
 * (`emitente.xNome`) e uma mensagem para quem preenche o campo (`no máximo 60 caracteres (tem 61)`).
 *
 * O tipo de cada campo vem do schema do PL da montagem, nunca de um número escrito aqui: a tabela abaixo só diz qual
 * elemento do `infMDFe` recebe cada campo da entrada.
 */

import type { CampoDeTexto, ComplexType } from '@sinete/schemas';
import { conferirTextos } from '@sinete/schemas';
import type { Issues } from '../issues.ts';
import type { DadosMdfe } from '../model.ts';

const rodo = 'infModal.rodo';
const aquav = 'infModal.aquav';
const descarga = 'infDoc.infMunDescarga';

/**
 * Campo de texto da entrada (com `[]` onde a entrada é uma lista) e o elemento do `infMDFe` que o recebe como veio. Só
 * os campos copiados sem transformação: telefone, CEP, placa, documentos e números a montagem formata e confere.
 */
export const CAMPOS: readonly CampoDeTexto[] = [
  ['emitente.xNome', 'emit.xNome'],
  ['emitente.xFant', 'emit.xFant'],
  ...(['xLgr', 'nro', 'xCpl', 'xBairro', 'xMun', 'email'] as const).map(
    (c) => [`emitente.endereco.${c}`, `emit.enderEmit.${c}`] as const,
  ),
  ['carregamento[].xMun', 'ide.infMunCarrega.xMunCarrega'],
  ['descarregamentos[].xMun', `${descarga}.xMunDescarga`],
  ...(['nfe', 'cte'] as const).flatMap((d) =>
    (['nONU', 'xNomeAE', 'xClaRisco', 'grEmb', 'qTotProd', 'qVolTipo'] as const).map(
      (c) =>
        [
          `descarregamentos[].${d}[].perigosos[].${c}`,
          `${descarga}.${d === 'nfe' ? 'infNFe' : 'infCTe'}.peri.${c}`,
        ] as const,
    ),
  ),
  ['rodoviario.RNTRC', `${rodo}.infANTT.RNTRC`],
  ['rodoviario.ciot[].CIOT', `${rodo}.infANTT.infCIOT.CIOT`],
  ['rodoviario.valePedagio.dispositivos[].nCompra', `${rodo}.infANTT.valePed.disp.nCompra`],
  ['rodoviario.contratantes[].xNome', `${rodo}.infANTT.infContratante.xNome`],
  ['rodoviario.contratantes[].contrato.NroContrato', `${rodo}.infANTT.infContratante.infContrato.NroContrato`],
  ['rodoviario.pagamentos[].xNome', `${rodo}.infANTT.infPag.xNome`],
  ['rodoviario.pagamentos[].componentes[].xComp', `${rodo}.infANTT.infPag.Comp.xComp`],
  ['rodoviario.tracao.cInt', `${rodo}.veicTracao.cInt`],
  ['rodoviario.tracao.RENAVAM', `${rodo}.veicTracao.RENAVAM`],
  ['rodoviario.tracao.proprietario.RNTRC', `${rodo}.veicTracao.prop.RNTRC`],
  ['rodoviario.tracao.proprietario.xNome', `${rodo}.veicTracao.prop.xNome`],
  ['rodoviario.tracao.condutores[].xNome', `${rodo}.veicTracao.condutor.xNome`],
  ['rodoviario.reboques[].cInt', `${rodo}.veicReboque.cInt`],
  ['rodoviario.reboques[].RENAVAM', `${rodo}.veicReboque.RENAVAM`],
  ['rodoviario.reboques[].proprietario.RNTRC', `${rodo}.veicReboque.prop.RNTRC`],
  ['rodoviario.reboques[].proprietario.xNome', `${rodo}.veicReboque.prop.xNome`],
  ['rodoviario.codAgPorto', `${rodo}.codAgPorto`],
  ...(['nac', 'matr', 'nVoo', 'cAerEmb', 'cAerDes'] as const).map(
    (c) => [`aereo.${c}`, `infModal.aereo.${c}`] as const,
  ),
  ...(['irin', 'cEmbar', 'xEmbar', 'nViag', 'cPrtEmb', 'cPrtDest', 'prtTrans', 'MMSI'] as const).map(
    (c) => [`aquaviario.${c}`, `${aquav}.${c}`] as const,
  ),
  ['aquaviario.terminaisCarregamento[].cTermCarreg', `${aquav}.infTermCarreg.cTermCarreg`],
  ['aquaviario.terminaisCarregamento[].xTermCarreg', `${aquav}.infTermCarreg.xTermCarreg`],
  ['aquaviario.terminaisDescarregamento[].cTermDescarreg', `${aquav}.infTermDescarreg.cTermDescarreg`],
  ['aquaviario.terminaisDescarregamento[].xTermDescarreg', `${aquav}.infTermDescarreg.xTermDescarreg`],
  ['aquaviario.comboio[].cEmbComb', `${aquav}.infEmbComb.cEmbComb`],
  ['aquaviario.comboio[].xBalsa', `${aquav}.infEmbComb.xBalsa`],
  ['aquaviario.unidadesCargaVazias[].idUnidCargaVazia', `${aquav}.infUnidCargaVazia.idUnidCargaVazia`],
  ['aquaviario.unidadesTransporteVazias[].idUnidTranspVazia', `${aquav}.infUnidTranspVazia.idUnidTranspVazia`],
  ...(['xPref', 'xOri', 'xDest'] as const).map((c) => [`ferroviario.trem.${c}`, `infModal.ferrov.trem.${c}`] as const),
  ...(['tpVag', 'serie', 'nVag', 'nSeq'] as const).map(
    (c) => [`ferroviario.vagoes[].${c}`, `infModal.ferrov.vag.${c}`] as const,
  ),
  ['seguros[].seguradora.xSeg', 'seg.infSeg.xSeg'],
  ['seguros[].nApol', 'seg.nApol'],
  ['seguros[].nAver[]', 'seg.nAver'],
  ['produtoPredominante.xProd', 'prodPred.xProd'],
  ['produtoPredominante.cEAN', 'prodPred.cEAN'],
  ['respTec.xContato', 'infRespTec.xContato'],
  ['respTec.email', 'infRespTec.email'],
  ['informacoesAdicionais.infAdFisco', 'infAdic.infAdFisco'],
  ['informacoesAdicionais.infCpl', 'infAdic.infCpl'],
  ['lacres[]', 'lacres.nLacre'],
  ['rodoviario.lacres[]', `${rodo}.lacRodo.nLacre`],
];

/**
 * Confere os textos da entrada: em qualquer campo, o caractere que o XML não representa; nos campos da tabela, o tipo
 * do elemento no PL. Tudo sai como `campo_invalido`, com o caminho da entrada e `origem: 'entrada'`, uma ocorrência
 * por regra violada; o campo que já tem ocorrência de outra conferência da entrada não ganha outra.
 */
export function conferirTextosDaEntrada(entrada: DadosMdfe, infMDFe: ComplexType, issues: Issues): void {
  const pular = new Set(issues.list.map((i) => i.caminho));
  for (const t of conferirTextos(entrada, infMDFe, CAMPOS, pular)) issues.add(t.caminho, 'campo_invalido', t.mensagem);
}
