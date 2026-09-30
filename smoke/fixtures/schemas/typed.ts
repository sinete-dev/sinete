// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Decodificado, OcorrenciaSchema, EntradaDeVigencia } from '@sinete/schemas';
import { decodificarXml, selecionarPl, serializar, validarRaiz } from '@sinete/schemas';
import type { TMDFe } from '@sinete/schemas/mdfe/3.00b';
import type { TEvento_infEvento_detEvento } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import type { TNFe, TNFe_infNFe, TNfeProc } from '@sinete/schemas/nfe/PL_010f';
import { nfeProcElement, TNFe_infNFe as InfNFeDesc } from '@sinete/schemas/nfe/PL_010f';
import type { TConsStatServ } from '@sinete/schemas/nfe/status-servico/PL_009q';
import { relogioFixo } from '@sinete/core';

declare const inf: TNFe_infNFe;
const xml: string = serializar(InfNFeDesc, 'infNFe', inf);
const d: Decodificado<TNfeProc> = decodificarXml(nfeProcElement, xml);
const nfe: TNFe = d.valor.NFe;
const issues: OcorrenciaSchema[] = validarRaiz(nfeProcElement, xml);
const v: EntradaDeVigencia = selecionarPl('nfe', 'homologacao', relogioFixo('2026-09-25T12:00:00-03:00'));
const cons: TConsStatServ = { versao: '4.00', tpAmb: '2', cUF: '35', xServ: 'STATUS' };
const det: TEvento_infEvento_detEvento = { versao: '1.00', descEvento: 'Cancelamento', nProt: '1', xJust: 'x' };
declare const mdfe: TMDFe;
// @ts-expect-error CNPJ e CPF juntos no emitente não compilam (choice exclusivo)
const emit: TNFe_infNFe['emit'] = { ...inf.emit, CNPJ: '00000000000000', CPF: '00000000000' };
// @ts-expect-error serviço fora da enumeração
const bad: TConsStatServ = { ...cons, xServ: 'OUTRO' };
void [nfe, issues, v, det, mdfe, emit, bad];
