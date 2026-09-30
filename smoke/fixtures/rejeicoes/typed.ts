// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Recusado, DicaRejeicao } from '@sinete/core';
import { criarRecusado } from '@sinete/core';
import type { Rejeicao, CategoriaRejeicao } from '@sinete/rejeicoes';
import { completarRecusado, rejeicaoPorCodigo, dicaRejeicao } from '@sinete/rejeicoes';
import type { RejeicaoMdfe } from '@sinete/rejeicoes/mdfe';
import { completarRecusadoMdfe, rejeicaoMdfePorCodigo } from '@sinete/rejeicoes/mdfe';
import type { NfseErro, NfseErroCategoria } from '@sinete/rejeicoes/nfse';
import { completarRecusadoNfse, nfseErroPorCodigo } from '@sinete/rejeicoes/nfse';

const r: Rejeicao | undefined = rejeicaoPorCodigo('204');
const cat: CategoriaRejeicao | undefined = r?.categoria;
const hint: DicaRejeicao | undefined = dicaRejeicao('204');
const out: Recusado = completarRecusado(criarRecusado({ cStat: '204', xMotivo: 'Duplicidade' }));
// @ts-expect-error categoria é uma união fechada
const bad: CategoriaRejeicao = 'outros';
const m: RejeicaoMdfe | undefined = rejeicaoMdfePorCodigo('609');
const outMdfe: Recusado = completarRecusadoMdfe(criarRecusado({ cStat: '609', xMotivo: 'Encerrado' }));
const e: NfseErro | undefined = nfseErroPorCodigo('E0312');
const nivel: '1' | '2' | '3' | undefined = e?.nivel;
const nOut: Recusado = completarRecusadoNfse(criarRecusado({ cStat: 'E0312', xMotivo: 'x' }));
// @ts-expect-error categoria da NFS-e é uma união fechada
const badN: NfseErroCategoria = 'outros';
void [cat, hint, out, bad, m, outMdfe, nivel, nOut, badN];
