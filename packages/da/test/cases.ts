// Casos do teste de regressão visual: cada fixture sintética com o formato e as opções que ela exercita.
import { dacce } from '../src/cce.ts';
import { damdfe } from '../src/mdfe.ts';
import type { Documento } from '../src/model.ts';
import { danfe } from '../src/nfe.ts';
import { danfse } from '../src/nfse.ts';
import { chaveDe, eventoXml, MDFE_FIXTURES, mdfeXml, NFE_FIXTURES, nfeXml } from './fixtures.ts';
import { chaveNfse, eventoNfseXml, NFSE_FIXTURES, nfseXml, PREST_CNPJ } from './fixtures-nfse.ts';
import { encodePng } from './helpers/png.ts';

/** Logotipo sintético: degradê com transparência. */
export const LOGO: Uint8Array = encodePng({
  width: 60,
  height: 40,
  colorType: 6,
  depth: 8,
  sample: (x, y, c) => (c === 3 ? (x < 4 || y < 4 ? 0 : 255) : c === 0 ? x * 4 : c === 1 ? y * 6 : 120),
});

export interface Case {
  readonly name: string;
  readonly doc: () => Documento;
}

const basica = NFE_FIXTURES[0];
const nfseCompleta = NFSE_FIXTURES[0];
const nfseAlfa = NFSE_FIXTURES[1];
const nfseLongos = NFSE_FIXTURES[3];
if (!basica || !nfseCompleta || !nfseAlfa || !nfseLongos) throw new Error('fixtures vazias');

/** Protocolo do EPEC sintético (MOC 7.0, Anexo II, 3.9.3). */
export const EPEC = { nProt: '891260000000001', dhRegEvento: '2026-09-01T10:30:00-03:00' } as const;

export const CASES: readonly Case[] = [
  ...NFE_FIXTURES.map((fx) => ({
    name: fx.name,
    doc: (): Documento => danfe(nfeXml(fx), fx.epec ? { epec: EPEC } : {}),
  })),
  ...MDFE_FIXTURES.map((fx) => ({ name: fx.name, doc: (): Documento => damdfe(mdfeXml(fx)) })),
  {
    name: 'dacce',
    doc: (): Documento => dacce(eventoXml({ tpEvento: '110110', chave: chaveDe('55') }), { nfe: nfeXml(basica) }),
  },
  {
    name: 'cancelada',
    doc: (): Documento =>
      danfe(nfeXml(basica), { cancelamento: eventoXml({ tpEvento: '110111', chave: chaveDe('55') }) }),
  },
  {
    // Cancelada pelo cStat do protocolo e pelo evento: o carimbo é o do evento (ADR 0006, decisão 15).
    name: 'cancelada-protocolo-evento',
    doc: (): Documento =>
      danfe(nfeXml({ ...basica, cStat: '101' }), {
        cancelamento: eventoXml({ tpEvento: '110111', chave: chaveDe('55') }),
      }),
  },
  { name: 'logo', doc: (): Documento => danfe(nfeXml(basica), { logo: LOGO }) },
  { name: 'etiqueta', doc: (): Documento => danfe(nfeXml(basica), { formato: 'etiqueta', largura: 58 }) },
  {
    name: 'previa-etiqueta',
    doc: (): Documento => danfe(nfeXml({ ...basica, semProt: true }), { formato: 'etiqueta', largura: 58 }),
  },
  // DANFSe v2 (NT 008/2026): os dois pacotes de esquemas, as marcas d'água e o quadro das informações sem canhoto.
  ...NFSE_FIXTURES.map((fx) => ({ name: fx.name, doc: (): Documento => danfse(nfseXml(fx)) })),
  {
    name: 'danfse-cancelada',
    doc: (): Documento =>
      danfse(nfseXml(nfseCompleta), { cancelamento: eventoNfseXml('e101101', chaveNfse(PREST_CNPJ)) }),
  },
  { name: 'danfse-substituida', doc: (): Documento => danfse(nfseXml(nfseAlfa), { substituicao: true }) },
  { name: 'danfse-sem-canhoto', doc: (): Documento => danfse(nfseXml(nfseLongos), { canhoto: false }) },
  {
    name: 'denegada-etiqueta',
    doc: (): Documento => danfe(nfeXml({ ...basica, cStat: '301' }), { formato: 'etiqueta', largura: 58 }),
  },
];
