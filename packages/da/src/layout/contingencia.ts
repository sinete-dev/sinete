/**
 * Código de barras adicional "Dados da NF-e" da contingência em formulário de segurança (FS-IA e FS-DA), com 36
 * dígitos: cUF, tpEmis, CNPJ/CPF do destinatário, vNF, destaque de ICMS próprio, destaque de ICMS ST, dia da emissão
 * e dígito verificador (MOC 7.0, Anexo II, 3.9.2).
 */

import { ufBySigla } from '@sinete/core';
import { positivo } from '../format.ts';
import type { NotaView } from '../input/nfe.ts';

/**
 * Dígito verificador módulo 11 com pesos de 2 a 9 da direita para a esquerda, como o da chave de acesso. Cada
 * caractere vale o código ASCII menos 48 (NT 2025.001, seção 4): dígitos valem o mesmo de sempre, A vale 17.
 */
export function dvModulo11(digits: string): string {
  let sum = 0;
  let w = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += (digits.charCodeAt(i) - 48) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return String(r < 2 ? 0 : 11 - r);
}

export function dadosNfe(nota: NotaView): string {
  const d = nota.dest;
  const exterior = d?.tipoDoc === 'idEstrangeiro' || d?.ender?.UF === 'EX';
  // UF do destinatário; sem destinatário, a UF do emitente que está na chave.
  const cUF = exterior
    ? '99'
    : d?.ender?.UF
      ? (ufBySigla(d.ender.UF)?.cUF ?? nota.chave.slice(0, 2))
      : nota.chave.slice(0, 2);
  // CNPJ alfanumérico mantém as letras: o MOC fixa 14 posições e a NT 2025.001 não trata do FS-DA; o código de barras
  // sai no híbrido C/A e o DV segue a regra ASCII - 48, como na chave.
  const doc = exterior || !d ? '' : d.doc.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const [i = '0', dec = ''] = (nota.tot.vNF ?? '0').split('.');
  const vNF = `${i}${dec.padEnd(2, '0').slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const dia = nota.dhEmi.slice(8, 10);
  const body = [
    cUF.padStart(2, '0'),
    nota.tpEmis,
    doc.padStart(14, '0'),
    vNF.padStart(14, '0'),
    positivo(nota.tot.vICMS) ? '1' : '2',
    positivo(nota.tot.vST) ? '1' : '2',
    dia,
  ].join('');
  return body + dvModulo11(body);
}
