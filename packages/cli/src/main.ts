/**
 * Linha de comando do `sinete`: `doctor` e `agents-md`.
 *
 * A senha do PFX vem de uma variável de ambiente (`--senha-env`, padrão `SINETE_PFX_SENHA`) ou de um prompt sem eco no
 * terminal; nunca de argumento (fica no histórico e no `ps`). Nada de material de chave vai para a saída.
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Ambiente, Uf } from '@sinete/core';
import { ehAmbiente, ehUf } from '@sinete/core';
import { aplicarBloco, aplicarSkill, CLAUDE_MD, DIRETORIOS_SKILL } from './agents-md.ts';
import { BLOCO_AGENTS } from './bloco-agents.ts';
import type { DoctorOpcoes, RelatorioDoDoctor } from './doctor.ts';
import { rodarDoctor } from './doctor.ts';
import { SKILL_SINETE } from './skill-sinete.ts';

export interface EntradaSaidaCli {
  readonly saida: (linha: string) => void;
  readonly erro: (linha: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Pergunta a senha sem eco; `undefined` quando não há terminal. */
  readonly pedirSenha: (pergunta: string) => Promise<string | undefined>;
  /** Lê um arquivo; lança com `code: 'ENOENT'` quando ele não existe. */
  readonly lerArquivo: (caminho: string) => Promise<Uint8Array>;
  /** Escreve um arquivo de texto; só o `agents-md` usa. Sem ela, o comando sai sem escrever. */
  readonly gravarArquivo?: (caminho: string, texto: string) => Promise<void>;
  readonly doctor?: (opcoes: DoctorOpcoes) => Promise<RelatorioDoDoctor>;
}

const HELP = `uso: sinete doctor --pfx <arquivo.pfx> [opções]
     sinete agents-md [--dir <projeto>] [--imprimir] [--sem-skill]

agents-md: põe (ou atualiza) o bloco do sinete no AGENTS.md do projeto, entre os marcadores
<!-- BEGIN:sinete-agent-rules --> e <!-- END:sinete-agent-rules -->, sem tocar no resto,
e cria um CLAUDE.md com @AGENTS.md se não houver um. O bloco manda o agente de código ler
a documentação embarcada da versão instalada (node_modules/sinete/docs/). Também grava a skill
sinete em .claude/skills/sinete/SKILL.md (Claude Code) e .agents/skills/sinete/SKILL.md (Codex e
outras ferramentas do padrão agentskills.io), que aponta para a mesma documentação. Uma skill sem a
linha <!-- sinete-skill: ... --> é do projeto e não é tocada.

  --dir <projeto>          pasta do projeto (padrão: a atual)
  --imprimir               só mostra o bloco, sem escrever nada
  --sem-skill              não instala nem atualiza a skill sinete

doctor: confere o certificado A1, a cadeia ICP-Brasil, o relógio e o handshake TLS com um
endpoint. Nunca mostra chave, senha nem o PFX.

  --pfx <arquivo>          PFX/P12 do A1 (obrigatório)
  --senha-env <VAR>        variável com a senha (padrão SINETE_PFX_SENHA); sem ela, pergunta no terminal
  --cadeia <arquivo.pem>   intermediárias da AC, quando o PFX só traz a folha
  --aceitar-vencido        não falha por certificado vencido (diagnóstico)
  --uf <UF>                NF-e: autorizador da UF (NfeStatusServico)
  --documento <nfe|mdfe|nfse>
  --ambiente <homologacao|producao>   padrão homologacao
  --endpoint <url>         URL explícita (sobrepõe a resolvida pelos dados)
  --status                 envia a consulta de status do serviço (padrão: só o handshake)
  --relogio-url <url>      referência de relógio (cabeçalho Date de um HEAD)
  --ac <arquivo.pem>       AC extra para o TLS (proxy corporativo, servidor de teste)
  --timeout <ms>           padrão 30000
  --json                   saída em JSON
`;

const MARK: Record<string, string> = { ok: 'ok    ', aviso: 'aviso ', falha: 'FALHA ', pulado: 'pulado' };

export function formatarRelatorio(relatorio: RelatorioDoDoctor): string[] {
  return [
    ...relatorio.verificacoes.map((c) => `${MARK[c.situacao]} ${c.id.padEnd(8)} ${c.mensagem}`),
    relatorio.ok ? 'doctor: nada impede o uso' : 'doctor: há falhas',
  ];
}

const naoExiste = (e: unknown): boolean => (e as { code?: unknown } | null)?.code === 'ENOENT';

async function lerTexto(io: EntradaSaidaCli, arquivo: string): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await io.lerArquivo(arquivo));
  } catch (e) {
    if (naoExiste(e)) return undefined;
    throw e;
  }
}

async function agentsMd(rest: readonly string[], io: EntradaSaidaCli): Promise<number> {
  let values: {
    dir?: string | undefined;
    imprimir?: boolean | undefined;
    'sem-skill'?: boolean | undefined;
    help?: boolean | undefined;
  };
  try {
    values = parseArgs({
      args: [...rest],
      options: {
        dir: { type: 'string', default: '.' },
        imprimir: { type: 'boolean' },
        'sem-skill': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    }).values;
  } catch (e) {
    io.erro(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (values.help) {
    io.saida(HELP);
    return 0;
  }
  if (values.imprimir) {
    io.saida(BLOCO_AGENTS.trimEnd());
    return 0;
  }
  const escrever = io.gravarArquivo;
  if (escrever === undefined) {
    io.erro('sinete agents-md: esta CLI foi embutida sem gravarArquivo; use --imprimir e cole o bloco à mão');
    return 2;
  }
  const dir = values.dir ?? '.';
  const agents = path.join(dir, 'AGENTS.md');
  const claude = path.join(dir, 'CLAUDE.md');
  try {
    const r = aplicarBloco(await lerTexto(io, agents), BLOCO_AGENTS);
    if (r.acao !== 'sem-mudanca') await escrever(agents, r.texto);
    const acao = {
      criado: 'criado com o bloco do sinete',
      inserido: 'bloco do sinete acrescentado no fim',
      atualizado: 'bloco do sinete atualizado',
      'sem-mudanca': 'bloco do sinete já em dia',
    }[r.acao];
    io.saida(`${agents}: ${acao}`);
    const atualClaude = await lerTexto(io, claude);
    if (atualClaude === undefined) {
      await escrever(claude, CLAUDE_MD);
      io.saida(`${claude}: criado com @AGENTS.md`);
    } else if (!atualClaude.includes('@AGENTS.md')) {
      io.saida(
        `${claude}: já existe e não importa o AGENTS.md; acrescente a linha @AGENTS.md para o Claude Code ler o bloco`,
      );
    }
    if (!values['sem-skill']) {
      for (const pasta of DIRETORIOS_SKILL) {
        const arquivo = path.join(dir, pasta, 'SKILL.md');
        const s = aplicarSkill(await lerTexto(io, arquivo), SKILL_SINETE);
        if (s.acao === 'criada' || s.acao === 'atualizada') await escrever(arquivo, s.texto);
        io.saida(
          `${arquivo}: ${
            {
              criada: 'skill do sinete criada',
              atualizada: 'skill do sinete atualizada',
              'sem-mudanca': 'skill do sinete já em dia',
              preservada:
                'já existe sem a linha <!-- sinete-skill: ... -->, então é sua e foi mantida; apague o arquivo para o sinete gerar a dele',
            }[s.acao]
          }`,
        );
      }
    }
  } catch (e) {
    io.erro(`sinete agents-md: ${(e as Error).message}`);
    return 1;
  }
  return 0;
}

/** Executa a CLI e devolve o código de saída. */
export async function main(argv: readonly string[], io: EntradaSaidaCli): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.saida(HELP);
    return command === undefined ? 2 : 0;
  }
  if (command === 'agents-md') return agentsMd(rest, io);
  if (command !== 'doctor') {
    io.erro(`comando desconhecido: ${command}\n\n${HELP}`);
    return 2;
  }
  let values: Record<string, string | boolean | undefined>;
  try {
    values = parseArgs({
      args: [...rest],
      options: {
        pfx: { type: 'string' },
        'senha-env': { type: 'string', default: 'SINETE_PFX_SENHA' },
        cadeia: { type: 'string' },
        'aceitar-vencido': { type: 'boolean', default: false },
        uf: { type: 'string' },
        documento: { type: 'string' },
        ambiente: { type: 'string', default: 'homologacao' },
        endpoint: { type: 'string' },
        status: { type: 'boolean', default: false },
        'relogio-url': { type: 'string' },
        ac: { type: 'string' },
        timeout: { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h' },
      },
    }).values;
  } catch (e) {
    io.erro(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (values.help) {
    io.saida(HELP);
    return 0;
  }
  const fail = (msg: string): number => {
    io.erro(`sinete doctor: ${msg}`);
    return 2;
  };
  if (typeof values.pfx !== 'string') return fail('informe --pfx');
  const uf = typeof values.uf === 'string' ? values.uf.toUpperCase() : undefined;
  if (uf !== undefined && !ehUf(uf)) return fail(`UF inválida: ${values.uf}`);
  const ambiente = values.ambiente as string;
  if (!ehAmbiente(ambiente)) return fail(`ambiente inválido: ${ambiente}`);
  const documento = values.documento as string | undefined;
  if (documento !== undefined && !['nfe', 'mdfe', 'nfse'].includes(documento))
    return fail(`documento inválido: ${documento}`);
  const timeoutMs = values.timeout === undefined ? undefined : Number(values.timeout);
  if (timeoutMs !== undefined && !(Number.isFinite(timeoutMs) && timeoutMs > 0))
    return fail(`timeout inválido: ${values.timeout}`);

  let password = io.env[values['senha-env'] as string];
  if (password === undefined) {
    password = await io.pedirSenha('Senha do PFX: ');
    if (password === undefined) return fail(`defina ${values['senha-env']} ou rode num terminal para digitar a senha`);
  }
  let pfx: Uint8Array;
  try {
    pfx = await io.lerArquivo(values.pfx);
  } catch (e) {
    return fail(`não consegui ler ${values.pfx}: ${(e as Error).message}`);
  }
  const text = async (p: unknown): Promise<string | undefined> =>
    typeof p === 'string' ? new TextDecoder().decode(await io.lerArquivo(p)) : undefined;
  let extraChainPem: string | undefined;
  let extraCaPem: string | undefined;
  try {
    extraChainPem = await text(values.cadeia);
    extraCaPem = await text(values.ac);
  } catch (e) {
    return fail((e as Error).message);
  }
  const options: DoctorOpcoes = {
    pfx,
    senha: password,
    aceitarVencido: values['aceitar-vencido'] === true,
    consultarStatus: values.status === true,
    ambiente: ambiente as Ambiente,
    ...(extraChainPem === undefined ? {} : { cadeiaAdicionalPem: extraChainPem }),
    ...(extraCaPem === undefined ? {} : { acsAdicionaisPem: extraCaPem }),
    ...(uf === undefined ? {} : { uf: uf as Uf }),
    ...(documento === undefined ? {} : { documento: documento as 'nfe' | 'mdfe' | 'nfse' }),
    ...(typeof values.endpoint === 'string' ? { endpoint: { url: values.endpoint } } : {}),
    ...(typeof values['relogio-url'] === 'string' ? { urlDoRelogio: values['relogio-url'] } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
  let report: RelatorioDoDoctor;
  try {
    report = await (io.doctor ?? rodarDoctor)(options);
  } catch (e) {
    return fail((e as Error).message);
  }
  if (values.json) io.saida(JSON.stringify(report, null, 2));
  else for (const line of formatarRelatorio(report)) io.saida(line);
  return report.ok ? 0 : 1;
}
