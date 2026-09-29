/**
 * NFeInutilizacao4 (MOC 7.0 Visão Geral, item 5.3) e CadConsultaCadastro4 (item 5.6), este sobre o cadastro simulado
 * passado nas opções.
 */

import type { Uf } from '@sinete/core';
import { isUf, ufBySigla } from '@sinete/core';
import type { XmlElement } from '@sinete/core/xml';
import { attributeOf } from '@sinete/core/xml';
import { serializeRoot } from '@sinete/schemas';
import type { TRetConsCad, TRetConsCad_infCons_infCad } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import { ConsCadElement, retConsCadElement } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import type { TRetInutNFe } from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import { inutNFeElement, retInutNFeElement } from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import { parseCnpj, parseCpf, parseIe } from '@sinete/validators';
import { checkAssinatura } from '../certs.ts';
import type { RequestContext, Status } from '../context.ts';
import { dh, prelude, status, tipoAutorizador, verAplic } from '../context.ts';
import { motivo } from '../messages.ts';
import type { InutilizacaoFacts } from '../rules.ts';
import { firstRejection } from '../rules.ts';
import type { Contribuinte } from '../state.ts';
import { yearOf } from '../time.ts';
import { at, req, text } from '../xmlutil.ts';
import { viewOf } from './autorizacao.ts';

/** NFeInutilizacao4 (nfeInutilizacaoNF). */
export async function inutilizacao(ctx: RequestContext): Promise<string> {
  const pre = prelude(ctx, { roots: [inutNFeElement], lote: false });
  const inf = pre.doc === undefined ? undefined : at(pre.doc.root, 'infInut');
  const ret = (s: Status, homologada: Partial<TRetInutNFe['infInut']> = {}): string => {
    const value: TRetInutNFe = {
      versao: '4.00',
      infInut: {
        tpAmb: ctx.rt.config.tpAmb,
        verAplic: verAplic(ctx),
        cStat: s.cStat,
        xMotivo: s.xMotivo,
        cUF: ctx.rt.config.cUF as TRetInutNFe['infInut']['cUF'],
        ...homologada,
        dhRecbto: dh(ctx, ctx.now),
      },
    };
    return serializeRoot(retInutNFeElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  const infEl = inf as XmlElement;
  const facts: InutilizacaoFacts = {
    id: attributeOf(infEl, 'Id') ?? '',
    tpAmb: req(infEl, 'tpAmb'),
    cUF: req(infEl, 'cUF'),
    ano: req(infEl, 'ano'),
    CNPJ: req(infEl, 'CNPJ'),
    mod: req(infEl, 'mod'),
    serie: req(infEl, 'serie'),
    nNFIni: req(infEl, 'nNFIni'),
    nNFFin: req(infEl, 'nNFFin'),
  };
  const faixa = {
    ano: facts.ano,
    CNPJ: facts.CNPJ,
    mod: facts.mod as TRetInutNFe['infInut']['mod'] & string,
    serie: facts.serie,
    nNFIni: facts.nNFIni,
    nNFFin: facts.nNFFin,
  };
  const sig = await checkAssinatura({
    doc: pre.doc,
    id: facts.id,
    element: 'infInut',
    now: ctx.now,
    titular: { CNPJ: facts.CNPJ },
  });
  if (!sig.ok) return ret(status(sig.cStat));
  const r = firstRejection(ctx.rt.config.rules.inutilizacao, { inut: facts, view: viewOf(ctx.rt), now: ctx.now });
  if (r !== undefined) {
    // I07 (563): a resposta traz o protocolo da inutilização anterior da mesma faixa (NT 2015.002).
    const anterior = r.params?.nProt;
    return ret(
      { cStat: r.cStat, xMotivo: motivo(r.cStat, r.params) },
      anterior === undefined ? {} : { ...faixa, nProt: anterior },
    );
  }
  const nProt = ctx.rt.state.nextProtocolo(
    tipoAutorizador(ctx),
    facts.cUF,
    yearOf(ctx.now, ctx.rt.config.offsetMinutes),
  );
  ctx.rt.state.inutilizacoes.push({
    cUF: facts.cUF,
    ano: facts.ano,
    CNPJ: facts.CNPJ,
    mod: facts.mod,
    serie: Number(facts.serie),
    nNFIni: Number(facts.nNFIni),
    nNFFin: Number(facts.nNFFin),
    nProt,
    dhRecbto: dh(ctx, ctx.now),
    xml: ctx.payload,
  });
  return ret(status('102'), { Id: `ID${nProt}`, ...faixa, nProt });
}

function infCad(c: Contribuinte): TRetConsCad_infCons_infCad {
  return {
    IE: c.IE,
    ...(c.CNPJ !== undefined ? { CNPJ: c.CNPJ } : { CPF: c.CPF ?? '' }),
    UF: c.UF as TRetConsCad_infCons_infCad['UF'],
    cSit: c.situacao === 'nao-habilitado' ? '0' : '1',
    indCredNFe: c.situacao === 'nao-habilitado' ? '0' : '1',
    indCredCTe: '4',
    xNome: c.xNome,
  };
}

/** CadConsultaCadastro4 (consultaCadastro), MOC 7.0 Visão Geral, tabela 5-24. */
export function consultaCadastro(ctx: RequestContext): string {
  const pre = prelude(ctx, { roots: [ConsCadElement], lote: false });
  const inf = pre.doc === undefined ? undefined : at(pre.doc.root, 'infCons');
  const uf = text(inf, 'UF');
  const informado = (['IE', 'CNPJ', 'CPF'] as const).find((k) => text(inf, k) !== undefined) ?? 'CNPJ';
  // Só ecoa o documento pedido quando o pedido passou no schema: o retConsCad usa os mesmos tipos, e um valor fora do
  // padrão tornaria a própria rejeição inválida.
  const lido = text(inf, informado);
  const chave: readonly ['IE' | 'CNPJ' | 'CPF', string] =
    pre.ok && lido !== undefined ? [informado, lido] : ['CNPJ', '00000000000000'];
  const ret = (s: Status, cads: readonly Contribuinte[] = []): string => {
    const value = {
      versao: '2.00',
      infCons: {
        verAplic: verAplic(ctx),
        cStat: s.cStat,
        xMotivo: s.xMotivo,
        UF: (uf !== undefined && isUf(uf) ? uf : ctx.rt.config.uf) as Uf,
        [chave[0]]: chave[1],
        dhCons: dh(ctx, ctx.now),
        cUF: ctx.rt.config.cUF,
        ...(cads.length === 0 ? {} : { infCad: cads.map(infCad) }),
      },
    } as TRetConsCad;
    return serializeRoot(retConsCadElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  // 265: o autorizador responde pelo cadastro das UF que atende (a SVRS atende várias).
  const atendida = uf !== undefined && ctx.rt.config.cUFsAtendidas.includes(ufBySigla(uf)?.cUF ?? '');
  if (!atendida) return ret(status('265'));
  const [campo, valor] = chave;
  const valido =
    campo === 'CNPJ' ? parseCnpj(valor).ok : campo === 'CPF' ? parseCpf(valor).ok : parseIe(valor, uf as Uf).ok;
  if (!valido) return ret(status(campo === 'CNPJ' ? '258' : campo === 'CPF' ? '263' : '260'));
  const achados = ctx.rt.config.cadastro.filter((c) => c.UF === uf && c[campo] === valor);
  if (achados.length === 0) return ret(status(campo === 'CNPJ' ? '259' : campo === 'CPF' ? '264' : '261'));
  return ret(status(achados.length === 1 ? '111' : '112'), achados);
}
