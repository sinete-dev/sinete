/**
 * `@sinete/cli`: o executável `sinete` e, para quem quiser embutir, o `runDoctor` programático e o upsert do bloco do
 * `AGENTS.md` e da skill `sinete` (`upsertBloco`, `BLOCO_AGENTS`, `upsertSkill`, `SKILL_SINETE`).
 */

export type { AcaoAgentsMd, AcaoSkill } from './agents-md.ts';
export {
  CLAUDE_MD,
  DIRETORIOS_SKILL,
  FIM_BLOCO,
  INICIO_BLOCO,
  MARCADOR_SKILL,
  upsertBloco,
  upsertSkill,
} from './agents-md.ts';
export { BLOCO_AGENTS } from './bloco-agents.ts';
export type { CheckStatus, DoctorCheck, DoctorOptions, DoctorReport } from './doctor.ts';
export { formatCnpj, maskCpf, maskCpfs, parseHttpDate, runDoctor } from './doctor.ts';
export type { CliIo } from './main.ts';
export { formatReport, main } from './main.ts';
export { SKILL_SINETE } from './skill-sinete.ts';
