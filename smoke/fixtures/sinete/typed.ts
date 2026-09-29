// Tipos do guarda-chuva vistos por um consumidor com tsc nodenext (e por deno check): os mesmos dos pacotes de origem.
import type { SineteError as SineteErrorOrigem } from '@sinete/core';
// @ts-expect-error sem entrada raiz: quem quer tudo escolhe o que importa
import type * as Raiz from 'sinete';
import type { Clock, SineteError } from 'sinete/core';
import { fixedClock } from 'sinete/core';
import type { XmlDocument } from 'sinete/core/xml';
import { parseXml } from 'sinete/core/xml';
import type { Doc } from 'sinete/da';
import { damdfe } from 'sinete/da/mdfe';
import type { RateProvider } from 'sinete/ibs-cbs/aliquotas';
import { officialRates } from 'sinete/ibs-cbs/aliquotas';
import type { IbsCbsDataset } from 'sinete/ibs-cbs-dados';
import type { BuildNfeOptions } from 'sinete/nfe';
import type { IbsCbsDataset as IbsCbsDatasetViaNfe } from 'sinete/nfe/ibs-cbs';

const clock: Clock = fixedClock('2026-09-25T12:00:00Z');
const doc: XmlDocument = parseXml('<a/>');
const m: Doc = damdfe('<mdfeProc/>');
const rates: RateProvider = officialRates();
declare const ds: IbsCbsDataset;
const mesmo: IbsCbsDatasetViaNfe = ds;
declare const e: SineteError;
const origem: SineteErrorOrigem = e;
declare const o: BuildNfeOptions;
type R = typeof Raiz;
void [clock, doc, m, rates, mesmo, origem, o];
export type { R };
