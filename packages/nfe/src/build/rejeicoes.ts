/**
 * Regras de validação da SEFAZ que dependem só do documento e que rejeições reais de um integrador em produção mostraram
 * chegando à SEFAZ: conferidas antes de assinar, com o caminho da entrada (ADR 0012).
 *
 * Só entra aqui regra obrigatória (`Obrig.` no MOC) cujo resultado sai do próprio documento, sem cadastro nem
 * configuração da UF. Exceção que depende de tabela externa ou do critério da UF faz a conferência não recusar: na
 * dúvida, a nota vai e a SEFAZ decide, porque recusar localmente uma nota que a SEFAZ aceitaria é pior que a rejeição.
 */

import type { Ocorrencia } from '@sinete/core';
import { indicadoresCfop } from '@sinete/validators';
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

/** A RV C17-42 (NFC-e sem IE) "não se aplica a partir de 2033". */
const NFCE_SEM_IE_ATE = '2033-01-01';

/**
 * Contribuinte exclusivo do IBS/CBS: a nota sem `emitente.IE` (NT 2026.007 v1.10). Sai daqui o que a NT decide só com o
 * documento:
 *
 * - NFC-e sem IE, rejeição 156 (RV C17-42), até o fim de 2032; a data é a da emissão e a do fato gerador, e a conferência
 *   só recusa quando todas as leituras (local, Brasília e UTC) caem antes de 2033;
 * - NF-e sem IE e sem CNPJ do emitente (emitente CPF), 157 (C17-43);
 * - NF-e sem IE com a IE do substituto tributário, 158 (C18-50);
 * - item com ICMS ou ICMS interestadual (`icmsUfDest`) na NF-e sem IE, 161 (N01-10), menos na devolução (finNFe 4) e na
 *   nota de crédito de retorno por recusa ou não localização (tpNFCredito 03), as duas exceções da regra;
 * - item sem `impostos.ibsCbs` (nem o grupo pronto nem a classificação para a calculadora) na NF-e sem IE, 162
 *   (UB12-11). O item classificado cujo cálculo falhou já tem a ocorrência da calculadora, de montagem.
 *
 * Ficam para a SEFAZ as regras da mesma NT que dependem de tabela ou cadastro: a 159 (tabela de CFOP do Portal), a 163 e
 * a 164 (CCC), as de local de retirada e entrega (CCC) e as da LCC-RFB (178 a 187). A 166 e a 188 são do roteamento.
 */
export function exclusivoIbsCbs(
  input: DadosNfe,
  contexto: { readonly nfce: boolean; readonly dhEmi: string; readonly instantes: readonly Instante[] },
  issues: Issues,
): void {
  const e = input.emitente;
  if (e.IE !== undefined) return;
  if (contexto.nfce) {
    const datas = [
      contexto.dhEmi.slice(0, 10),
      ...contexto.instantes.flatMap((i) => [dataNoFuso(i, OFFSET_BRASILIA), dataNoFuso(i, 0)]),
    ];
    if (datas.every((d) => d < NFCE_SEM_IE_ATE)) {
      issues.add(
        'emitente.IE',
        'campo_obrigatorio',
        'a NFC-e exige a IE do emitente: contribuinte exclusivo do IBS/CBS, sem IE, emite só NF-e (C17-42, rejeição 156)',
      );
    }
    return;
  }
  if (e.CNPJ === undefined) {
    issues.add(
      'emitente.CNPJ',
      'campo_obrigatorio',
      'NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS) exige o CNPJ do emitente (C17-43, rejeição 157)',
    );
  }
  if (e.IEST !== undefined) {
    issues.add(
      'emitente.IEST',
      'combinacao_invalida',
      'NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS) não leva a IE do substituto tributário (C18-50, rejeição 158)',
    );
  }
  const icmsLiberado = (input.finNFe ?? '1') === '4' || input.tpNFCredito === '03';
  input.itens.forEach((it, n) => {
    if (!icmsLiberado) {
      for (const [campo, grupo] of [
        ['icms', it.impostos.icms],
        ['icmsUfDest', it.impostos.icmsUfDest],
      ] as const) {
        if (grupo === undefined) continue;
        issues.add(
          `itens[${n}].impostos.${campo}`,
          'grupo_vedado',
          'NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS) não leva ICMS no item (N01-10, rejeição 161)',
        );
      }
    }
    if (it.impostos.ibsCbs === undefined) {
      issues.add(
        `itens[${n}].impostos.ibsCbs`,
        'campo_obrigatorio',
        'NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS) exige o grupo IBS/CBS em todo item (UB12-11, rejeição 162)',
      );
    }
  });
}

/** Nota de crédito que aceita CFOP de devolução (NT 2025.002 v1.52, RV I08-144, exceção): 03, 04 e 06. */
const CREDITO_COM_DEVOLUCAO: ReadonlySet<string> = new Set(['03', '04', '06']);

/**
 * CFOP de devolução (Tabela CFOP, `indDevol`) em NF-e que não é de devolução nem complementar: rejeição 328 (MOC 7.0
 * Anexo I, RV I08-144, obrigatória no modelo 55; NT 2025.002 v1.52, que exclui a nota de crédito 03, 04 e 06). CFOP
 * fora da tabela versionada não é recusado.
 */
export function cfopDeDevolucao(input: DadosNfe, issues: Issues): void {
  const fin = input.finNFe ?? '1';
  if (fin === '2' || fin === '4') return;
  if (fin === '5' && input.tpNFCredito !== undefined && CREDITO_COM_DEVOLUCAO.has(input.tpNFCredito)) return;
  input.itens.forEach((it, n) => {
    if (indicadoresCfop(it.produto.CFOP.replace(/\D/g, ''))?.indDevol !== true) return;
    issues.add(
      `itens[${n}].produto.CFOP`,
      'combinacao_invalida',
      `CFOP ${it.produto.CFOP} é de devolução e a nota não é de devolução (finNFe ${fin}) (I08-144, rejeição 328)`,
    );
  });
}

/** CST aceitos com destinatário não contribuinte (RV N12-70; o 61 entrou pela NT 2023.001). */
const CST_NAO_CONTRIBUINTE: ReadonlySet<string> = new Set(['00', '20', '40', '41', '60', '61']);

/** Códigos ANP que a exceção 5 da N12-70 deixa de fora (não derivados de petróleo). */
const ANP_FORA_DA_EXCECAO_5: ReadonlySet<string> = new Set([
  '820101001',
  '820101010',
  '810102001',
  '810102004',
  '810102002',
  '810102003',
  '810101002',
  '810101001',
  '810101003',
  '220101003',
  '220101004',
  '220101002',
  '220101001',
  '220101005',
  '220101006',
  '560101001',
]);

/** CFOP da exceção 7 da N12-70 (CST 51 em qualquer operação). */
const CFOP_CST51: ReadonlySet<string> = new Set(['5123', '5922', '6123', '6922']);

/**
 * CST fora de 00, 20, 40, 41, 60 e 61 com destinatário não contribuinte (indIEDest 9): rejeição 508 (MOC 7.0 Anexo I,
 * RV N12-70, obrigatória no modelo 55, no texto da NT 2023.001 v1.60 e da NT 2023.003 v1.40). Só o CST: a regra não
 * fala do CSOSN. Ficam de fora todas as exceções:
 *
 * 1. NF-e de entrada; 3. nota com veículo novo (`veicProd`) em algum item; 6. CST 50 e 51 na devolução;
 * 2. CST 50 com CFOP de retorno ou remessa (Tabela CFOP, `indRetor`, `indRemes`) ou 5949 e 6949, e com CFOP fora da
 *    tabela versionada, que a conferência não sabe classificar;
 * 5. CST 30 interestadual com combustível derivado de petróleo; 9. CST 30 interestadual com energia elétrica (NCM
 *    27160000);
 * 7. CST 51 com CFOP 5123, 5922, 6123 e 6922, e em qualquer operação interna: a NT 2023.001 diz "operações internas" e
 *    a NT 2023.003 restringe ao retorno de depósito (5906 e 5907), e a conferência recusa só o que as duas recusam;
 * 8. CST 10 e 02 em operação interna, a critério da UF; e o CST 90 com CFOP 5403 ou 5405 no CE (observação da NT
 *    2023.003), também a critério da UF.
 *
 * A exceção 4 (emissão antes de 01/07/2016) não alcança nota montada agora.
 */
export function cstComNaoContribuinte(
  input: DadosNfe,
  contexto: { readonly idDest: string; readonly uf: string },
  issues: Issues,
): void {
  if (input.destinatario?.indIEDest !== '9' || input.tpNF === '0') return;
  if (input.itens.some((it) => it.produto.especifico !== undefined && 'veicProd' in it.produto.especifico)) return;
  const fin = input.finNFe ?? '1';
  const interna = contexto.idDest === '1';
  const interestadual = contexto.idDest === '2';
  input.itens.forEach((it, n) => {
    const icms = it.impostos.icms;
    if (icms === undefined || !('CST' in icms)) return;
    const cst = icms.CST;
    if (CST_NAO_CONTRIBUINTE.has(cst)) return;
    const cfop = it.produto.CFOP.replace(/\D/g, '');
    const esp = it.produto.especifico;
    if ((cst === '50' || cst === '51') && fin === '4') return;
    if (cst === '50') {
      const ind = indicadoresCfop(cfop);
      if (ind === undefined || ind.indRetor || ind.indRemes || cfop === '5949' || cfop === '6949') return;
    }
    if (cst === '51' && (CFOP_CST51.has(cfop) || interna)) return;
    if ((cst === '10' || cst === '02') && interna) return;
    if (cst === '30' && interestadual) {
      if (esp !== undefined && 'comb' in esp && !ANP_FORA_DA_EXCECAO_5.has(esp.comb.cProdANP)) return;
      if (it.produto.NCM.replace(/\D/g, '') === '27160000') return;
    }
    if (cst === '90' && contexto.uf === 'CE' && (cfop === '5403' || cfop === '5405')) return;
    issues.add(
      `itens[${n}].impostos.icms.CST`,
      'combinacao_invalida',
      `CST ${cst} não se usa com destinatário não contribuinte (indIEDest 9) (N12-70, rejeição 508)`,
    );
  });
}
