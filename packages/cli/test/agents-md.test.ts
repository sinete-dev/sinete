import { describe, expect, test } from 'bun:test';
import type { EntradaSaidaCli } from '../src/index.ts';
import {
  aplicarBloco,
  aplicarSkill,
  BLOCO_AGENTS,
  CLAUDE_MD,
  DIRETORIOS_SKILL,
  FIM_BLOCO,
  INICIO_BLOCO,
  MARCADOR_SKILL,
  main,
  SKILL_SINETE,
} from '../src/index.ts';

const BLOCO = `${INICIO_BLOCO}\nregras novas\n${FIM_BLOCO}\n`;

/** Sistema de arquivos em memória: só o que o comando lê e escreve. */
function io(
  files: Record<string, string> = {},
): EntradaSaidaCli & { files: Record<string, string>; outLines: string[]; errLines: string[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    files,
    outLines,
    errLines,
    saida: (l) => outLines.push(l),
    erro: (l) => errLines.push(l),
    env: {},
    pedirSenha: async () => undefined,
    lerArquivo: async (p) => {
      const v = files[p];
      if (v === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return new TextEncoder().encode(v);
    },
    gravarArquivo: async (p, text) => {
      files[p] = text;
    },
  };
}

describe('aplicarBloco', () => {
  test('cria, acrescenta no fim e troca só o que está entre os marcadores', () => {
    expect(aplicarBloco(undefined, BLOCO)).toEqual({ texto: BLOCO, acao: 'criado' });
    expect(aplicarBloco('', BLOCO)).toEqual({ texto: BLOCO, acao: 'inserido' });
    expect(aplicarBloco('# Projeto\n\nregra minha\n', BLOCO)).toEqual({
      texto: `# Projeto\n\nregra minha\n\n${BLOCO}`,
      acao: 'inserido',
    });
    const antigo = `# Projeto\n\n${INICIO_BLOCO}\nregras velhas\n${FIM_BLOCO}\n\n## Depois\n\nnão mexa\n`;
    const r = aplicarBloco(antigo, BLOCO);
    expect(r.acao).toBe('atualizado');
    expect(r.texto).toBe(`# Projeto\n\n${INICIO_BLOCO}\nregras novas\n${FIM_BLOCO}\n\n## Depois\n\nnão mexa\n`);
    expect(aplicarBloco(r.texto, BLOCO)).toEqual({ texto: r.texto, acao: 'sem-mudanca' });
  });

  test('marcadores incompletos, repetidos ou fora de ordem: lança sem mexer', () => {
    for (const ruim of [
      `${INICIO_BLOCO}\nsem fim\n`,
      `sem início\n${FIM_BLOCO}\n`,
      `${FIM_BLOCO}\n${INICIO_BLOCO}\n`,
      `${BLOCO}\n${BLOCO}`,
    ]) {
      expect(() => aplicarBloco(ruim, BLOCO)).toThrow('marcadores');
    }
  });

  test('o bloco publicado tem os marcadores e cabe em 8 KB', () => {
    expect(BLOCO_AGENTS.startsWith(INICIO_BLOCO)).toBe(true);
    expect(BLOCO_AGENTS.trimEnd().endsWith(FIM_BLOCO)).toBe(true);
    expect(new TextEncoder().encode(BLOCO_AGENTS).length).toBeLessThanOrEqual(8192);
  });
});

describe('sinete agents-md', () => {
  test('projeto sem AGENTS.md nem CLAUDE.md: cria os dois', async () => {
    const x = io();
    expect(await main(['agents-md', '--dir', 'app', '--sem-skill'], x)).toBe(0);
    expect(x.files['app/AGENTS.md']).toBe(BLOCO_AGENTS);
    expect(x.files['app/CLAUDE.md']).toBe(CLAUDE_MD);
    expect(x.outLines).toEqual(['app/AGENTS.md: criado com o bloco do sinete', 'app/CLAUDE.md: criado com @AGENTS.md']);
  });

  test('AGENTS.md do integrador: preserva o resto; CLAUDE.md existente não é tocado', async () => {
    const x = io({ 'AGENTS.md': '# Meu projeto\n\nuse pnpm\n', 'CLAUDE.md': 'minhas regras\n' });
    expect(await main(['agents-md', '--sem-skill'], x)).toBe(0);
    expect(x.files['AGENTS.md']).toBe(`# Meu projeto\n\nuse pnpm\n\n${BLOCO_AGENTS}`);
    expect(x.files['CLAUDE.md']).toBe('minhas regras\n');
    expect(x.outLines[1]).toContain('acrescente a linha @AGENTS.md');
    // Segunda vez: nada muda, nada é escrito.
    const antes = { ...x.files };
    x.outLines.length = 0;
    x.files['CLAUDE.md'] = '@AGENTS.md\nminhas regras\n';
    antes['CLAUDE.md'] = x.files['CLAUDE.md'];
    expect(await main(['agents-md', '--sem-skill'], x)).toBe(0);
    expect(x.files).toEqual(antes);
    expect(x.outLines).toEqual(['AGENTS.md: bloco do sinete já em dia']);
  });

  test('bloco antigo entre os marcadores é trocado pelo da versão instalada', async () => {
    const x = io({
      'AGENTS.md': `antes\n\n${INICIO_BLOCO}\nvelho\n${FIM_BLOCO}\n\ndepois\n`,
      'CLAUDE.md': '@AGENTS.md\n',
    });
    expect(await main(['agents-md', '--sem-skill'], x)).toBe(0);
    expect(x.files['AGENTS.md']).toBe(`antes\n\n${BLOCO_AGENTS.trimEnd()}\n\ndepois\n`);
    expect(x.outLines).toEqual(['AGENTS.md: bloco do sinete atualizado']);
  });

  test('marcadores quebrados: sai com 1 sem escrever', async () => {
    const x = io({ 'AGENTS.md': `${INICIO_BLOCO}\nsem fim\n` });
    expect(await main(['agents-md'], x)).toBe(1);
    expect(x.files['AGENTS.md']).toBe(`${INICIO_BLOCO}\nsem fim\n`);
    expect(x.files['CLAUDE.md']).toBeUndefined();
    expect(x.errLines[0]).toStartWith('sinete agents-md:');
  });

  test('erro de leitura que não é arquivo ausente propaga como falha', async () => {
    const x = io();
    const falha = {
      ...x,
      lerArquivo: async () => Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' })),
    };
    expect(await main(['agents-md', '--sem-skill'], falha)).toBe(1);
    expect(x.errLines[0]).toContain('EACCES');
    expect(x.files).toEqual({});
  });

  test('CLI embutida sem gravarArquivo: sai com 2 e aponta o --imprimir', async () => {
    const { gravarArquivo: _, ...semEscrita } = io();
    const x = { ...semEscrita, errLines: [] as string[] };
    const r = await main(['agents-md'], { ...x, erro: (l) => x.errLines.push(l) });
    expect(r).toBe(2);
    expect(x.errLines[0]).toContain('--imprimir');
  });

  test('--imprimir só mostra o bloco; opção desconhecida é uso errado', async () => {
    const x = io();
    expect(await main(['agents-md', '--imprimir'], x)).toBe(0);
    expect(x.outLines).toEqual([BLOCO_AGENTS.trimEnd()]);
    expect(x.files).toEqual({});
    expect(await main(['agents-md', '--nada'], io())).toBe(2);
    expect(await main(['agents-md', '--help'], io())).toBe(0);
  });
});

const CAMINHOS_SKILL = DIRETORIOS_SKILL.map((d) => `${d}/SKILL.md`);

describe('aplicarSkill', () => {
  test('cria, atualiza a gerada, mantém a do integrador', () => {
    expect(aplicarSkill(undefined, SKILL_SINETE)).toEqual({ texto: SKILL_SINETE, acao: 'criada' });
    expect(aplicarSkill(SKILL_SINETE, SKILL_SINETE)).toEqual({ texto: SKILL_SINETE, acao: 'sem-mudanca' });
    expect(aplicarSkill(`antiga\n${MARCADOR_SKILL} v0 -->\n`, SKILL_SINETE)).toEqual({
      texto: SKILL_SINETE,
      acao: 'atualizada',
    });
    const dele = '---\nname: sinete\ndescription: minha\n---\nmeu texto\n';
    expect(aplicarSkill(dele, SKILL_SINETE)).toEqual({ texto: dele, acao: 'preservada' });
  });

  test('a skill publicada segue o formato Agent Skills e aponta para a documentação instalada', () => {
    const m = /^---\nname: (\S+)\ndescription: (.+)\n---\n/.exec(SKILL_SINETE);
    expect(m?.[1]).toBe('sinete');
    expect((m?.[2] ?? '').length).toBeLessThanOrEqual(1024);
    expect(m?.[2]).toContain('NF-e');
    expect(SKILL_SINETE).toContain(MARCADOR_SKILL);
    expect(SKILL_SINETE).toContain('node_modules/sinete/docs/index.md');
    expect(SKILL_SINETE).toContain('bloco-agents.md');
    expect(SKILL_SINETE.split('\n').length).toBeLessThan(500);
  });
});

describe('sinete agents-md: skill', () => {
  test('cria a skill nos diretórios do Claude Code e do Codex junto com o bloco', async () => {
    const x = io();
    expect(await main(['agents-md', '--dir', 'app'], x)).toBe(0);
    expect(CAMINHOS_SKILL).toEqual(['.claude/skills/sinete/SKILL.md', '.agents/skills/sinete/SKILL.md']);
    for (const c of CAMINHOS_SKILL) expect(x.files[`app/${c}`]).toBe(SKILL_SINETE);
    expect(x.outLines).toEqual([
      'app/AGENTS.md: criado com o bloco do sinete',
      'app/CLAUDE.md: criado com @AGENTS.md',
      'app/.claude/skills/sinete/SKILL.md: skill do sinete criada',
      'app/.agents/skills/sinete/SKILL.md: skill do sinete criada',
    ]);
  });

  test('segunda execução não escreve nada; versão nova da skill gerada é atualizada', async () => {
    const x = io();
    await main(['agents-md'], x);
    const escritas: string[] = [];
    const escreve = x.gravarArquivo;
    const y = {
      ...x,
      gravarArquivo: async (p: string, t: string) => {
        escritas.push(p);
        await escreve?.(p, t);
      },
    };
    x.outLines.length = 0;
    expect(await main(['agents-md'], y)).toBe(0);
    expect(escritas).toEqual([]);
    expect(x.outLines.slice(-2)).toEqual([
      '.claude/skills/sinete/SKILL.md: skill do sinete já em dia',
      '.agents/skills/sinete/SKILL.md: skill do sinete já em dia',
    ]);
    x.files['.claude/skills/sinete/SKILL.md'] = `versão velha\n${MARCADOR_SKILL} antigo -->\n`;
    x.outLines.length = 0;
    expect(await main(['agents-md'], y)).toBe(0);
    expect(x.files['.claude/skills/sinete/SKILL.md']).toBe(SKILL_SINETE);
    expect(x.outLines.at(-2)).toBe('.claude/skills/sinete/SKILL.md: skill do sinete atualizada');
  });

  test('projeto que já tem uma skill sinete sem o marcador: mantém, avisa e atualiza só a outra', async () => {
    const dele = '---\nname: sinete\ndescription: do integrador\n---\nregras dele\n';
    const x = io({ '.claude/skills/sinete/SKILL.md': dele });
    expect(await main(['agents-md'], x)).toBe(0);
    expect(x.files['.claude/skills/sinete/SKILL.md']).toBe(dele);
    expect(x.files['.agents/skills/sinete/SKILL.md']).toBe(SKILL_SINETE);
    expect(x.outLines).toContain(
      '.claude/skills/sinete/SKILL.md: já existe sem a linha <!-- sinete-skill: ... -->, então é sua e foi mantida; apague o arquivo para o sinete gerar a dele',
    );
    // Rodar de novo continua sem tocar na dela.
    expect(await main(['agents-md'], x)).toBe(0);
    expect(x.files['.claude/skills/sinete/SKILL.md']).toBe(dele);
  });

  test('--sem-skill não cria nem atualiza a skill, mesmo a gerada', async () => {
    const x = io();
    expect(await main(['agents-md', '--sem-skill'], x)).toBe(0);
    expect(Object.keys(x.files).sort()).toEqual(['AGENTS.md', 'CLAUDE.md']);
    const velha = `velha\n${MARCADOR_SKILL} antigo -->\n`;
    x.files['.agents/skills/sinete/SKILL.md'] = velha;
    expect(await main(['agents-md', '--sem-skill'], x)).toBe(0);
    expect(x.files['.agents/skills/sinete/SKILL.md']).toBe(velha);
  });

  test('--imprimir não grava skill nenhuma e não a imprime', async () => {
    const x = io();
    expect(await main(['agents-md', '--imprimir'], x)).toBe(0);
    expect(x.files).toEqual({});
    expect(x.outLines).toEqual([BLOCO_AGENTS.trimEnd()]);
  });

  test('marcadores quebrados no AGENTS.md: sai com 1 sem gravar a skill', async () => {
    const x = io({ 'AGENTS.md': `${INICIO_BLOCO}\nsem fim\n` });
    expect(await main(['agents-md'], x)).toBe(1);
    expect(Object.keys(x.files)).toEqual(['AGENTS.md']);
  });
});
