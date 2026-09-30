/**
 * NFeInutilizacao4 (MOC 7.0 Visão Geral, item 5.3) e CadConsultaCadastro4 (item 5.6), este sobre o cadastro simulado
 * passado nas opções.
 */

import type { Uf } from '@sinete/core';
import { ehUf, ufPorSigla } from '@sinete/core';
import type { ElementoXml } from '@sinete/core/xml';
import { atributoDe } from '@sinete/core/xml';
import { serializarRaiz } from '@sinete/schemas';
import type { TRetConsCad, TRetConsCad_infCons_infCad } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import { ConsCadElement, retConsCadElement } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import type { TRetInutNFe } from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import { inutNFeElement, retInutNFeElement } from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import { lerCnpj, lerCpf, lerIe } from '@sinete/validators';
import { conferirAssinaturaDoDocumento } from '../certs.ts';
import type { ContextoDoPedido, Status } from '../context.ts';
import { dh, prelude, status, tipoAutorizador, verAplic } from '../context.ts';
import { motivo } from '../messages.ts';
import type { FatosInutilizacao } from '../rules.ts';
import { primeiraRejeicao } from '../rules.ts';
import type { Contribuinte } from '../state.ts';
import { yearOf } from '../time.ts';
import { at, req, text } from '../xmlutil.ts';
import { viewOf } from './autorizacao.ts';

/** NFeInutilizacao4 (nfeInutilizacaoNF). */
export async function inutilizacao(ctx: ContextoDoPedido): Promise<string> {
  const pre = prelude(ctx, { roots: [inutNFeElement], lote: false });
  const inf = pre.doc === undefined ? undefined : at(pre.doc.raiz, 'infInut');
  const ret = (s: Status, homologada: Partial<TRetInutNFe['infInut']> = {}): string => {
    const value: TRetInutNFe = {
      versao: '4.00',
      infInut: {
        tpAmb: ctx.rt.configuracao.tpAmb,
        verAplic: verAplic(ctx),
        cStat: s.cStat,
        xMotivo: s.xMotivo,
        cUF: ctx.rt.configuracao.cUF as TRetInutNFe['infInut']['cUF'],
        ...homologada,
        dhRecbto: dh(ctx, ctx.agora),
      },
    };
    return serializarRaiz(retInutNFeElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  const infEl = inf as ElementoXml;
  const facts: FatosInutilizacao = {
    id: atributoDe(infEl, 'Id') ?? '',
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
  const sig = await conferirAssinaturaDoDocumento({
    documento: pre.doc,
    id: facts.id,
    elemento: 'infInut',
    agora: ctx.agora,
    titular: { CNPJ: facts.CNPJ },
  });
  if (!sig.ok) return ret(status(sig.cStat));
  const r = primeiraRejeicao(ctx.rt.configuracao.regras.inutilizacao, {
    inut: facts,
    visao: viewOf(ctx.rt),
    agora: ctx.agora,
  });
  if (r !== undefined) {
    // I07 (563): a resposta traz o protocolo da inutilização anterior da mesma faixa (NT 2015.002).
    const anterior = r.parametros?.nProt;
    return ret(
      { cStat: r.cStat, xMotivo: motivo(r.cStat, r.parametros) },
      anterior === undefined ? {} : { ...faixa, nProt: anterior },
    );
  }
  const nProt = ctx.rt.estado.nextProtocolo(
    tipoAutorizador(ctx),
    facts.cUF,
    yearOf(ctx.agora, ctx.rt.configuracao.deslocamentoMin),
  );
  ctx.rt.estado.inutilizacoes.push({
    cUF: facts.cUF,
    ano: facts.ano,
    CNPJ: facts.CNPJ,
    mod: facts.mod,
    serie: Number(facts.serie),
    nNFIni: Number(facts.nNFIni),
    nNFFin: Number(facts.nNFFin),
    nProt,
    dhRecbto: dh(ctx, ctx.agora),
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
export function consultaCadastro(ctx: ContextoDoPedido): string {
  const pre = prelude(ctx, { roots: [ConsCadElement], lote: false });
  const inf = pre.doc === undefined ? undefined : at(pre.doc.raiz, 'infCons');
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
        UF: (uf !== undefined && ehUf(uf) ? uf : ctx.rt.configuracao.uf) as Uf,
        [chave[0]]: chave[1],
        dhCons: dh(ctx, ctx.agora),
        cUF: ctx.rt.configuracao.cUF,
        ...(cads.length === 0 ? {} : { infCad: cads.map(infCad) }),
      },
    } as TRetConsCad;
    return serializarRaiz(retConsCadElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  // 265: o autorizador responde pelo cadastro das UF que atende (a SVRS atende várias).
  const atendida = uf !== undefined && ctx.rt.configuracao.cUFsAtendidas.includes(ufPorSigla(uf)?.cUF ?? '');
  if (!atendida) return ret(status('265'));
  const [campo, valor] = chave;
  const valido = campo === 'CNPJ' ? lerCnpj(valor).ok : campo === 'CPF' ? lerCpf(valor).ok : lerIe(valor, uf as Uf).ok;
  if (!valido) return ret(status(campo === 'CNPJ' ? '258' : campo === 'CPF' ? '263' : '260'));
  const achados = ctx.rt.configuracao.cadastro.filter((c) => c.UF === uf && c[campo] === valor);
  if (achados.length === 0) return ret(status(campo === 'CNPJ' ? '259' : campo === 'CPF' ? '264' : '261'));
  return ret(status(achados.length === 1 ? '111' : '112'), achados);
}
