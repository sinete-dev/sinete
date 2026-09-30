/**
 * `@sinete/cli`: o executável `sinete` e, para quem quiser embutir, o `rodarDoctor` programático e o upsert do bloco do
 * `AGENTS.md` e da skill `sinete` (`aplicarBloco`, `BLOCO_AGENTS`, `aplicarSkill`, `SKILL_SINETE`).
 */

export type { AcaoAgentsMd, AcaoSkill } from './agents-md.ts';
export {
  aplicarBloco,
  aplicarSkill,
  CLAUDE_MD,
  DIRETORIOS_SKILL,
  FIM_BLOCO,
  INICIO_BLOCO,
  MARCADOR_SKILL,
} from './agents-md.ts';
export { BLOCO_AGENTS } from './bloco-agents.ts';
export type { DoctorOpcoes, RelatorioDoDoctor, SituacaoDaVerificacao, VerificacaoDoDoctor } from './doctor.ts';
export { formatarCnpj, lerDataHttp, mascararCpf, mascararCpfs, rodarDoctor } from './doctor.ts';
export type { EntradaSaidaCli } from './main.ts';
export { formatarRelatorio, main } from './main.ts';
export { SKILL_SINETE } from './skill-sinete.ts';
