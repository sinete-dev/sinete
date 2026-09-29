// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { ValidationIssue } from '@sinete/core';
import type {
  AutorizacaoOutcome,
  BuildMdfeResult,
  MdfeClient,
  MdfeInput,
  MdfeIssueCode,
  TrechoInvalido,
  UfMdfe,
  VeiculoTracao,
} from '@sinete/mdfe';
import { conferirPercurso, Decimal, TipoCarga, TipoEmitente } from '@sinete/mdfe';

const tracao: VeiculoTracao = {
  placa: 'ABC1D23',
  tara: 10000,
  condutores: [{ xNome: 'CONDUTOR', CPF: '52998224725' }],
  tpRod: '03',
  tpCar: '03',
};
// @ts-expect-error tpRod vai de 01 a 06
const errado: VeiculoTracao = { ...tracao, tpRod: '07' };
const tipo: TipoEmitente = TipoEmitente.CARGA_PROPRIA;
const carga: TipoCarga = TipoCarga.GRANEL_SOLIDO;
const uf: UfMdfe = 'MS';
const trecho: TrechoInvalido | undefined = conferirPercurso('MT', [uf], 'SP');
declare const input: MdfeInput;
declare const r: BuildMdfeResult;
declare const client: MdfeClient;
if (!r.ok) {
  const issues: readonly ValidationIssue[] = r.issues;
  void issues;
}
const code: MdfeIssueCode = 'percurso_invalido';
const d: Decimal = Decimal.of('1.5');
declare const emitido: AutorizacaoOutcome;
const mdfeProc: string | undefined = emitido.status === 'authorized' ? emitido.value.mdfeProc : undefined;
void [errado, tipo, carga, trecho, input, client, code, d, mdfeProc];
