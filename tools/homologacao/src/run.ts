/**
 * Validação dos pacotes publicados contra a SEFAZ de homologação, com o certificado real do operador.
 *
 * Importa os pacotes pelo nome (`@sinete/nfe`, `@sinete/cert`, `@sinete/transport`, `@sinete/cli`), que resolvem para o
 * `dist` do build: é a forma publicada, não o fonte. Todo envio passa pela `homologacaoPolicy` (allowlist fechada de
 * hosts de NF-e e MDF-e de homologação, `tpAmb` 2) antes de abrir socket, e cada uso do certificado vai para o ledger.
 *
 * Comandos (um por vez; nada roda em laço):
 *   status        statusServico em cada autorizador de NF-e de homologação e nos dois SVC
 *   consultas     consultarCadastro do próprio CNPJ na UF do emitente e uma distribuicaoDFe (distNSU 0) no AN
 *   autorizacao   monta, assina e valida uma NF-e de teste; com --enviar, manda uma vez (no máximo 2 no total)
 *   doctor        `sinete doctor` com o certificado em memória e um handshake TLS (sem requisição)
 *
 * Veja o README ao lado para o passo a passo do operador.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { main as cli } from '@sinete/cli';
import type { ResultadoSefaz, Uf } from '@sinete/core';
import { contextoDeTempo, ehErroSinete, ehUf, relogioDoSistema, UFS } from '@sinete/core';
import { conferirAssinatura } from '@sinete/core/xml';
import type { NfeClient, NfeInput } from '@sinete/nfe';
import { buildNfe, createNfeClient, signNfe } from '@sinete/nfe';
import type { EventoDeAuditoria, PedidoTransporte, RespostaTransporte, Transporte } from '@sinete/transport';
import {
  criarTransporte,
  detectarRuntime,
  identidadePem,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
} from '@sinete/transport';
import type { Certificado } from './certificado.ts';
import { abrirCertificado } from './certificado.ts';
import { LEDGER_PADRAO, ledger } from './ledger.ts';
import { HOSTS_HOMOLOGACAO, homologacaoPolicy } from './policy.ts';

const USO = `uso: <node|bun|deno run -A> tools/homologacao/src/run.ts <comando> [opções]

comandos: status | consultas | autorizacao | doctor

certificado (um dos dois):
  --op <op://cofre/item>     campos pfx_base64 e senha do item, lidos pela CLI do 1Password
  --op-bin <bin>             executável da CLI (padrão op)
  --pfx <arquivo>            PFX do disco; senha na variável de --senha-env (padrão SINETE_PFX_SENHA)
  --cadeia <arquivo.pem>     intermediárias da AC, quando o PFX só traz a folha

opções:
  --uf <UF>                  UF do emitente (consultas, autorizacao, doctor); padrão SP
  --emitente <arquivo.json>  autorizacao: { xNome, CRT, endereco: { xLgr, nro, xBairro, cMun, xMun, UF, CEP } }
  --serie <n> --nnf <n>      autorizacao: série e número da NF-e de teste
  --enviar                   autorizacao: envia (sem ele, só monta, assina e valida)
  --estado <dir>             resultados (padrão ~/.local/state/sinete/homologacao)
  --ledger <arquivo>         registro de uso (padrão ~/.local/state/sinete/cert-usage.log)
`;

const MAX_AUTORIZACOES = 2;
const AMBIENTE = 'homologacao' as const;

const { values: opt, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    op: { type: 'string' },
    'op-bin': { type: 'string' },
    pfx: { type: 'string' },
    'senha-env': { type: 'string' },
    cadeia: { type: 'string' },
    uf: { type: 'string', default: 'SP' },
    emitente: { type: 'string' },
    serie: { type: 'string', default: '1' },
    nnf: { type: 'string' },
    enviar: { type: 'boolean', default: false },
    estado: { type: 'string', default: join(homedir(), '.local/state/sinete/homologacao') },
    ledger: { type: 'string', default: LEDGER_PADRAO },
    help: { type: 'boolean', short: 'h' },
  },
});

const comando = positionals[0];
if (opt.help || !comando || !['status', 'consultas', 'autorizacao', 'doctor'].includes(comando)) {
  console.log(USO);
  process.exit(opt.help ? 0 : 2);
}
const uf = (opt.uf ?? 'SP').toUpperCase();
if (!ehUf(uf)) throw new Error(`UF inválida: ${opt.uf}`);
const runtime = detectarRuntime();
const estado = opt.estado as string;
mkdirSync(estado, { recursive: true });
const led = ledger(opt.ledger);

const cert: Certificado = await abrirCertificado({
  ...(opt.op === undefined ? {} : { op: opt.op }),
  ...(opt['op-bin'] === undefined ? {} : { opBin: opt['op-bin'] }),
  ...(opt.pfx === undefined ? {} : { pfx: opt.pfx }),
  ...(opt['senha-env'] === undefined ? {} : { senhaEnv: opt['senha-env'] }),
  ...(opt.cadeia === undefined ? {} : { cadeia: opt.cadeia }),
});
const titular = cert.ks.identidade;
if (titular.tipo !== 'e-CNPJ' || !titular.cnpj) throw new Error('esta validação usa um e-CNPJ');
const CNPJ = titular.cnpj;
console.log(
  `[${runtime}] certificado ${titular.nome ?? '?'} (CNPJ ${CNPJ}), serial ${cert.ks.certificado.serialNumber}, válido até ${cert.ks.certificado.notAfterIso}; cadeia ${cert.cadeia.situacao}: ${cert.cadeia.cadeia.map((c) => c.subject.commonName ?? '?').join(' > ')}`,
);

const signer = await cert.ks.assinador();

// ---------------------------------------------------------------------------------------------------------------
// Transporte com a guarda, auditoria e a última resposta guardada em memória
// ---------------------------------------------------------------------------------------------------------------

/** Último evento de auditoria e última resposta do envio em curso (reiniciados por operação). */
const envio: {
  audit?: EventoDeAuditoria | undefined;
  resposta?: { texto: string; tls: RespostaTransporte['tls']; status: number } | undefined;
} = {};

function limparEnvio(): void {
  envio.audit = undefined;
  envio.resposta = undefined;
}

function transporte(): Transporte {
  const inner = criarTransporte({
    identidade: identidadePem(cert.ks, { cadeia: cert.cadeia.cadeia }),
    politica: homologacaoPolicy(),
    timeoutMs: 60_000,
    auditoria: (e) => {
      envio.audit = e;
    },
  });
  return {
    capacidades: inner.capacidades,
    fechar: () => inner.fechar(),
    async enviar(req: PedidoTransporte): Promise<RespostaTransporte> {
      const res = await inner.enviar(req);
      envio.resposta = { texto: res.texto(), tls: res.tls, status: res.status };
      return res;
    },
  };
}

function cliente(t: Transporte, extra: { uf?: Uf; contingencia?: 'svc' } = {}): NfeClient {
  return createNfeClient({
    transport: t,
    signer,
    ambiente: AMBIENTE,
    uf: extra.uf ?? (uf as Uf),
    clock: relogioDoSistema,
    autor: { CNPJ },
    ...(extra.contingencia ? { contingencia: extra.contingencia } : {}),
  });
}

interface Registro {
  readonly rotulo: string;
  readonly servico: string;
  readonly host: string;
  readonly http?: number;
  readonly status?: string;
  readonly cStat?: string;
  readonly xMotivo?: string;
  readonly erro?: { readonly code: string; readonly message: string };
  readonly tls?: RespostaTransporte['tls'];
  readonly ms?: number;
}

/** Roda uma operação, registra no ledger (host, serviço, desfecho) e devolve o registro, sem lançar. */
async function operar(
  rotulo: string,
  servico: string,
  hostEsperado: string,
  fn: () => Promise<ResultadoSefaz<unknown, unknown>>,
): Promise<Registro & { outcome?: ResultadoSefaz<unknown, unknown> }> {
  limparEnvio();
  try {
    const o = await fn();
    const host = envio.audit?.host ?? hostEsperado;
    led.registrar(host, servico, `HTTP ${envio.resposta?.status ?? '?'} ${o.tipo} cStat=${o.cStat}`);
    return {
      rotulo,
      servico,
      host,
      status: o.tipo,
      cStat: o.cStat,
      xMotivo: o.xMotivo,
      outcome: o,
      ...(envio.resposta ? { http: envio.resposta.status, tls: envio.resposta.tls } : {}),
      ...(envio.audit ? { ms: envio.audit.duracaoMs } : {}),
    };
  } catch (e) {
    const code = ehErroSinete(e) ? e.code : 'desconhecido';
    const message = (e as Error).message;
    const details = ehErroSinete(e) ? (e.detalhes as Record<string, unknown> | undefined) : undefined;
    const host = envio.audit?.host ?? (typeof details?.host === 'string' ? details.host : hostEsperado);
    const semSocket = !envio.audit;
    led.registrar(host, servico, `ERRO ${code}${semSocket ? ' (antes do socket, certificado não usado)' : ''}`);
    return { rotulo, servico, host, erro: { code, message } };
  }
}

function linha(r: Registro): string {
  const tls = r.tls
    ? ` ${r.tls.protocolo ?? '?'} ${r.tls.cifra ?? '?'} certCliente=${r.tls.certificadoLocalCarregado}`
    : '';
  if (r.erro) return `[${runtime}] ${r.rotulo} (${r.host}): ${r.erro.code}: ${r.erro.message}`;
  return `[${runtime}] ${r.rotulo} (${r.host}): HTTP ${r.http} ${r.status} cStat ${r.cStat} ${r.xMotivo}${tls} ${r.ms ?? '?'} ms`;
}

function salvar(nome: string, dado: unknown): void {
  const { outcome: _o, ...limpo } = dado as { outcome?: unknown };
  writeFileSync(join(estado, nome), `${JSON.stringify(limpo, null, 2)}\n`);
}

const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------------------------------------------

async function status(): Promise<void> {
  // Um alvo por autorizador, pela primeira UF que os dados do transporte mandam para ele; SVC pela contingência.
  const alvos: { rotulo: string; uf: Uf; contingencia?: 'svc' }[] = [];
  const vistos = new Set<string>();
  for (const u of UFS) {
    const a = nfeAutorizadorDaUf(u.sigla, AMBIENTE);
    if (!vistos.has(a)) {
      vistos.add(a);
      alvos.push({ rotulo: `NF-e ${a} (UF ${u.sigla})`, uf: u.sigla });
    }
  }
  for (const u of UFS) {
    const s = nfeContingenciaDaUf(u.sigla, AMBIENTE);
    if (!vistos.has(s)) {
      vistos.add(s);
      alvos.push({ rotulo: `NF-e ${s} (UF ${u.sigla})`, uf: u.sigla, contingencia: 'svc' });
    }
  }
  const t = transporte();
  const out: Registro[] = [];
  try {
    for (const a of alvos) {
      const host = nfeEndpoint({
        ambiente: AMBIENTE,
        servico: 'NfeStatusServico',
        uf: a.uf,
        ...(a.contingencia ? { contingencia: a.contingencia } : {}),
      }).host;
      const c = cliente(t, { uf: a.uf, ...(a.contingencia ? { contingencia: a.contingencia } : {}) });
      const r = await operar(a.rotulo, 'NfeStatusServico', host, () => c.statusServico());
      out.push(r);
      console.log(linha(r));
      await pausa(500);
    }
  } finally {
    await t.fechar();
  }
  salvar(`status-${runtime}.json`, { runtime, em: relogioDoSistema.agora().toISOString(), alvos: out.map(semOutcome) });
}

const semOutcome = (r: Registro & { outcome?: unknown }): Registro => {
  const { outcome: _o, ...resto } = r;
  return resto;
};

async function consultas(): Promise<void> {
  const t = transporte();
  const c = cliente(t);
  const out: Registro[] = [];
  try {
    const hostCad = nfeEndpoint({ ambiente: AMBIENTE, servico: 'NfeConsultaCadastro', uf: uf as Uf }).host;
    const cad = await operar(`ConsultaCadastro ${uf} (próprio CNPJ)`, 'NfeConsultaCadastro', hostCad, () =>
      c.consultarCadastro({ uf: uf as Uf, CNPJ }),
    );
    out.push(cad);
    console.log(linha(cad));
    await pausa(500);
    const hostAn = nfeEndpoint({ ambiente: AMBIENTE, servico: 'NFeDistribuicaoDFe' }).host;
    const dist = await operar('DistribuicaoDFe AN distNSU 0', 'NFeDistribuicaoDFe', hostAn, () =>
      c.distribuicaoDFe({ ultNSU: 0 }, { autor: { CNPJ } }),
    );
    const v = dist.outcome?.tipo === 'autorizado' ? (dist.outcome.valor as Record<string, unknown>) : undefined;
    const d = v
      ? { ...dist, ultNSU: v.ultNSU, maxNSU: v.maxNSU, documentos: (v.documentos as unknown[]).length }
      : dist;
    out.push(semOutcome(d));
    console.log(linha(dist), v ? `ultNSU=${v.ultNSU} maxNSU=${v.maxNSU}` : '');
  } finally {
    await t.fechar();
  }
  salvar(`consultas-${runtime}.json`, {
    runtime,
    em: relogioDoSistema.agora().toISOString(),
    consultas: out.map(semOutcome),
  });
}

interface EmitenteArquivo {
  readonly xNome: string;
  readonly CRT: '1' | '2' | '3' | '4';
  readonly IE?: string;
  readonly endereco: NfeInput['emitente']['endereco'];
}

async function autorizacao(): Promise<void> {
  if (!opt.emitente || !opt.nnf) throw new Error('autorizacao pede --emitente <arquivo.json> e --nnf <número>');
  const emit = JSON.parse(readFileSync(opt.emitente, 'utf8')) as EmitenteArquivo;
  if (emit.endereco.UF !== uf) throw new Error(`UF do emitente (${emit.endereco.UF}) diferente de --uf ${uf}`);
  const tentativasPath = join(estado, 'autorizacao-tentativas.json');
  const tentativas: unknown[] = existsSync(tentativasPath) ? JSON.parse(readFileSync(tentativasPath, 'utf8')) : [];
  if (opt.enviar && tentativas.length >= MAX_AUTORIZACOES) {
    throw new Error(`limite de ${MAX_AUTORIZACOES} autorizações atingido (${tentativasPath})`);
  }

  // Mesmo perfil de conteúdo do spike S2: Simples Nacional (CRT do arquivo), destinatário = o próprio CNPJ, um item
  // de R$ 1,00 com CSOSN 102, PIS e COFINS 49 zerados, sem frete, pagamento em dinheiro. O builder troca o xNome do
  // destinatário pelo literal de homologação (RV E04-20).
  const nota: NfeInput = {
    serie: opt.serie as string,
    nNF: opt.nnf,
    natOp: 'VENDA DE MERCADORIA',
    tpNF: '1',
    idDest: '1',
    indFinal: '1',
    indPres: '1',
    emitente: {
      CNPJ,
      xNome: emit.xNome,
      endereco: emit.endereco,
      CRT: emit.CRT,
      ...(emit.IE === undefined ? {} : { IE: emit.IE }),
    },
    destinatario: { CNPJ, indIEDest: '9', endereco: emit.endereco },
    itens: [
      {
        produto: {
          cProd: '1',
          xProd: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          NCM: '49119900',
          CFOP: '5102',
          uCom: 'UN',
          qCom: '1',
          vUnCom: '1.00',
        },
        impostos: {
          icms: { CSOSN: '102', orig: '0' },
          pis: { CST: '49', vBC: '0.00', aliquota: '0' },
          cofins: { CST: '49', vBC: '0.00', aliquota: '0' },
        },
      },
    ],
    transporte: { modFrete: '9' },
    pagamento: { detPag: [{ indPag: '0', tPag: '01', vPag: '1.00' }] },
  };
  const built = await buildNfe(nota, {
    ambiente: AMBIENTE,
    time: contextoDeTempo({ emissao: relogioDoSistema }),
    verProc: 'sinete-homologacao',
  });
  if (!built.ok) {
    for (const i of built.issues) console.log(`  ${i.caminho}: ${i.code}: ${i.mensagem}`);
    throw new Error('o builder recusou a NF-e');
  }
  const b = built.value;
  const assinada = await signNfe(b, signer);
  led.registrar('local', 'assinatura da NF-e (signNfe)', `chave ${b.chave}`);
  if (!assinada.startsWith(b.xml.slice(0, b.xml.indexOf('</infNFe>'))))
    throw new Error('assinatura alterou o conteúdo');
  const ver = await conferirAssinatura(assinada, { id: b.id, elemento: 'infNFe' });
  if (!ver.ok) throw new Error(`assinatura não confere localmente: ${JSON.stringify(ver)}`);
  const xsd = xsdOficial(b.pl.pl, assinada);
  console.log(
    `[${runtime}] chave ${b.chave} | PL ${b.pl.pl} | dhEmi ${b.dhEmi} | assinatura confere | XSD oficial: ${xsd}`,
  );
  const arq = join(estado, `nfe-${b.chave}-assinada.xml`);
  writeFileSync(arq, assinada); // gravada antes de enviar; só tem o certificado público
  if (!opt.enviar) {
    console.log(`[${runtime}] dry-run: não enviado (${arq})`);
    return;
  }
  // A tentativa conta antes do envio: um processo interrompido esperando a SEFAZ pode já ter entregado o lote.
  const gravarTentativas = (): void => writeFileSync(tentativasPath, `${JSON.stringify(tentativas, null, 2)}\n`);
  tentativas.push({ chave: b.chave, em: relogioDoSistema.agora().toISOString(), status: 'enviando' });
  gravarTentativas();
  const t = transporte();
  try {
    const c = cliente(t);
    const host = nfeEndpoint({ ambiente: AMBIENTE, servico: 'NFeAutorizacao', uf: uf as Uf }).host;
    const r = await operar(`NFeAutorizacao ${uf}`, 'NFeAutorizacao', host, () => c.autorizar(assinada));
    const texto = envio.resposta?.texto ?? '';
    const lote = /<retEnviNFe[\s\S]*?<cStat>(\d+)<\/cStat><xMotivo>([^<]*)</.exec(texto);
    const rec = {
      ...semOutcome(r),
      chave: b.chave,
      em: relogioDoSistema.agora().toISOString(),
      lote: lote ? { cStat: lote[1], xMotivo: lote[2] } : null,
      nProt: /<nProt>(\d+)<\/nProt>/.exec(texto)?.[1] ?? null,
      dhRecbto: /<dhRecbto>([^<]+)<\/dhRecbto>/.exec(texto)?.[1] ?? null,
    };
    tentativas[tentativas.length - 1] = rec;
    gravarTentativas();
    if (texto) writeFileSync(join(estado, `nfe-${b.chave}-retorno.xml`), texto);
    console.log(linha(r));
    console.log(JSON.stringify({ lote: rec.lote, protocolo: { cStat: r.cStat, xMotivo: r.xMotivo } }));
  } finally {
    await t.fechar();
  }
}

/** Valida contra o XSD oficial do PL com `xmllint`, quando os dois existem (não é requisito para enviar). */
function xsdOficial(pl: string, xml: string): string {
  const raiz = new URL('../../xsd-codegen/xsd/nfe/', import.meta.url).pathname;
  const dir = existsSync(raiz) ? readdirSync(raiz).find((d) => d === pl || d.startsWith(`${pl}_`)) : undefined;
  const xsd =
    dir && [join(raiz, dir, 'nfe_v4.00.xsd'), join(raiz, dir, 'NFe/nfe_v4.00.xsd')].find((p) => existsSync(p));
  if (!xsd) return `sem XSD local de ${pl}`;
  const r = spawnSync('xmllint', ['--noout', '--schema', xsd, '-'], {
    input: xml,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' },
  });
  if (r.error) return 'xmllint indisponível';
  if (r.status !== 0) throw new Error(`XSD oficial recusou: ${String(r.stderr).split('\n').slice(0, 5).join(' / ')}`);
  return 'ok';
}

async function doctor(): Promise<void> {
  // O doctor não recebe PoliticaDeHosts: a guarda confere o endpoint que ele vai resolver antes de chamá-lo.
  const ep = nfeEndpoint({ ambiente: AMBIENTE, servico: 'NfeStatusServico', uf: uf as Uf });
  await homologacaoPolicy().conferir({ url: new URL(ep.url), metodo: 'POST', corpo: undefined, endpoint: ep });
  const PFX = 'memoria:pfx';
  const CADEIA = 'memoria:cadeia';
  const cadeiaPem = cert.extras.length ? readFileSync(opt.cadeia as string) : undefined;
  const saida: string[] = [];
  const code = await cli(
    ['doctor', '--pfx', PFX, '--uf', uf, '--ambiente', AMBIENTE, '--json', ...(cadeiaPem ? ['--cadeia', CADEIA] : [])],
    {
      out: (l) => saida.push(l),
      err: (l) => saida.push(l),
      env: { SINETE_PFX_SENHA: cert.senha },
      promptPassword: () => Promise.resolve(undefined),
      readFile: (p) => {
        if (p === PFX) return Promise.resolve(cert.pfx);
        if (p === CADEIA && cadeiaPem) return Promise.resolve(new Uint8Array(cadeiaPem));
        return Promise.reject(new Error(`fora do escopo: ${p}`));
      },
    },
  );
  const texto = saida.join('\n');
  vazamentos(texto);
  const report = JSON.parse(texto) as { ok: boolean; checks: { id: string; status: string; message: string }[] };
  for (const c of report.checks)
    console.log(`[${runtime}] doctor ${c.status.padEnd(6)} ${c.id.padEnd(8)} ${c.message}`);
  const tls = report.checks.find((c) => c.id === 'tls');
  led.registrar(ep.host, 'sinete doctor (handshake TLS)', `exit ${code} tls=${tls?.status ?? '?'}`);
  salvar(`doctor-${runtime}.json`, { runtime, exit: code, report, semVazamento: true });
}

/** Falha se a saída do doctor trouxer material de chave, a senha ou pedaços do PFX. */
function vazamentos(texto: string): void {
  if (/PRIVATE KEY|BEGIN [A-Z ]*KEY|ENCRYPTED/.test(texto)) throw new Error('saída do doctor com material de chave');
  if (cert.senha.length >= 4 && texto.includes(cert.senha)) throw new Error('saída do doctor com a senha');
  let bin = '';
  for (const byte of cert.pfx) bin += String.fromCharCode(byte);
  const b64 = btoa(bin);
  for (let i = 0; i + 24 <= b64.length; i += 97) {
    if (texto.includes(b64.slice(i, i + 24))) throw new Error('saída do doctor com trecho do PFX');
  }
}

if (comando === 'status') await status();
else if (comando === 'consultas') await consultas();
else if (comando === 'autorizacao') await autorizacao();
else await doctor();
console.log(`[${runtime}] ledger: ${led.path}; hosts permitidos: ${HOSTS_HOMOLOGACAO.size}`);
