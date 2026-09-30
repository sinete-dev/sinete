/**
 * `sinete doctor`: confere o que costuma dar errado antes de falar com a SEFAZ, sem nunca mostrar material de chave.
 *
 * 1. PFX: abre (inclusive o legado RC2-40 + 3DES), mostra titular, identidade ICP-Brasil e validade.
 * 2. Cadeia: sobe do titular até uma raiz ICP-Brasil do bundle, com as intermediárias do PFX e as de `--cadeia`.
 * 3. Relógio: a validade do certificado contra o relógio local e, com referência (`--status` ou `--relogio-url`), a
 *    diferença para o `Date` do servidor.
 * 4. TLS: só o handshake com o endpoint (sem requisição HTTP), com o certificado de cliente carregado. Nos hosts que
 *    pedem o certificado por renegociação, o handshake sozinho não prova a aceitação: é o que `--status` faz.
 * 5. Status (só com `--status`): consulta de status do serviço (NF-e ou MDF-e), a única requisição que o doctor envia.
 */

import { isIP } from 'node:net';
import tls from 'node:tls';
import type { CertificadoA1, ResultadoCadeia } from '@sinete/cert';
import { abrirPfx, dersDoPem, ErroCertificado, lerCertificado, montarCadeia, pemTlsIcpBrasil } from '@sinete/cert';
import type { Ambiente, Relogio, Uf } from '@sinete/core';
import { ehErroSinete, relogioDoSistema, tpAmbDoAmbiente, ufPorSigla } from '@sinete/core';
import type { EndpointResolvido, Transporte } from '@sinete/transport';
import {
  classificarFalhaDeTransporte,
  contentTypeSoap12,
  criarTransporte,
  detectarRuntime,
  envelopeSoap12,
  identidadePem,
  lerBodySoap,
  mdfeEndpoint,
  nfeEndpoint,
  nfseEndpoint,
  perfilTlsDoHost,
} from '@sinete/transport';

export type SituacaoDaVerificacao = 'ok' | 'aviso' | 'falha' | 'pulado';

export interface VerificacaoDoDoctor {
  readonly id: 'pfx' | 'cadeia' | 'relogio' | 'tls' | 'status';
  readonly situacao: SituacaoDaVerificacao;
  readonly mensagem: string;
  readonly detalhes?: Readonly<Record<string, unknown>>;
}

export interface RelatorioDoDoctor {
  readonly ok: boolean;
  readonly verificacoes: readonly VerificacaoDoDoctor[];
}

export interface DoctorOpcoes {
  /** Bytes do PFX (A1). */
  readonly pfx: Uint8Array;
  readonly senha: string;
  /** Intermediárias extras em PEM (a cadeia da AC, quando o PFX só traz a folha). */
  readonly cadeiaAdicionalPem?: string;
  /** PEM de AC somado ao conjunto de confiança do TLS (proxy corporativo, servidor de teste). */
  readonly acsAdicionaisPem?: string;
  readonly aceitarVencido?: boolean;
  /** Endpoint alvo. Sem ele, só PFX, cadeia e relógio local. */
  readonly endpoint?: EndpointResolvido | { readonly url: string };
  /** Documento e UF para montar a consulta de status. */
  readonly documento?: 'nfe' | 'mdfe' | 'nfse';
  readonly uf?: Uf;
  readonly ambiente?: Ambiente;
  /** Envia a consulta de status. Padrão: só o handshake. */
  readonly consultarStatus?: boolean;
  /** URL HTTPS cujo `Date` serve de referência para o relógio. */
  readonly urlDoRelogio?: string;
  readonly timeoutMs?: number;
  readonly relogio?: Relogio;
}

/** Máscara de CPF para a saída (o doctor costuma ir parar em issue e chat). */
export function mascararCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** Mascara todo CPF (11 dígitos soltos) num texto de saída: CN de e-CPF, DN com serialNumber. */
export function mascararCpfs(texto: string): string {
  return texto.replace(/(?<![0-9A-Za-z])\d{11}(?![0-9])/g, (cpf) => mascararCpf(cpf));
}

export function formatarCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `Date` HTTP (IMF-fixdate, RFC 9110) em ms desde a época, sem o global `Date`. */
export function lerDataHttp(valor: string | undefined): number | undefined {
  const m = valor ? /^\w{3}, (\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(valor.trim()) : null;
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2] ?? '') + 1;
  if (month === 0) return undefined;
  const y = Number(m[3]);
  const d = Number(m[1]);
  const yy = month <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const days = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  return ((days * 24 + Number(m[4])) * 60 + Number(m[5])) * 60_000 + Number(m[6]) * 1000;
}

const DAY = 86_400_000;
/** Diferença de relógio tolerada: a SEFAZ recusa `dhEmi` no futuro (rejeição 703); acima de 5 min é falha. */
const SKEW_WARN_MS = 60_000;
const SKEW_FAIL_MS = 300_000;

function clockCheck(skewMs: number, source: string): VerificacaoDoDoctor {
  const abs = Math.abs(skewMs);
  const secs = Math.round(skewMs / 1000);
  const where = secs > 0 ? 'adiantado' : 'atrasado';
  const status: SituacaoDaVerificacao = abs > SKEW_FAIL_MS ? 'falha' : abs > SKEW_WARN_MS ? 'aviso' : 'ok';
  const message =
    status === 'ok'
      ? `relógio local a ${Math.abs(secs)} s de ${source}`
      : `relógio local ${where} ${Math.abs(secs)} s em relação a ${source}; a SEFAZ recusa emissão no futuro (703) e o TLS pode falhar`;
  return { id: 'relogio', situacao: status, mensagem: message, detalhes: { desvioSegundos: secs, fonte: source } };
}

/**
 * Com `allowLeafExpiry` (o `--aceitar-vencido`), a validade do titular já foi tratada na verificação `pfx` e não conta
 * de novo aqui; emissor vencido continua sendo falha.
 */
export function chainMessage(r: ResultadoCadeia, allowLeafExpiry: boolean): VerificacaoDoDoctor {
  const name = (c: ResultadoCadeia['cadeia'][number]): string => mascararCpfs(c.subject.commonName ?? c.subject.texto);
  const names = r.cadeia.map(name);
  const leaf = r.cadeia[0];
  const expiredLinks = allowLeafExpiry ? r.vencidos.filter((c) => c !== leaf) : r.vencidos;
  const details = { cadeia: names, situacao: r.situacao, vencidos: r.vencidos.map(name) };
  const base = chainStatusCheck(r, names, details);
  if (expiredLinks.length === 0) return base;
  // Emissor vencido é falha qualquer que seja o status do caminho (mesmo incompleto ou com raiz desconhecida).
  const vencidos = `elos vencidos: ${expiredLinks.map(name).join(', ')}`;
  return { ...base, situacao: 'falha', mensagem: base.situacao === 'ok' ? vencidos : `${vencidos}; ${base.mensagem}` };
}

function chainStatusCheck(
  r: ResultadoCadeia,
  names: readonly string[],
  details: NonNullable<VerificacaoDoDoctor['detalhes']>,
): VerificacaoDoDoctor {
  switch (r.situacao) {
    case 'confiavel':
      return {
        id: 'cadeia',
        situacao: 'ok',
        mensagem: `até ${r.ancora?.subject.commonName} (${names.length} elos)`,
        detalhes: details,
      };
    case 'incompleta':
      return {
        id: 'cadeia',
        situacao: 'aviso',
        mensagem: `falta o emissor "${mascararCpfs(r.emissorAusente ?? '')}" (o PFX só traz a folha?); passe as intermediárias da AC com --cadeia para conferir, e saiba que ainda não se sabe se todo servidor aceita só a folha (ADR 0004)`,
        detalhes: details,
      };
    case 'raiz_desconhecida':
      return {
        id: 'cadeia',
        situacao: 'aviso',
        mensagem: `a raiz "${names.at(-1)}" não é ICP-Brasil v5, v10, v11 ou v12`,
        detalhes: details,
      };
    case 'emissor_nao_autorizado':
      return {
        id: 'cadeia',
        situacao: 'falha',
        mensagem: 'um emissor da cadeia não pode emitir certificados (não é AC, sem keyCertSign ou além do pathLen)',
        detalhes: details,
      };
    case 'extensao_critica_nao_suportada':
      return {
        id: 'cadeia',
        situacao: 'falha',
        mensagem: `um elo tem extensão crítica que o sinete não processa (${r.cadeia.at(-1)?.extensoesCriticasNaoSuportadas.join(', ')})`,
        detalhes: details,
      };
    case 'assinatura_invalida':
      return {
        id: 'cadeia',
        situacao: 'falha',
        mensagem: 'um elo da cadeia tem assinatura que não confere',
        detalhes: details,
      };
  }
}

async function abrirCertificado(
  options: DoctorOpcoes,
  clock: Relogio,
): Promise<[CertificadoA1 | undefined, VerificacaoDoDoctor]> {
  try {
    const ks = await abrirPfx(options.pfx, { senha: options.senha, relogio: clock, aceitarVencido: true });
    const c = ks.certificado;
    const id = ks.identidade;
    const now = clock.agora().getTime();
    const daysLeft = Math.floor((c.notAfter - now) / DAY);
    const who =
      id.tipo === 'e-CNPJ' && id.cnpj
        ? `e-CNPJ ${formatarCnpj(id.cnpj)}${id.pessoa ? `, responsável CPF ${mascararCpf(id.pessoa.cpf)}` : ''}`
        : id.tipo === 'e-CPF' && id.cpf
          ? `e-CPF ${mascararCpf(id.cpf)}`
          : 'sem CNPJ/CPF ICP-Brasil';
    const details = {
      titular: id.nome === undefined ? undefined : mascararCpfs(id.nome),
      tipo: id.tipo,
      emissor: c.issuer.commonName,
      serial: c.serialNumber,
      notBefore: c.notBeforeIso,
      notAfter: c.notAfterIso,
      diasRestantes: daysLeft,
      certificadosNoPfx: 1 + ks.certificadosExtras.length,
    };
    const base = `${mascararCpfs(id.nome ?? c.subject.texto)} (${who}), emitido por ${c.issuer.commonName}`;
    if (ks.validade === 'expirado') {
      const status: SituacaoDaVerificacao = options.aceitarVencido ? 'aviso' : 'falha';
      return [ks, { id: 'pfx', situacao: status, mensagem: `${base}: VENCIDO em ${c.notAfterIso}`, detalhes: details }];
    }
    if (ks.validade === 'ainda_nao_valido') {
      return [
        ks,
        {
          id: 'pfx',
          situacao: options.aceitarVencido ? 'aviso' : 'falha',
          mensagem: `${base}: só vale a partir de ${c.notBeforeIso} (relógio atrasado?)`,
          detalhes: details,
        },
      ];
    }
    const status: SituacaoDaVerificacao = daysLeft < 30 ? 'aviso' : 'ok';
    return [
      ks,
      {
        id: 'pfx',
        situacao: status,
        mensagem: `${base}, válido até ${c.notAfterIso} (${daysLeft} dias)`,
        detalhes: details,
      },
    ];
  } catch (e) {
    const code = ehErroSinete(e) ? e.code : 'desconhecido';
    const message = e instanceof ErroCertificado ? e.message : 'não foi possível abrir o PFX';
    return [undefined, { id: 'pfx', situacao: 'falha', mensagem: message, detalhes: { code } }];
  }
}

export function resolveEndpoint(options: DoctorOpcoes): EndpointResolvido | { readonly url: string } | undefined {
  if (options.endpoint) return options.endpoint;
  const ambiente = options.ambiente ?? 'homologacao';
  if (options.documento === 'mdfe') return mdfeEndpoint({ ambiente, servico: 'MDFeStatusServico' });
  if (options.documento === 'nfse') return nfseEndpoint({ ambiente, api: 'adn' });
  if (options.uf) return nfeEndpoint({ ambiente, uf: options.uf, servico: 'NfeStatusServico' });
  return undefined;
}

function handshake(
  url: URL,
  identity: { readonly cadeia: string; readonly chave: string },
  extraCa: readonly string[],
  timeoutMs: number,
): Promise<{
  protocol: string | null;
  cipher: string;
  authorized: boolean;
  authorizationError: string | undefined;
  server: string;
  serverNotAfter: string;
  localLoaded: boolean;
}> {
  const { cadeia, chave } = identity;
  const leaf = dersDoPem(cadeia)[0];
  // URL.hostname traz IPv6 entre colchetes; o socket quer o endereço puro, e IP (v4 ou v6) não vai no SNI.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: url.port === '' ? 443 : Number(url.port),
      servername: isIP(host) === 0 ? host : undefined,
      cert: cadeia,
      key: chave,
      ca: [...tls.rootCertificates, ...pemTlsIcpBrasil(), ...extraCa],
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      ALPNProtocols: ['http/1.1'],
    });
    // Prazo total, não de inatividade: um servidor lento a cada passo não segura o doctor.
    const timer = setTimeout(() => socket.destroy(new Error(`sem handshake em ${timeoutMs} ms`)), timeoutMs);
    socket.once('close', () => clearTimeout(timer));
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const peer = socket.getPeerCertificate();
      const local = socket.getCertificate() as { raw?: Uint8Array } | null;
      const raw = local?.raw ? new Uint8Array(local.raw) : undefined;
      resolve({
        protocol: socket.getProtocol(),
        cipher: socket.getCipher().name,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
        server: [peer?.subject?.CN ?? '?'].flat().join(', '),
        serverNotAfter: peer?.valid_to ?? '?',
        localLoaded: Boolean(raw && leaf && raw.length === leaf.length && raw.every((b, i) => b === leaf[i])),
      });
      socket.end();
    });
    socket.once('error', reject);
  });
}

function statusMessage(options: DoctorOpcoes): { body: string; action: string } | undefined {
  const ambiente = options.ambiente ?? 'homologacao';
  const tpAmb = tpAmbDoAmbiente(ambiente);
  if (options.documento === 'mdfe') {
    const ns = 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico';
    return {
      action: `${ns}/mdfeStatusServicoMDF`,
      body: `<mdfeDadosMsg xmlns="${ns}"><consStatServMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe"><tpAmb>${tpAmb}</tpAmb><xServ>STATUS</xServ></consStatServMDFe></mdfeDadosMsg>`,
    };
  }
  if (options.documento === 'nfse' || !options.uf) return undefined;
  const cUF = ufPorSigla(options.uf)?.cUF;
  const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
  return {
    action: `${ns}/nfeStatusServicoNF`,
    body: `<nfeDadosMsg xmlns="${ns}"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg>`,
  };
}

const pick = (xml: string, tag: string): string | undefined =>
  new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`).exec(xml)?.[1];

export async function rodarDoctor(opcoes: DoctorOpcoes): Promise<RelatorioDoDoctor> {
  const clock = opcoes.relogio ?? relogioDoSistema;
  const timeoutMs = opcoes.timeoutMs ?? 30_000;
  const checks: VerificacaoDoDoctor[] = [];
  const [ks, pfxCheck] = await abrirCertificado(opcoes, clock);
  checks.push(pfxCheck);
  const skipped = (id: VerificacaoDoDoctor['id'], message: string): VerificacaoDoDoctor => ({
    id,
    situacao: 'pulado',
    mensagem: message,
  });
  if (!ks) {
    for (const id of ['cadeia', 'relogio', 'tls', 'status'] as const) checks.push(skipped(id, 'sem PFX aberto'));
    return { ok: false, verificacoes: checks };
  }

  const extraChain = opcoes.cadeiaAdicionalPem
    ? dersDoPem(opcoes.cadeiaAdicionalPem).map((d) => lerCertificado(d))
    : [];
  const chainResult = await montarCadeia(ks.certificado, {
    intermediarias: [...ks.certificadosExtras, ...extraChain],
    relogio: clock,
  });
  // O TLS manda a cadeia que o doctor conseguiu montar (inclusive a de --cadeia), sem a raiz.
  const identity = identidadePem(ks, { cadeia: chainResult.cadeia });
  checks.push(chainMessage(chainResult, opcoes.aceitarVencido === true));

  let clockDone = false;
  if (opcoes.urlDoRelogio) {
    try {
      const res = await fetch(opcoes.urlDoRelogio, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) });
      const server = lerDataHttp(res.headers.get('date') ?? undefined);
      if (server === undefined)
        checks.push({ id: 'relogio', situacao: 'aviso', mensagem: `${opcoes.urlDoRelogio} não mandou Date` });
      else checks.push(clockCheck(clock.agora().getTime() - server, new URL(opcoes.urlDoRelogio).host));
    } catch (e) {
      checks.push({
        id: 'relogio',
        situacao: 'aviso',
        mensagem: `sem resposta de ${opcoes.urlDoRelogio}: ${(e as Error).message}`,
      });
    }
    clockDone = true;
  }

  const endpoint = resolveEndpoint(opcoes);
  const extraCa = opcoes.acsAdicionaisPem ? [opcoes.acsAdicionaisPem] : [];
  if (!endpoint) {
    checks.push(skipped('tls', 'sem endpoint: passe --endpoint, --uf ou --documento'));
    checks.push(skipped('status', 'sem endpoint'));
  } else {
    const url = new URL(endpoint.url);
    const profile = 'tls' in endpoint ? endpoint.tls : perfilTlsDoHost(url.hostname);
    try {
      const h = await handshake(url, identity, extraCa, timeoutMs);
      const reneg = profile?.certificadoDoCliente === 'renegociacao';
      const note = reneg
        ? '; este host só pede o certificado numa renegociação depois da requisição, então o handshake não prova a aceitação (use --status)'
        : '';
      checks.push({
        id: 'tls',
        situacao: h.localLoaded ? 'ok' : 'falha',
        mensagem: `${url.host}: ${h.protocol} ${h.cipher}, servidor ${h.server} (até ${h.serverNotAfter}), certificado de cliente ${h.localLoaded ? 'carregado' : 'NÃO carregado'}${note}`,
        detalhes: {
          host: url.hostname,
          protocolo: h.protocol,
          cifra: h.cipher,
          certificadoDoCliente: profile?.certificadoDoCliente,
          runtime: detectarRuntime(),
        },
      });
    } catch (e) {
      const err = classificarFalhaDeTransporte(e, { host: url.hostname });
      checks.push({ id: 'tls', situacao: 'falha', mensagem: err.message, detalhes: { code: err.code } });
    }

    const msg = statusMessage(opcoes);
    if (!opcoes.consultarStatus)
      checks.push(skipped('status', 'só handshake (use --status para consultar o status do serviço)'));
    else if (!msg) checks.push(skipped('status', 'status só para NF-e (com --uf) e MDF-e'));
    else {
      let transport: Transporte | undefined;
      try {
        transport = criarTransporte({ identidade: identity, acsAdicionais: extraCa, timeoutMs });
        const res = await transport.enviar({
          url: endpoint.url,
          ...('tls' in endpoint ? { endpoint } : {}),
          cabecalhos: { 'content-type': contentTypeSoap12(msg.action) },
          corpo: envelopeSoap12(msg.body),
        });
        const text = res.texto();
        const body = res.status === 200 ? lerBodySoap(text) : text;
        const cStat = pick(body, 'cStat');
        const xMotivo = pick(body, 'xMotivo');
        checks.push({
          id: 'status',
          situacao: cStat === '107' ? 'ok' : 'aviso',
          mensagem: cStat ? `cStat ${cStat}: ${xMotivo ?? ''}` : `HTTP ${res.status} sem cStat`,
          detalhes: { statusHttp: res.status, cStat, xMotivo },
        });
        const server = lerDataHttp(res.cabecalhos.date);
        if (!clockDone && server !== undefined) {
          checks.push(clockCheck(clock.agora().getTime() - server, url.host));
          clockDone = true;
        }
      } catch (e) {
        const code = ehErroSinete(e) ? e.code : 'desconhecido';
        checks.push({ id: 'status', situacao: 'falha', mensagem: (e as Error).message, detalhes: { code } });
      } finally {
        await transport?.fechar();
      }
    }
  }

  if (!clockDone) {
    checks.push({
      id: 'relogio',
      situacao: ks.validade === 'ainda_nao_valido' ? 'aviso' : 'pulado',
      mensagem:
        ks.validade === 'ainda_nao_valido'
          ? 'o certificado ainda não vale pelo relógio local: relógio atrasado?'
          : 'sem referência externa (use --status ou --relogio-url)',
    });
  }
  const order = ['pfx', 'cadeia', 'relogio', 'tls', 'status'];
  checks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { ok: checks.every((c) => c.situacao !== 'falha'), verificacoes: checks };
}
