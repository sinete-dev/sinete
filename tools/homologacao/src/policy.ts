/**
 * Guarda dura da validação em homologação: a `PoliticaDeHosts` do `@sinete/transport` com uma allowlist fechada, escrita à
 * mão, dos hosts de NF-e e MDF-e de homologação, mais `tpAmb` 2 em todo corpo que o declare. Roda antes de qualquer
 * socket, em todo envio do transporte. Nada de produção, nada de NFC-e, nada de NFS-e.
 *
 * A lista não é derivada dos dados de propósito: se um dia `endpoints.json` trouxer um host errado, a guarda não o
 * herda. O teste confere que cada host daqui existe nos dados de homologação e que nenhum de produção passa.
 */

import type { PedidoParaPolitica, PoliticaDeHosts } from '@sinete/transport';
import { ErroPolitica, politicaDeHostsPermitidos, todasAsPoliticas, todosOsEndpoints } from '@sinete/transport';

/** Hosts aceitos, com o papel de cada um. Conferidos contra `endpoints.json` de 25/09/2026. */
export const HOSTS_HOMOLOGACAO: ReadonlyMap<string, string> = new Map([
  // NF-e homologação: autorizadores próprios
  ['homnfe.sefaz.am.gov.br', 'NF-e AM'],
  ['hnfe.sefaz.ba.gov.br', 'NF-e BA'],
  ['homolog.sefaz.go.gov.br', 'NF-e GO'],
  ['hnfe.fazenda.mg.gov.br', 'NF-e MG'],
  ['hom.nfe.sefaz.ms.gov.br', 'NF-e MS'],
  ['homologacao.sefaz.mt.gov.br', 'NF-e MT'],
  ['nfehomolog.sefaz.pe.gov.br', 'NF-e PE'],
  ['homologacao.nfe.sefa.pr.gov.br', 'NF-e PR'],
  ['nfe-homologacao.sefazrs.rs.gov.br', 'NF-e RS'],
  ['homologacao.nfe.fazenda.sp.gov.br', 'NF-e SP'],
  // NF-e homologação: virtuais, contingência, cadastro da SVRS e Ambiente Nacional
  ['hom.sefazvirtual.fazenda.gov.br', 'NF-e SVAN e SVC-AN'],
  ['nfe-homologacao.svrs.rs.gov.br', 'NF-e SVRS e SVC-RS'],
  ['cad-homologacao.svrs.rs.gov.br', 'NF-e cadastro SVRS'],
  ['hom1.nfe.fazenda.gov.br', 'NF-e Ambiente Nacional'],
  // MDF-e homologação
  ['mdfe-homologacao.svrs.rs.gov.br', 'MDF-e SVRS'],
]);

/** Só os hosts acima, só a porta 443 e todo `tpAmb` do corpo igual a 2. */
export function homologacaoPolicy(): PoliticaDeHosts {
  return politicaDeHostsPermitidos({ hosts: HOSTS_HOMOLOGACAO.keys(), tpAmb: '2' });
}

/**
 * Guarda da rodada com emitente do DF (produtor rural com IE, 26/set/2026): só a SVRS de NF-e (autorizadora do DF),
 * o SVC-AN (contingência do DF) e o Ambiente Nacional (Distribuição DF-e e eventos do AN), escritos à mão. O DF não
 * tem consulta cadastro em nenhum autorizador, então o host de cadastro da SVRS fica de fora.
 */
export const HOSTS_HOMOLOGACAO_DF: ReadonlyMap<string, string> = new Map([
  ['nfe-homologacao.svrs.rs.gov.br', 'NF-e SVRS (autorizadora do DF)'],
  ['hom.sefazvirtual.fazenda.gov.br', 'NF-e SVC-AN (contingência do DF)'],
  ['hom1.nfe.fazenda.gov.br', 'NF-e Ambiente Nacional (Distribuição DF-e)'],
]);

/** Serviços que a rodada do DF usa. Inutilização e consulta cadastro ficam fora. */
export const SERVICOS_DF: ReadonlySet<string> = new Set([
  'NfeStatusServico',
  'NFeAutorizacao',
  'NFeRetAutorizacao',
  'NfeConsultaProtocolo',
  'RecepcaoEvento',
  'NFeDistribuicaoDFe',
]);

/** Eventos aceitos: carta de correção (110110) e cancelamento (110111). */
export const EVENTOS_DF: ReadonlySet<string> = new Set(['110110', '110111']);

const TPEVENTO = /<(?:[\w.-]+:)?tpEvento(?:\s[^>]*?)?(?:\/>|>([^<]*)<)/g;

/**
 * Recusa, antes do socket, URL que não seja de um serviço permitido nos hosts da rodada (pelas URLs dos dados de
 * homologação do transporte) e evento fora de `EVENTOS_DF`.
 */
function servicosDfPolicy(): PoliticaDeHosts {
  const urls = new Set(
    todosOsEndpoints('homologacao')
      .filter((e) => e.documento === 'nfe' && HOSTS_HOMOLOGACAO_DF.has(e.host) && SERVICOS_DF.has(e.servico))
      .map((e) => new URL(e.url).href.toLowerCase()),
  );
  return {
    conferir(req: PedidoParaPolitica): void {
      const u = new URL(req.url.href);
      u.search = '';
      u.hash = '';
      if (!urls.has(u.href.toLowerCase())) throw new ErroPolitica(`serviço fora da rodada: ${u.pathname}`, {});
      const body =
        req.corpo === undefined ? '' : typeof req.corpo === 'string' ? req.corpo : new TextDecoder().decode(req.corpo);
      const semComentario = body.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
      for (const m of semComentario.matchAll(TPEVENTO)) {
        const t = (m[1] ?? '').trim();
        if (!EVENTOS_DF.has(t)) throw new ErroPolitica(`evento fora da rodada: ${t || 'vazio'}`, {});
      }
    },
  };
}

/** Hosts do DF, porta 443, `tpAmb` 2 obrigatório em todo POST, só os serviços e eventos da rodada. */
export function homologacaoDfPolicy(): PoliticaDeHosts {
  return todasAsPoliticas(
    politicaDeHostsPermitidos({ hosts: HOSTS_HOMOLOGACAO_DF.keys(), tpAmb: '2', exigirTpAmbNoCorpo: true }),
    servicosDfPolicy(),
  );
}
