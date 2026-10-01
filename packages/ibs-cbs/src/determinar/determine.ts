/**
 * Determinação: restrições oficiais, depois regras legais, depois respostas do usuário e resolvedores plugáveis, nessa
 * ordem. Cada decisão sai com proveniência (quem, quando, com que versão dos dados e por qual fonte), porque é isso que
 * o contribuinte mostra numa fiscalização. Assíncrona porque um resolvedor pode ser IA, cadastro ou fila de revisão.
 */
import type { Relogio } from '@sinete/core';
import type { ConteudoTributario } from '@sinete/ibs-cbs-dados';
import { vigente } from '@sinete/ibs-cbs-dados';
import type {
  CompraGovernamental,
  ItemClassificado,
  LocalDaOperacao,
  OperacaoClassificada,
} from '../calcular/index.ts';
import { exigirFormatoDosDados } from '../formato.ts';
import type { RestringirOpcoes } from './constrain.ts';
import { dataDoFato, restringirEm } from './constrain.ts';
import { ErroDeterminacao } from './errors.ts';
import { REGRAS_LEGAIS } from './legal.ts';
import type {
  Candidato,
  ContextoDoResolvedor,
  Determinacao,
  DeterminacaoDoItem,
  Exclusao,
  FatosDaOperacao,
  FatosDoItem,
  Pergunta,
  Procedencia,
  RegraAplicada,
  RegraLegal,
  Resolvedor,
  ResultadoDoResolvedor,
} from './types.ts';

export interface DeterminarEmOpcoes {
  /** Regras legais aplicadas; padrão: `REGRAS_LEGAIS`. */
  readonly regras?: readonly RegraLegal[];
  /** Resolvedores na ordem de consulta; padrão: `doPerfil()`, `candidatoUnico()`, `perguntarAoUsuario()`. */
  readonly resolvedores?: readonly Resolvedor[];
  /** Respostas às perguntas de uma chamada anterior: id da pergunta para o cClassTrib escolhido. */
  readonly respostas?: Readonly<Record<string, string>>;
  /** Relógio do instante da decisão, que vai na proveniência. */
  readonly relogio: Relogio;
  readonly signal?: AbortSignal;
}

export interface DeterminarOpcoes extends RestringirOpcoes, Omit<DeterminarEmOpcoes, 'relogio'> {
  /** Relógio do instante da decisão; padrão: o de emissão de `tempo`. */
  readonly relogio?: Relogio;
}

/** Id estável da pergunta de classificação de um item. */
export function idDaPergunta(n: number): string {
  return `cClassTrib:${n}`;
}

/** Decide quando só sobrou um candidato. */
export function candidatoUnico(): Resolvedor {
  return {
    nome: 'unique-candidate',
    resolver: async (ctx: ContextoDoResolvedor): Promise<ResultadoDoResolvedor> =>
      ctx.candidatos.length === 1 && ctx.candidatos[0]
        ? { tipo: 'decidido', cClassTrib: ctx.candidatos[0].cClassTrib, confianca: 1, evidencia: 'único candidato' }
        : { tipo: 'abster' },
  };
}

/** Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. */
export function doPerfil(): Resolvedor {
  return {
    nome: 'item-profile',
    resolver: async ({ item, candidatos: candidates }: ContextoDoResolvedor): Promise<ResultadoDoResolvedor> => {
      const p = item.perfil;
      if (!p || !candidates.some((c) => c.cClassTrib === p.cClassTrib)) return { tipo: 'abster' };
      return {
        tipo: 'decidido',
        cClassTrib: p.cClassTrib,
        confianca: 1,
        evidencia: { decididoPor: p.decididoPor ?? null },
      };
    },
  };
}

/** Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `respostas[idDaPergunta(n)]`. */
export function perguntarAoUsuario(): Resolvedor {
  return {
    nome: 'ask-user',
    resolver: async ({ item, candidatos: candidates }: ContextoDoResolvedor): Promise<ResultadoDoResolvedor> => {
      if (candidates.length === 0) return { tipo: 'abster' };
      const what = item.descricao ? `: ${item.descricao}` : '';
      return {
        tipo: 'perguntar',
        perguntas: [
          {
            id: idDaPergunta(item.n),
            item: item.n,
            texto: `Qual a classificação tributária do item ${item.n}${what}?`,
            opcoes: candidates.map((c) => ({
              rotulo: `${c.cClassTrib} ${c.nome ?? c.descricao}`,
              cClassTrib: c.cClassTrib,
            })),
          },
        ],
      };
    },
  };
}

export const RESOLVEDORES_PADRAO: readonly Resolvedor[] = [doPerfil(), candidatoUnico(), perguntarAoUsuario()];

interface Narrowed {
  readonly candidates: readonly Candidato[];
  readonly exclusions: readonly Exclusao[];
  readonly rules: readonly RegraAplicada[];
}

function applyRules(
  facts: FatosDaOperacao,
  item: FatosDoItem,
  content: ConteudoTributario,
  rules: readonly RegraLegal[],
  start: { candidatos: readonly Candidato[]; exclusoes: readonly Exclusao[] },
): Narrowed {
  let candidates = start.candidatos;
  const exclusions = [...start.exclusoes];
  const applied: RegraAplicada[] = [];
  for (const rule of rules) {
    if (!vigente(rule.vigencia, content.dataDeReferencia)) continue;
    const out = rule.aplicar({ fatos: facts, item, conteudo: content });
    if (out.tipo === 'nenhum') continue;
    const keep = new Set(out.codigos);
    const kept = candidates.filter((c) => keep.has(c.cClassTrib));
    for (const c of candidates) {
      if (keep.has(c.cClassTrib)) continue;
      exclusions.push({
        cClassTrib: c.cClassTrib,
        motivo: 'regra-legal',
        detalhe: `${rule.titulo}: só ${out.codigos.join(' ou ')}`,
        fonte: rule.fonte,
      });
    }
    applied.push({ regra: rule.id, fonte: rule.fonte, codigos: out.codigos, conflito: kept.length === 0 });
    candidates = kept;
  }
  return { candidates, exclusions, rules: applied };
}

function pick(candidates: readonly Candidato[], code: string): Candidato | undefined {
  return candidates.find((c) => c.cClassTrib === code);
}

/** Determinação na data do fato gerador de `opcoes.tempo`. */
export function determinar(fatos: FatosDaOperacao, opcoes: DeterminarOpcoes): Promise<Determinacao> {
  try {
    exigirFormatoDosDados(opcoes.dataset);
  } catch (e) {
    return Promise.reject(e);
  }
  const content = opcoes.dataset.em(dataDoFato(opcoes.tempo, opcoes.deslocamentoMin));
  return determinarEm(fatos, content, { ...opcoes, relogio: opcoes.relogio ?? opcoes.tempo.emissao });
}

/** Determinação numa visão já fixada numa data. */
export async function determinarEm(
  fatos: FatosDaOperacao,
  conteudo: ConteudoTributario,
  opcoes: DeterminarEmOpcoes,
): Promise<Determinacao> {
  const constrained = restringirEm(fatos, conteudo);
  const rules = opcoes.regras ?? REGRAS_LEGAIS;
  const resolvers = opcoes.resolvedores ?? RESOLVEDORES_PADRAO;
  const answers = opcoes.respostas ?? {};
  const base = (): Pick<Procedencia, 'em' | 'versaoDoConteudo' | 'dataDeReferencia'> => ({
    em: opcoes.relogio.agora().toISOString(),
    versaoDoConteudo: conteudo.dataset.versaoDoConteudo,
    dataDeReferencia: conteudo.dataDeReferencia,
  });
  const items: DeterminacaoDoItem[] = [];
  for (const [i, item] of fatos.itens.entries()) {
    const start = constrained[i] as (typeof constrained)[number];
    const { candidates, exclusions, rules: applied } = applyRules(fatos, item, conteudo, rules, start);
    const common = { n: item.n, candidatos: candidates, exclusoes: exclusions, regras: applied };

    const byUser = (id: string, answer: string): NonNullable<DeterminacaoDoItem['decidido']> => {
      const chosen = pick(candidates, answer);
      if (!chosen) {
        throw new ErroDeterminacao(
          'resposta_fora_dos_candidatos',
          `resposta ${answer} à pergunta ${id} fora dos candidatos do item ${item.n}`,
          item.n,
        );
      }
      return { candidato: chosen, procedencia: { por: 'usuario', nome: id, ...base() } };
    };
    const answer = answers[idDaPergunta(item.n)];
    if (answer !== undefined) {
      items.push({ ...common, decidido: byUser(idDaPergunta(item.n), answer) });
      continue;
    }

    const last = applied.at(-1);
    if (last && candidates.length === 1 && candidates[0]) {
      items.push({
        ...common,
        decidido: {
          candidato: candidates[0],
          procedencia: { por: 'regra', nome: last.regra, fonte: last.fonte, ...base() },
        },
      });
      continue;
    }

    let decided: DeterminacaoDoItem['decidido'];
    let pending: readonly Pergunta[] | undefined;
    for (const resolver of resolvers) {
      opcoes.signal?.throwIfAborted();
      const out = await resolver.resolver(
        { fatos: fatos, item, candidatos: candidates, conteudo: conteudo, respostas: answers },
        opcoes.signal,
      );
      if (out.tipo === 'abster') continue;
      if (out.tipo === 'perguntar') {
        // Pergunta de um resolvedor com id próprio: a resposta volta em answers[id], como a do perguntarAoUsuario.
        const answered = out.perguntas.find((q) => q.item === item.n && answers[q.id] !== undefined);
        if (answered) decided = byUser(answered.id, answers[answered.id] as string);
        else pending = out.perguntas;
        break;
      }
      if (typeof out.confianca !== 'number' || !(out.confianca >= 0 && out.confianca <= 1)) {
        throw new ErroDeterminacao(
          'resolvedor_invalido',
          `resolvedor ${resolver.nome} devolveu confiança fora de [0, 1]: ${String(out.confianca)}`,
          item.n,
        );
      }
      const chosen = pick(candidates, out.cClassTrib);
      if (!chosen) {
        throw new ErroDeterminacao(
          'resolvedor_fora_dos_candidatos',
          `resolvedor ${resolver.nome} escolheu ${out.cClassTrib}, fora dos candidatos do item ${item.n}`,
          item.n,
        );
      }
      decided = {
        candidato: chosen,
        procedencia: {
          por: 'resolvedor',
          nome: resolver.nome,
          confianca: out.confianca,
          ...(out.evidencia === undefined ? {} : { evidencia: out.evidencia }),
          ...base(),
        },
      };
      break;
    }
    items.push({ ...common, ...(decided ? { decidido: decided } : {}), ...(pending ? { pendente: pending } : {}) });
  }
  return {
    dataDeReferencia: conteudo.dataDeReferencia,
    versaoDoConteudo: conteudo.dataset.versaoDoConteudo,
    itens: items,
    completa: items.every((d) => d.decidido !== undefined),
  };
}

/** Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). */
export type EntradaDoItem = Omit<ItemClassificado, 'n' | 'cst' | 'cClassTrib'>;

export interface EntradaDaOperacao {
  readonly modelo: number;
  readonly local: LocalDaOperacao;
  readonly compraGovernamental?: CompraGovernamental;
}

/** Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. */
export function paraClassificado(
  det: Determinacao,
  op: EntradaDaOperacao,
  item: (n: number, candidato: Candidato) => EntradaDoItem,
): OperacaoClassificada {
  return {
    ...op,
    itens: det.itens.map((d) => {
      if (!d.decidido) {
        throw new ErroDeterminacao('determinacao_incompleta', `item ${d.n} sem classificação decidida`, d.n);
      }
      const c = d.decidido.candidato;
      return { ...item(d.n, c), n: d.n, cst: c.cst, cClassTrib: c.cClassTrib };
    }),
  };
}
