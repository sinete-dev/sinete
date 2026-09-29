// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Rejected, RejectionHint } from '@sinete/core';
import { rejected } from '@sinete/core';
import type { Rejeicao, RejeicaoCategory } from '@sinete/rejeicoes';
import { enrichRejected, rejeicaoByCode, rejectionHint } from '@sinete/rejeicoes';
import type { RejeicaoMdfe } from '@sinete/rejeicoes/mdfe';
import { enrichRejectedMdfe, rejeicaoMdfeByCode } from '@sinete/rejeicoes/mdfe';
import type { NfseErro, NfseErroCategoria } from '@sinete/rejeicoes/nfse';
import { enrichNfseRejected, nfseErroByCode } from '@sinete/rejeicoes/nfse';

const r: Rejeicao | undefined = rejeicaoByCode('204');
const cat: RejeicaoCategory | undefined = r?.category;
const hint: RejectionHint | undefined = rejectionHint('204');
const out: Rejected = enrichRejected(rejected({ cStat: '204', xMotivo: 'Duplicidade' }));
// @ts-expect-error categoria é uma união fechada
const bad: RejeicaoCategory = 'outros';
const m: RejeicaoMdfe | undefined = rejeicaoMdfeByCode('609');
const outMdfe: Rejected = enrichRejectedMdfe(rejected({ cStat: '609', xMotivo: 'Encerrado' }));
const e: NfseErro | undefined = nfseErroByCode('E0312');
const nivel: '1' | '2' | '3' | undefined = e?.nivel;
const nOut: Rejected = enrichNfseRejected(rejected({ cStat: 'E0312', xMotivo: 'x' }));
// @ts-expect-error categoria da NFS-e é uma união fechada
const badN: NfseErroCategoria = 'outros';
void [cat, hint, out, bad, m, outMdfe, nivel, nOut, badN];
