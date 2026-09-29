/**
 * Regras do grupo E (destinatário) do MOC 7.0 Anexo I que dependem só do documento e são obrigatórias no modelo 55 ou
 * 65, conferidas antes de assinar com o caminho da entrada (ADR 0012, seção "Destinatário"). Ficam de fora as que
 * dependem de tabela externa (municípios do IBGE, E10-10; países do BACEN, E14-04), do cadastro da SEFAZ (5E17) ou do
 * critério da UF (E16a-30 e E16a-35, E14-10 e E14-20, facultativas). As regras só da NFC-e estão em `nfce.ts`.
 */

import { ufBySigla } from '@sinete/core';
import { parseCnpj } from '@sinete/validators';
import suframa from '../data/suframa.json' with { type: 'json' };
import type { Issues } from '../issues.ts';
import type { NfeInput } from '../model.ts';

/** Identificação já resolvida pelo montador (com os padrões aplicados). */
export interface IdeDestinatario {
  readonly mod: '55' | '65';
  readonly tpNF: string;
  readonly idDest: string;
  readonly idDestInformado: boolean;
  readonly indFinal: string;
  readonly producao: boolean;
}

/** Caracteres do idEstrangeiro (E03a-60): algarismos, letras e `:.+-/()`. */
const ID_ESTRANGEIRO = /^[0-9A-Za-z:.+\-/()]*$/;

const digitos = (s: string): string => s.replace(/\D/g, '');

export function conferirDestinatario(input: NfeInput, ide: IdeDestinatario, issues: Issues): void {
  const d = input.destinatario;
  if (d === undefined) return;
  const nfe = ide.mod === '55';
  const emitUf = input.emitente.endereco.UF;
  const end = d.endereco;
  const exterior = end !== undefined && 'exterior' in end && end.exterior === true;
  const destUf = end === undefined ? undefined : exterior ? 'EX' : (end as { UF: string }).UF;
  const idEstrangeiro = 'idEstrangeiro' in d ? d.idEstrangeiro : undefined;

  // E03a: destinatário estrangeiro.
  if (nfe && ide.idDest === '3' && idEstrangeiro === undefined) {
    issues.add(
      'destinatario',
      'campo_obrigatorio',
      'na operação com o exterior (idDest 3) o destinatário é identificado por idEstrangeiro, mesmo vazio (E03a-10, rejeição 720)',
    );
  }
  if (nfe && idEstrangeiro !== undefined && ide.idDest !== '3' && ide.indFinal !== '1') {
    issues.add(
      'destinatario.idEstrangeiro',
      'combinacao_invalida',
      'idEstrangeiro fora da operação com o exterior só com consumidor final, indFinal 1 (E03a-20, rejeição 721)',
    );
  }
  if (idEstrangeiro !== undefined && d.IE !== undefined) {
    issues.add(
      'destinatario.IE',
      'combinacao_invalida',
      'destinatário estrangeiro (idEstrangeiro) não informa IE (E03a-30, rejeição 925)',
    );
  }
  if (idEstrangeiro !== undefined && !ID_ESTRANGEIRO.test(idEstrangeiro)) {
    issues.add(
      'destinatario.idEstrangeiro',
      'campo_invalido',
      'idEstrangeiro só com algarismos, letras e os caracteres : . + - / ( ) (E03a-60, rejeição 372)',
    );
  }

  // E04 e E05: nome e endereço na NF-e. Em homologação o nome é o literal da E04-20, posto pelo montador.
  if (nfe && ide.producao && (d.xNome === undefined || d.xNome.trim() === '')) {
    issues.add(
      'destinatario.xNome',
      'campo_obrigatorio',
      'a NF-e informa o nome do destinatário (E04-10, rejeição 724)',
    );
  }
  if (nfe && end === undefined) {
    issues.add(
      'destinatario.endereco',
      'campo_obrigatorio',
      'a NF-e informa o endereço do destinatário (E05-10, rejeição 726)',
    );
  }

  // E10-20: o município do destinatário é da UF dele (as duas primeiras posições do código são o código da UF).
  if (end !== undefined && !exterior) {
    const e = end as { UF: string; cMun: string };
    const cUF = ufBySigla(e.UF)?.cUF;
    if (cUF !== undefined && digitos(e.cMun).slice(0, 2) !== cUF) {
      issues.add(
        'destinatario.endereco.cMun',
        'combinacao_invalida',
        `município ${e.cMun} não é da UF ${e.UF} do destinatário (E10-20, rejeição 275)`,
      );
    }
  }

  // E12-30 a E12-60: idDest contra as UFs do emitente e do destinatário, com as exceções da própria regra.
  if (nfe && destUf !== undefined && destUf !== 'EX') {
    const caminho = ide.idDestInformado ? 'idDest' : 'destinatario.endereco.UF';
    const ufsCons = input.itens.flatMap((it) => {
      const esp = it.produto.especifico;
      return esp !== undefined && 'comb' in esp ? [String(esp.comb.UFCons)] : [];
    });
    const entrega = input.entrega?.UF;
    const retirada = input.retirada?.UF;
    const saida = ide.tpNF === '1';
    // Na saída a entrega vale contra o emitente e a retirada contra o destinatário; na entrada, ao contrário.
    const [ufEntrega, ufRetirada] = saida ? [emitUf, destUf] : [destUf, emitUf];
    if (ide.idDest === '2' && destUf === emitUf) {
      // CNPJ alfanumérico: as letras contam; só a máscara sai (a mesma normalização do parseCnpj).
      const cnpj = (v: string | undefined): string | undefined => {
        if (v === undefined) return undefined;
        const r = parseCnpj(v);
        return r.ok ? r.value : undefined;
      };
      const cnpjDest = 'CNPJ' in d ? cnpj(d.CNPJ) : undefined;
      const mesmoCnpj = cnpjDest !== undefined && cnpjDest === cnpj(input.emitente.CNPJ);
      const excecao =
        ufsCons.some((u) => u !== emitUf) ||
        (entrega !== undefined && retirada === undefined && entrega !== ufEntrega) ||
        (retirada !== undefined && entrega === undefined && retirada !== ufRetirada) ||
        (entrega !== undefined && retirada !== undefined && entrega !== retirada);
      if (!mesmoCnpj && !excecao) {
        issues.add(
          caminho,
          'combinacao_invalida',
          `operação interestadual (idDest 2) com o destinatário na UF do emitente (${emitUf}) (${saida ? 'E12-30' : 'E12-50'}, rejeição 772)`,
        );
      }
    }
    if (ide.idDest === '1' && destUf !== emitUf && ide.indFinal !== '1') {
      const excecao =
        ufsCons.some((u) => u === emitUf) ||
        (entrega !== undefined && retirada === undefined && entrega === ufEntrega) ||
        (retirada !== undefined && entrega === undefined && retirada === ufRetirada) ||
        (entrega !== undefined && retirada !== undefined && entrega === retirada);
      if (!excecao) {
        issues.add(
          caminho,
          'combinacao_invalida',
          `operação interna (idDest 1) com o destinatário em ${destUf}, fora da UF do emitente (${emitUf}) (${saida ? 'E12-40' : 'E12-60'}, rejeição 773)`,
        );
      }
    }
  }

  // E14-30: no exterior, o país não é o Brasil (o código pode vir com zeros à esquerda).
  if (exterior && Number(digitos((end as { cPais: string }).cPais)) === 1058) {
    issues.add(
      'destinatario.endereco.cPais',
      'campo_invalido',
      'destinatário no exterior com o país Brasil, 1058 (E14-30, rejeição 926)',
    );
  }

  if (!nfe) return;

  // E16a: indicador da IE.
  if (ide.idDest === '3' && d.indIEDest !== '9') {
    issues.add(
      'destinatario.indIEDest',
      'combinacao_invalida',
      'na operação com o exterior o destinatário é não contribuinte, indIEDest 9 (E16a-20, rejeição 790)',
    );
  }
  if (d.indIEDest === '9' && ide.indFinal !== '1' && ide.tpNF === '1' && ide.idDest !== '3') {
    issues.add(
      'indFinal',
      'combinacao_invalida',
      'saída para não contribuinte (indIEDest 9) é operação com consumidor final, indFinal 1 (E16a-40, rejeição 696)',
    );
  }

  // E17: a IE do destinatário.
  if (d.indIEDest === '1' && d.IE === undefined) {
    issues.add(
      'destinatario.IE',
      'campo_obrigatorio',
      'destinatário contribuinte (indIEDest 1) informa a IE (E17-20, rejeição 728)',
    );
  }
  if (d.indIEDest === '2' && d.IE !== undefined) {
    issues.add(
      'destinatario.IE',
      'combinacao_invalida',
      'destinatário contribuinte isento (indIEDest 2) não informa a IE (E17-30, rejeição 791)',
    );
  }
  if (exterior && d.IE !== undefined) {
    issues.add(
      'destinatario.IE',
      'combinacao_invalida',
      'destinatário no exterior não informa a IE (E17-40, rejeição 792)',
    );
  }

  // E18-30: a inscrição na Suframa só vale nas UFs e municípios da área incentivada; no exterior (UF EX), nunca.
  if (d.ISUF !== undefined && destUf !== undefined) {
    const cMun = exterior ? '' : digitos((end as { cMun: string }).cMun);
    const municipios = (suframa.municipios as Record<string, readonly string[]>)[destUf];
    const aceita = suframa.ufs.includes(destUf) || (municipios?.includes(cMun) ?? false);
    if (!aceita) {
      const onde = exterior ? 'no exterior' : `${destUf}, município ${(end as { cMun: string }).cMun}`;
      issues.add(
        'destinatario.ISUF',
        'combinacao_invalida',
        `inscrição na Suframa com o destinatário fora da área incentivada (${onde}) (E18-30, rejeição 251)`,
      );
    }
  }
}
