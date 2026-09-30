// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import * as daMdfe from '@sinete/da/mdfe';
import * as daNfe from '@sinete/da/nfe';
import * as daNfse from '@sinete/da/nfse';
import type {
  AoDecidir,
  Desfecho,
  DestinoDosBytes,
  PoliticaRetomada,
  RegistroTransmissao,
  ResumoRetomada,
  TransmissaoStore,
} from '@sinete/emissor';
import { POLITICA_RETOMADA_PADRAO, retomarPendentes } from '@sinete/emissor';
import type { CasoContrato } from '@sinete/emissor/contrato';
import { casosDoContrato } from '@sinete/emissor/contrato';
import type { EmissorMdfe, EmissorMdfeOpcoes } from '@sinete/emissor/mdfe';
import { criarEmissorMdfe } from '@sinete/emissor/mdfe';
import { criarMemoriaStore } from '@sinete/emissor/memoria';
import type { DesfechoNfe, EmissorNfe, EmissorNfeOpcoes } from '@sinete/emissor/nfe';
import { criarEmissorNfe } from '@sinete/emissor/nfe';
import type { EmissorNfse, EmissorNfseOpcoes } from '@sinete/emissor/nfse';
import { criarEmissorNfse } from '@sinete/emissor/nfse';

declare const pfx: Uint8Array;
const store: TransmissaoStore = criarMemoriaStore();
const aoDecidir: AoDecidir = async (_registro: RegistroTransmissao, _desfecho): Promise<void> => {};
const nfe: Promise<EmissorNfe> = criarEmissorNfe({
  pfx,
  senha: 's',
  ambiente: 'homologacao',
  store,
  aoDecidir,
  // O módulo do @sinete/da serve como está para o pdf().
  da: daNfe,
});
const mdfe: Promise<EmissorMdfe> = criarEmissorMdfe({ pfx, senha: 's', ambiente: 'homologacao', store, aoDecidir, da: daMdfe });
const nfse: Promise<EmissorNfse> = criarEmissorNfse({ pfx, senha: 's', ambiente: 'homologacao', store, aoDecidir, da: daNfse });
const danfsePdf: Promise<Uint8Array> = nfse.then((e) => e.pdf('<NFSe/>', { canhoto: false }));
const danfsePorChave: Promise<Uint8Array | undefined> = nfse.then((e) => e.pdfPorChave('chave'));
// @ts-expect-error store é obrigatório
const semStore: EmissorNfeOpcoes = { pfx, senha: 's', ambiente: 'homologacao', aoDecidir };
// aoDecidir pode vir na criação ou em cada chamada de emitir e retomar.
const semDecisao: EmissorMdfeOpcoes = { pfx, senha: 's', ambiente: 'homologacao', store };
// @ts-expect-error aoAssinar saiu: os bytes vão para o store
const comGancho: EmissorNfseOpcoes = { pfx, senha: 's', ambiente: 'homologacao', store, aoDecidir, aoAssinar: () => {} };
declare const d: DesfechoNfe;
const proc: string | undefined = d.tipo === 'autorizado' ? d.proc : undefined;
const generico: Desfecho = d;
const destino: DestinoDosBytes = 'manter';
const politica: PoliticaRetomada = { ...POLITICA_RETOMADA_PADRAO, lote: 10 };
const resumo: Promise<ResumoRetomada> = retomarPendentes({
  store,
  usarEmissor: (_registro, fn) => nfe.then(fn),
  aoAlertar: () => {},
  politica,
});
const casos: readonly CasoContrato[] = casosDoContrato({ criar: () => ({ a: store, b: store }) });
void [mdfe, nfse, danfsePdf, danfsePorChave, semStore, semDecisao, comGancho, proc, generico, destino, resumo, casos];
