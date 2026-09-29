/** Tabelas da bobina (DANFE NFC-e e Simplificado Tipo 2), como dados (ADR 0006, decisão 2). */

import type { Fonte } from './leiaute.ts';

/** Meio de pagamento (tPag, YA02) no DANFE NFC-e e no Simplificado Tipo 2. */
export const MEIO_PAGAMENTO: Fonte & { readonly valores: Readonly<Record<string, string>> } = {
  source: 'MOC 7.0, Anexo I, campo YA02 (tPag), com NT 2020.006, NT 2023.004 e NT 2024.003',
  valores: {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'Pagamento Instantâneo (PIX) Dinâmico',
    '18': 'Transferência bancária, Carteira Digital',
    '19': 'Programa de fidelidade, Cashback, Crédito Virtual',
    '20': 'Pagamento Instantâneo (PIX) Estático',
    '21': 'Crédito em Loja',
    '22': 'Pagamento Eletrônico não Informado',
    '90': 'Sem pagamento',
    '99': 'Outros',
  },
};
