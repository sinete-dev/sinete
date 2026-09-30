/**
 * `sinete agents-md`: põe o bloco do sinete no `AGENTS.md` do projeto do integrador, entre os marcadores
 * `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no que está fora deles. O bloco
 * manda o agente de código ler a documentação embarcada da versão instalada antes de escrever código, dá as regras que
 * evitam nota duplicada e um índice curto dos pacotes. O texto é o de `docs/guia/bloco-agents.md`, gerado em
 * `bloco-agents.ts`.
 *
 * O comando também grava a skill `sinete` (`SKILL.md`, de `docs/guia/skill-sinete.md`, gerada em `skill-sinete.ts`) nos
 * diretórios de skills de projeto do Claude Code e do Codex, como complemento do bloco para quem trabalha com skills.
 */

export const INICIO_BLOCO = '<!-- BEGIN:sinete-agent-rules -->';
export const FIM_BLOCO = '<!-- END:sinete-agent-rules -->';

/** O que o upsert fez com o `AGENTS.md`. */
export type AcaoAgentsMd = 'criado' | 'inserido' | 'atualizado' | 'sem-mudanca';

/**
 * Devolve o `AGENTS.md` com o bloco: cria o arquivo, acrescenta o bloco no fim ou troca o que estiver entre os
 * marcadores. Lança se os marcadores estiverem incompletos, repetidos ou fora de ordem, para não apagar texto do
 * integrador.
 */
export function aplicarBloco(atual: string | undefined, bloco: string): { texto: string; acao: AcaoAgentsMd } {
  const novo = bloco.trimEnd();
  if (atual === undefined) return { texto: `${novo}\n`, acao: 'criado' };
  const inicio = atual.indexOf(INICIO_BLOCO);
  const fim = atual.indexOf(FIM_BLOCO);
  const repetido = atual.indexOf(INICIO_BLOCO, inicio + 1) >= 0 || atual.indexOf(FIM_BLOCO, fim + 1) >= 0;
  if (inicio < 0 && fim < 0) {
    const base = atual.trimEnd();
    return { texto: base === '' ? `${novo}\n` : `${base}\n\n${novo}\n`, acao: 'inserido' };
  }
  if (inicio < 0 || fim < 0 || fim < inicio || repetido) {
    throw new Error(
      `os marcadores do bloco do sinete no AGENTS.md estão incompletos, repetidos ou fora de ordem; corrija à mão (${INICIO_BLOCO} ... ${FIM_BLOCO})`,
    );
  }
  const texto = atual.slice(0, inicio) + novo + atual.slice(fim + FIM_BLOCO.length);
  return { texto, acao: texto === atual ? 'sem-mudanca' : 'atualizado' };
}

/** Conteúdo do `CLAUDE.md` criado quando o projeto não tem um: o Claude Code importa o `AGENTS.md` por ele. */
export const CLAUDE_MD = '@AGENTS.md\n';

/** Diretórios de projeto onde as ferramentas de agente procuram skills: Claude Code (`.claude/skills`) e Codex (`.agents/skills`, o padrão que o agentskills.io recomenda). */
export const DIRETORIOS_SKILL: readonly string[] = ['.claude/skills/sinete', '.agents/skills/sinete'];

/** Início da linha que marca o `SKILL.md` como gerado pelo comando. Sem ela, o arquivo é do integrador. */
export const MARCADOR_SKILL = '<!-- sinete-skill:';

/** O que o upsert fez com o `SKILL.md`. `preservada`: existe sem o marcador, logo é do integrador e não foi tocada. */
export type AcaoSkill = 'criada' | 'atualizada' | 'sem-mudanca' | 'preservada';

/**
 * Devolve o `SKILL.md` a gravar. Um arquivo que traz o marcador foi gerado pelo comando e é substituído pela versão
 * instalada; um sem o marcador é do integrador (o arquivo inteiro é a skill, então não há trecho seguro para trocar) e
 * fica como está. Apagar a linha do marcador é como o integrador assume a skill.
 */
export function aplicarSkill(atual: string | undefined, skill: string): { texto: string; acao: AcaoSkill } {
  const novo = `${skill.trimEnd()}\n`;
  if (atual === undefined) return { texto: novo, acao: 'criada' };
  if (!atual.includes(MARCADOR_SKILL)) return { texto: atual, acao: 'preservada' };
  return { texto: novo, acao: atual === novo ? 'sem-mudanca' : 'atualizada' };
}
