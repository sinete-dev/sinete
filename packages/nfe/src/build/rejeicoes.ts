/**
 * Regras de validação da SEFAZ que dependem só do documento e que rejeições reais de um integrador em produção mostraram
 * chegando à SEFAZ: conferidas antes de assinar, com o caminho da entrada (ADR 0012).
 *
 * Só entra aqui regra obrigatória (`Obrig.` no MOC) cujo resultado sai do próprio documento, sem cadastro nem
 * configuração da UF. Exceção que depende de tabela externa ou do critério da UF faz a conferência não recusar: na
 * dúvida, a nota vai e a SEFAZ decide, porque recusar localmente uma nota que a SEFAZ aceitaria é pior que a rejeição.
 */

import type { Ocorrencia } from '@sinete/core';
import type { Issues } from '../issues.ts';
import type { DadosNfe } from '../model.ts';
import type { Instante } from '../time.ts';
import { formatarDh } from '../time.ts';

/**
 * CFOP em que o CST 50 (suspensão) é aceito com destinatário contribuinte isento: conserto ou reparo e remessa para
 * demonstração dentro do estado (MOC 7.0 Anexo I, RV N12-80, exceção 1).
 */
const CFOP_CST50_ISENTO: ReadonlySet<string> = new Set([
  '1915',
  '1916',
  '2915',
  '2916',
  '5915',
  '5916',
  '6915',
  '6916',
  '1912',
  '1913',
  '5912',
  '5913',
]);

/**
 * CST 50 ou 51 com destinatário contribuinte isento de IE (indIEDest 2): rejeição 529 (MOC 7.0 Anexo I, RV N12-80,
 * obrigatória no modelo 55). Fica de fora o que as exceções liberam: o CST 50 nos CFOP da exceção 1 e o CST 51 em
 * qualquer operação interna, que a exceção 3 deixa a critério da UF. A exceção 3 fala em destinatário CNPJ, mas uma UF
 * autorizou em produção CST 51 interno com destinatário CPF isento; como o critério é da UF, o CST 51 interno não é
 * recusado aqui, seja qual for o documento do destinatário. A exceção 2 (emissão antes de 01/07/2016) não alcança nota
 * montada agora.
 */
export function cstComIsento(input: DadosNfe, idDest: string, issues: Issues): void {
  const d = input.destinatario;
  if (d?.indIEDest !== '2') return;
  input.itens.forEach((it, n) => {
    const icms = it.impostos.icms;
    if (icms === undefined || !('CST' in icms)) return;
    const cst = icms.CST;
    if (cst === '50' && CFOP_CST50_ISENTO.has(it.produto.CFOP.replace(/\D/g, ''))) return;
    if (cst === '51' && idDest === '1') return;
    if (cst !== '50' && cst !== '51') return;
    issues.add(
      `itens[${n}].impostos.icms.CST`,
      'combinacao_invalida',
      `CST ${cst} não se usa com destinatário contribuinte isento de IE (indIEDest 2) (N12-80, rejeição 529)`,
    );
  });
}

/** Data (`AAAA-MM-DD`) do instante no deslocamento dado, em minutos. */
const dataNoFuso = (instante: Instante, offsetMinutes: number): string =>
  formatarDh(instante, offsetMinutes).slice(0, 10);

/** Brasília (UTC-3), o fuso das SEFAZ, para a comparação de datas que o MOC faz "desconsiderando a hora". */
const OFFSET_BRASILIA = -180;

/**
 * Vencimento das duplicatas (grupo Y, modelo 55): uma parcela só, vencendo na data de emissão, cai na rejeição 853,
 * "dados de cobrança não devem ser informados para pagamento à vista" (NT 2025.001 v1.03, RV Y09-40, em produção desde
 * 01/09/2025).
 *
 * As RV Y09-20 (sem `dVenc` ou vencendo antes da emissão, rejeição 900) e Y09-30 (antes da parcela anterior, 850) não
 * são conferidas aqui: uma UF autorizou em produção, em 2026, parcela única vencendo dois meses antes da emissão, o que
 * mostra que a aplicação delas depende da UF. Na dúvida, a nota vai e a SEFAZ decide (ADR 0012).
 *
 * A data de emissão é a do `dhEmi`. O MOC não diz em que fuso a SEFAZ a compara; para não recusar nota que ela aceitaria,
 * "na data da emissão" só vale quando a data local do `dhEmi`, a de Brasília e a de UTC coincidem.
 */
export function vencimentos(
  input: DadosNfe,
  emissao: { readonly dhEmi: string; readonly instante: Instante },
  issues: Issues,
): void {
  const dups = input.cobranca?.duplicatas;
  if (dups === undefined || dups.length !== 1) return;
  const unica = dups[0]?.dVenc;
  if (unica === undefined) return;
  const local = emissao.dhEmi.slice(0, 10);
  const datas = new Set([local, dataNoFuso(emissao.instante, OFFSET_BRASILIA), dataNoFuso(emissao.instante, 0)]);
  if (datas.size === 1 && datas.has(unica)) {
    issues.add(
      'cobranca.duplicatas',
      'combinacao_invalida',
      'uma parcela só, vencendo na data de emissão, é pagamento à vista: não informe a cobrança (Y09-40, rejeição 853)',
    );
  }
}

/** Documento sem pontuação e em maiúsculas (o CNPJ alfanumérico mantém as letras). */
const soDocumento = (s: string): string => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

/**
 * Confere o emitente com o titular do certificado que assina a NF-e (MOC 7.0 Anexo I, grupo F):
 *
 * - e-CNPJ: o CNPJ-base (8 primeiros caracteres) do emitente é o do certificado, senão rejeição 213 (RV F03);
 * - e-CPF: o CPF do emitente é o do certificado, senão rejeição 227 (RV F03A).
 *
 * Só compara documento com documento do mesmo tipo: e-CNPJ assinando nota de emitente CPF (ou o contrário) fica para a
 * SEFAZ. O certificado da SEFAZ que a F03 dispensa só assina a nota avulsa, que o `montarNfe` não monta (procEmi 0).
 * Devolve as ocorrências (vazio quando confere), com o caminho da entrada.
 */
export function conferirEmitenteDoCertificado(
  nfe: DadosNfe,
  titular: { readonly cnpj?: string | undefined; readonly cpf?: string | undefined },
): readonly Ocorrencia[] {
  const e = nfe.emitente;
  if (e.CNPJ !== undefined && titular.cnpj !== undefined) {
    const base = soDocumento(e.CNPJ).slice(0, 8);
    if (base !== soDocumento(titular.cnpj).slice(0, 8)) {
      return [
        {
          caminho: 'emitente.CNPJ',
          code: 'emitente_difere_do_certificado',
          mensagem: `CNPJ-base ${base} do emitente difere do CNPJ-base do certificado (F03, rejeição 213)`,
          origem: 'entrada',
        },
      ];
    }
  }
  if (e.CPF !== undefined && titular.cpf !== undefined && soDocumento(e.CPF) !== soDocumento(titular.cpf)) {
    return [
      {
        caminho: 'emitente.CPF',
        code: 'emitente_difere_do_certificado',
        mensagem: 'CPF do emitente difere do CPF do certificado (F03A, rejeição 227)',
        origem: 'entrada',
      },
    ];
  }
  return [];
}
