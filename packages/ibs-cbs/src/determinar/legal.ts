/**
 * Regras legais fechadas: hipóteses em que a lei decide o cClassTrib pela natureza da operação ou pela condição da parte,
 * sem depender de interpretação do item. Cada uma restringe os candidatos e cita o dispositivo. O texto legal de cada
 * código vem da própria tabela (`Candidato.lc214` e `url`); aqui fica só o vínculo entre o fato e o código.
 */
import type {
  ContextoRegraLegal,
  FatosDaOperacao,
  FatosDoItem,
  RegraLegal,
  ResultadoRegraLegal,
  TipoDeOperacao,
} from './types.ts';

const LC = 'LC 214/2025';
const SINCE = { inicio: '2026-01-01', fim: null } as const;

/** Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). */
export const ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE = 14;

function kindOf(facts: FatosDaOperacao, item: FatosDoItem): TipoDeOperacao {
  return item.tipo ?? facts.tipo;
}

function byKind(id: string, kind: TipoDeOperacao, codes: readonly string[], title: string, source: string): RegraLegal {
  return {
    id,
    titulo: title,
    fonte: source,
    vigencia: SINCE,
    aplicar: ({ fatos: facts, item }: ContextoRegraLegal): ResultadoRegraLegal =>
      kindOf(facts, item) === kind ? { tipo: 'restringir', codigos: codes } : { tipo: 'nenhum' },
  };
}

export const REGRAS_LEGAIS: readonly RegraLegal[] = [
  byKind(
    'bonificacao-no-documento',
    'bonificacao',
    ['410001'],
    'bonificação que consta do documento e não depende de evento posterior não sofre incidência',
    `${LC}, art. 5º, § 1º, I`,
  ),
  byKind(
    'transferencia-mesmo-contribuinte',
    'transferencia',
    ['410002'],
    'transferência de bens entre estabelecimentos do mesmo contribuinte não sofre incidência',
    `${LC}, art. 6º, II`,
  ),
  byKind(
    'doacao-sem-contraprestacao',
    'doacao',
    ['410003'],
    'doação sem contraprestação em benefício do doador não sofre incidência',
    `${LC}, art. 6º, VIII`,
  ),
  byKind(
    'exportacao-imune',
    'exportacao',
    ['410004', '410027'],
    'exportação de bens e serviços é imune; serviço vinculado à exportação de bem material tem código próprio',
    `${LC}, arts. 8º e 80, II`,
  ),
  {
    id: 'produtor-rural-nao-contribuinte',
    titulo: 'fornecimento de produtor rural não contribuinte',
    fonte: `${LC}, art. 164`,
    vigencia: SINCE,
    nota: 'Vale para a venda: nas outras naturezas (transferência, bonificação, devolução) a regra da natureza decide.',
    aplicar: ({ fatos: facts, item }: ContextoRegraLegal): ResultadoRegraLegal =>
      kindOf(facts, item) === 'venda' && facts.fornecedor?.atores?.includes(ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE)
        ? { tipo: 'restringir', codigos: ['410014'] }
        : { tipo: 'nenhum' },
  },
  {
    id: 'devolucao-espelha-original',
    titulo: 'devolução usa a classificação do item no documento original',
    fonte: `${LC}, art. 12, § 7º, e art. 17`,
    vigencia: SINCE,
    nota: 'A lei fixa a mesma base e a mesma alíquota da operação original; a regra lê isso como o mesmo cClassTrib.',
    aplicar: ({ fatos: facts, item }: ContextoRegraLegal): ResultadoRegraLegal =>
      kindOf(facts, item) === 'devolucao' && item.referenciado
        ? { tipo: 'restringir', codigos: [item.referenciado.cClassTrib] }
        : { tipo: 'nenhum' },
  },
];
