/**
 * Rodada de homologação com emitente do DF: produtor rural pessoa física com IE (e-CPF A1), autorizado pela SVRS.
 * Mesmos controles do `run.ts` (pacotes pelo `dist`, certificado só em memória, ledger por uso), com a guarda mais
 * estreita `homologacaoDfPolicy` (SVRS, SVC-AN e AN de homologação; só os serviços e eventos da rodada; `tpAmb` 2
 * obrigatório em todo POST).
 *
 * O emitente vem de um JSON fora do repo (`--emitente`, padrão `<estado>/emitente.json`): CPF, IE, nome e endereço
 * são dados pessoais. Nada disso é impresso por inteiro: CPF, IE e chaves de acesso (que contêm o CPF) saem
 * mascarados na saída e no ledger; o XML e os retornos completos ficam só no diretório de estado.
 *
 * Comandos (um por vez; nada roda em laço):
 *   status                                   statusServico na SVRS e no SVC-AN com cUF 53
 *   emitir --cenario <c> --nnf <n> [--enviar] [--transmissor-op <ref>]
 *                                            monta (IBS/CBS pela calculadora padrão), assina, valida e, com
 *                                            --enviar, autoriza uma vez (teto de 12 tentativas na rodada)
 *   consultar --chave <k> [--transmissor-op <ref>]
 *   cce --chave <k> --seq <n> --texto <t>    carta de correção
 *   cancelar --chave <k>                     cancelamento (nProt lido do retorno gravado)
 *   dist [--ultnsu <n>]                      Distribuição DF-e no AN pelo CPF do emitente
 *
 * Cenários: base (CST 00), cst40 (desoneração motDesICMS 3), cst30 e cst70 (desoneração motDesICMS 9, com ST) e
 * cst20 (redução com desoneração motDesICMS 9), no conteúdo que o integrador em produção manda depois da correção do
 * motDesICMS. cBenef da tabela do DF (Ato Declaratório 4/2023).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import type { SefazOutcome } from '@sinete/core';
import { isSineteError, systemClock, timeContext } from '@sinete/core';
import { verifySignature } from '@sinete/core/xml';
import type { Icms, NfeClient, NfeInput } from '@sinete/nfe';
import { buildNfe, createNfeClient, signNfe } from '@sinete/nfe';
import type { AuditEvent, Transport, TransportRequest, TransportResponse } from '@sinete/transport';
import { createTransport, detectRuntime, nfeEndpoint, pemIdentity } from '@sinete/transport';
import type { Certificado } from './certificado.ts';
import { abrirCertificado } from './certificado.ts';
import { LEDGER_PADRAO, ledger } from './ledger.ts';
import { HOSTS_HOMOLOGACAO_DF, homologacaoDfPolicy } from './policy.ts';

const MAX_AUTORIZACOES = 12;
const AMBIENTE = 'homologacao' as const;
const UF = 'DF' as const;

const { values: opt, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    op: { type: 'string' },
    'op-bin': { type: 'string', default: 'op-agentes' },
    'transmissor-op': { type: 'string' },
    emitente: { type: 'string' },
    cenario: { type: 'string' },
    serie: { type: 'string', default: '920' },
    nnf: { type: 'string' },
    enviar: { type: 'boolean', default: false },
    chave: { type: 'string' },
    seq: { type: 'string' },
    texto: { type: 'string' },
    ultnsu: { type: 'string', default: '0' },
    estado: { type: 'string', default: join(homedir(), '.local/state/sinete/homologacao-df') },
    ledger: { type: 'string', default: LEDGER_PADRAO },
  },
});

const comando = positionals[0] ?? '';
if (!['status', 'emitir', 'consultar', 'cce', 'cancelar', 'dist'].includes(comando)) {
  console.log('uso: node tools/homologacao/src/df.ts <status|emitir|consultar|cce|cancelar|dist> --op <ref> [...]');
  process.exit(2);
}
if (!opt.op) throw new Error('informe --op <referência do e-CPF do emitente>');
const runtime = detectRuntime();
const estado = opt.estado as string;
mkdirSync(estado, { recursive: true, mode: 0o700 });
const led = ledger(opt.ledger);

interface EmitenteArquivo {
  readonly CPF: string;
  readonly xNome: string;
  readonly IE: string;
  readonly CRT: '1' | '2' | '3' | '4';
  readonly endereco: NfeInput['emitente']['endereco'];
}
const emit = JSON.parse(readFileSync(opt.emitente ?? join(estado, 'emitente.json'), 'utf8')) as EmitenteArquivo;
if (emit.endereco.UF !== UF) throw new Error('emitente fora do DF');

// ---------------------------------------------------------------------------------------------------------------
// Máscara de dados pessoais: CPF, IE e chaves (a chave de emitente CPF traz o CPF nas posições 10 a 20)
// ---------------------------------------------------------------------------------------------------------------

const mascaraDoc = (s: string): string => `${s.slice(0, 2)}${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-2)}`;
const mascaraChave = (k: string): string => `${k.slice(0, 6)}${'*'.repeat(14)}${k.slice(20)}`;
/**
 * Nome de arquivo sem dado pessoal: série, número e o fim da chave (tpEmis, cNF e DV). A chave inteira traz o CPF;
 * o cNF distingue duas montagens do mesmo número, então nenhuma sobrescreve a outra.
 */
const arquivoDe = (k: string): string => `${k.slice(22, 25)}-${k.slice(25, 34)}-${k.slice(34)}`;
function mascarar(texto: string): string {
  let t = texto.replace(/\d{44}/g, (k) => mascaraChave(k));
  for (const s of [emit.CPF, emit.IE]) if (s.length >= 6) t = t.split(s).join(mascaraDoc(s));
  return t.split(emit.xNome).join('<nome do emitente>');
}
const log = (s: string): void => console.log(mascarar(s));
const registrar = (host: string, servico: string, desfecho: string): void =>
  led.registrar(host, mascarar(servico), mascarar(desfecho));

// ---------------------------------------------------------------------------------------------------------------
// Certificados: e-CPF do emitente (assinatura e TLS) e, só no teste do transmissor terceiro, o e-CNPJ no TLS
// ---------------------------------------------------------------------------------------------------------------

const cert: Certificado = await abrirCertificado({ op: opt.op, opBin: opt['op-bin'] as string });
const titular = cert.ks.identity;
if (titular.tipo !== 'e-CPF' || titular.cpf !== emit.CPF) {
  throw new Error(`o certificado do emitente precisa ser o e-CPF do CPF do emitente (veio ${titular.tipo})`);
}
const CPF = emit.CPF;
log(
  `[${runtime}] emitente e-CPF ${mascaraDoc(CPF)}, serial ${cert.ks.certificate.serialNumber}, válido até ${cert.ks.certificate.notAfterIso}; cadeia ${cert.cadeia.status}: ${cert.cadeia.chain.map((c) => c.subject.commonName?.replace(/:\d+$/, '') ?? '?').join(' > ')}`,
);
const signer = await cert.ks.signer();

let tlsCert: Certificado = cert;
let rotuloTls = 'TLS e-CPF emitente';
if (opt['transmissor-op']) {
  tlsCert = await abrirCertificado({ op: opt['transmissor-op'], opBin: opt['op-bin'] as string });
  const t = tlsCert.ks.identity;
  if (t.tipo !== 'e-CNPJ' || !t.cnpj) throw new Error('o transmissor terceiro precisa ser e-CNPJ');
  rotuloTls = `TLS e-CNPJ transmissor ${t.cnpj}`;
  log(
    `[${runtime}] transmissor e-CNPJ ${t.cnpj} (${t.nome ?? '?'}), serial ${tlsCert.ks.certificate.serialNumber}, válido até ${tlsCert.ks.certificate.notAfterIso}`,
  );
}

const envio: { audit?: AuditEvent | undefined; texto?: string | undefined; status?: number | undefined } = {};

function limparEnvio(): void {
  envio.audit = undefined;
  envio.texto = undefined;
  envio.status = undefined;
}

function transporte(): Transport {
  const inner = createTransport({
    identity: pemIdentity(tlsCert.ks, { chain: tlsCert.cadeia.chain }),
    policy: homologacaoDfPolicy(),
    timeoutMs: 60_000,
    audit: (e) => {
      envio.audit = e;
    },
  });
  return {
    capabilities: inner.capabilities,
    close: () => inner.close(),
    async send(req: TransportRequest): Promise<TransportResponse> {
      const res = await inner.send(req);
      envio.texto = res.text();
      envio.status = res.status;
      return res;
    },
  };
}

function cliente(t: Transport, contingencia = false): NfeClient {
  return createNfeClient({
    transport: t,
    signer,
    ambiente: AMBIENTE,
    uf: UF,
    clock: systemClock,
    autor: { CPF },
    ...(contingencia ? { contingencia: 'svc' as const } : {}),
  });
}

interface Registro {
  readonly rotulo: string;
  readonly host: string;
  readonly http?: number;
  readonly status?: string;
  readonly cStat?: string;
  readonly xMotivo?: string;
  readonly erro?: { readonly code: string; readonly message: string };
  readonly ms?: number;
}

async function operar<O extends SefazOutcome<unknown, unknown>>(
  rotulo: string,
  servico: string,
  hostEsperado: string,
  fn: () => Promise<O>,
  assinado = false,
): Promise<Registro & { outcome?: O }> {
  limparEnvio();
  const servicoLedger = `${servico} [${rotuloTls}${assinado ? '; assinatura e-CPF emitente' : ''}]`;
  try {
    const o = await fn();
    const host = envio.audit?.host ?? hostEsperado;
    registrar(host, servicoLedger, `HTTP ${envio.status ?? '?'} ${o.status} cStat=${o.cStat}`);
    return {
      rotulo,
      host,
      status: o.status,
      cStat: o.cStat,
      xMotivo: mascarar(o.xMotivo),
      outcome: o,
      ...(envio.status === undefined ? {} : { http: envio.status }),
      ...(envio.audit ? { ms: envio.audit.durationMs } : {}),
    };
  } catch (e) {
    const code = isSineteError(e) ? e.code : 'desconhecido';
    const host = envio.audit?.host ?? hostEsperado;
    registrar(host, servicoLedger, `ERRO ${code}${envio.audit ? '' : ' (antes do socket, certificado não usado)'}`);
    return { rotulo, host, erro: { code, message: mascarar((e as Error).message) } };
  }
}

const linha = (r: Registro): string =>
  r.erro
    ? `[${runtime}] ${r.rotulo} (${r.host}): ${r.erro.code}: ${r.erro.message}`
    : `[${runtime}] ${r.rotulo} (${r.host}): HTTP ${r.http} ${r.status} cStat ${r.cStat} ${r.xMotivo} ${r.ms ?? '?'} ms`;

function anexar(nome: string, dado: Record<string, unknown>): void {
  const p = join(estado, nome);
  const lista: unknown[] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
  lista.push({ runtime, em: systemClock.now().toISOString(), ...dado });
  writeFileSync(p, `${JSON.stringify(lista, null, 2)}\n`, { mode: 0o600 });
}

const semOutcome = <R extends { outcome?: unknown }>(r: R): Omit<R, 'outcome'> => {
  const { outcome: _o, ...resto } = r;
  return resto;
};

function hostDe(servico: Parameters<typeof nfeEndpoint>[0]['servico'], contingencia = false): string {
  return nfeEndpoint({ ambiente: AMBIENTE, uf: UF, servico, ...(contingencia ? { contingencia: 'svc' } : {}) }).host;
}

// ---------------------------------------------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------------------------------------------

async function status(): Promise<void> {
  const t = transporte();
  try {
    for (const svc of [false, true]) {
      const r = await operar(
        `NfeStatusServico ${svc ? 'SVC-AN' : 'SVRS'} cUF 53`,
        'NfeStatusServico',
        hostDe('NfeStatusServico', svc),
        () => cliente(t, svc).statusServico(),
      );
      log(linha(r));
      anexar('status.json', semOutcome(r));
    }
  } finally {
    await t.close();
  }
}

/** Grupo de ICMS e cBenef de cada cenário (item de R$ 100,00, alíquota interna do DF de 20%). */
function cenario(nome: string): { icms: Icms; cBenef?: string; rotulo: string } {
  switch (nome) {
    case 'base':
      return { rotulo: 'CST 00', icms: { CST: '00', orig: '0', pICMS: '20' } };
    case 'cst40':
      return {
        rotulo: 'CST 40, motDesICMS 3',
        cBenef: 'DF814087',
        icms: { CST: '40', orig: '0', desoneracao: { vICMSDeson: '20.00', motDesICMS: '3' } },
      };
    case 'cst30':
      return {
        rotulo: 'CST 30, motDesICMS 9',
        cBenef: 'DF814087',
        icms: {
          CST: '30',
          orig: '0',
          st: { modBCST: '6', vBCST: '100.00', pICMSST: '20' },
          desoneracao: { vICMSDeson: '20.00', motDesICMS: '9' },
        },
      };
    case 'cst70':
      return {
        rotulo: 'CST 70, motDesICMS 9',
        cBenef: 'DF816038',
        icms: {
          CST: '70',
          orig: '0',
          pRedBC: '60',
          pICMS: '20',
          st: { modBCST: '6', vBCST: '100.00', pICMSST: '20' },
          desoneracao: { vICMSDeson: '12.00', motDesICMS: '9' },
        },
      };
    case 'cst20':
      return {
        rotulo: 'CST 20, motDesICMS 9',
        cBenef: 'DF816038',
        icms: {
          CST: '20',
          orig: '0',
          pRedBC: '60',
          pICMS: '20',
          desoneracao: { vICMSDeson: '12.00', motDesICMS: '9' },
        },
      };
    default:
      throw new Error(`cenário desconhecido: ${nome} (base, cst40, cst30, cst70, cst20)`);
  }
}

function nota(nome: string, vPag: string): NfeInput {
  const c = cenario(nome);
  return {
    serie: opt.serie as string,
    nNF: opt.nnf as string,
    natOp: 'VENDA DE PRODUCAO DO ESTABELECIMENTO',
    tpNF: '1',
    idDest: '1',
    indFinal: '0',
    indPres: '9',
    emitente: { CPF, xNome: emit.xNome, IE: emit.IE, CRT: emit.CRT, endereco: emit.endereco },
    // O próprio produtor como destinatário contribuinte; o builder põe o nome literal de homologação (RV E04-20).
    destinatario: { CPF, IE: emit.IE, indIEDest: '1', endereco: emit.endereco },
    itens: [
      {
        produto: {
          cProd: '1',
          xProd: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          NCM: '10059010',
          ...(c.cBenef ? { cBenef: c.cBenef } : {}),
          CFOP: '5101',
          uCom: 'KG',
          qCom: '100',
          vUnCom: '1.00',
        },
        impostos: {
          icms: c.icms,
          pis: { CST: '49', vBC: '0.00', aliquota: '0' },
          cofins: { CST: '49', vBC: '0.00', aliquota: '0' },
          ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '100.00' } },
        },
      },
    ],
    transporte: { modFrete: '9' },
    pagamento: { detPag: [{ indPag: '0', tPag: '01', vPag }] },
    informacoesAdicionais: { infCpl: `Teste de homologacao do sinete: ${c.rotulo}` },
  };
}

async function montar(nome: string, vPag: string) {
  const r = await buildNfe(nota(nome, vPag), {
    ambiente: AMBIENTE,
    time: timeContext({ emissao: systemClock }),
    verProc: 'sinete-homologacao',
  });
  if (!r.ok) {
    for (const i of r.issues) log(`  ${i.path}: ${i.code}: ${i.message}`);
    throw new Error('o builder recusou a NF-e');
  }
  return r.value;
}

async function emitir(): Promise<void> {
  const nome = opt.cenario ?? '';
  if (!opt.nnf) throw new Error('emitir pede --nnf');
  const tentativasPath = join(estado, 'autorizacao-tentativas.json');
  const tentativas: unknown[] = existsSync(tentativasPath) ? JSON.parse(readFileSync(tentativasPath, 'utf8')) : [];
  // Série e número já enviados não voltam, nem com o retorno perdido: a tentativa é gravada com a chave antes do
  // envio, e outra montagem teria outro cNF, ou seja, outra nota para o mesmo número. Resolva a original pela consulta.
  const serieNnf = `${String(opt.serie).padStart(3, '0')}${String(opt.nnf).padStart(9, '0')}`;
  if (tentativas.some((x) => String((x as { chave?: string }).chave ?? '').slice(22, 34) === serieNnf)) {
    throw new Error(
      `série ${opt.serie} e número ${opt.nnf} já têm tentativa de autorização nesta rodada; consulte a chave original e use outro número`,
    );
  }
  if (opt.enviar && tentativas.length >= MAX_AUTORIZACOES) {
    throw new Error(`limite de ${MAX_AUTORIZACOES} autorizações atingido (${tentativasPath})`);
  }
  // Primeira montagem só para ler o vNF; a nota enviada é a segunda, com o pagamento igual ao total.
  const previa = await montar(nome, '0.01');
  const vNF = /<vNF>([^<]+)<\/vNF>/.exec(previa.xml)?.[1];
  if (!vNF) throw new Error('vNF ausente na montagem');
  const b = await montar(nome, vNF);
  const assinada = await signNfe(b, signer);
  registrar('local', 'assinatura da NF-e (signNfe) [e-CPF emitente]', `chave ${b.chave}`);
  if (!assinada.startsWith(b.xml.slice(0, b.xml.indexOf('</infNFe>'))))
    throw new Error('assinatura alterou o conteúdo');
  const ver = await verifySignature(assinada, { id: b.id, element: 'infNFe' });
  if (!ver.ok) throw new Error('assinatura não confere localmente');
  const xsd = xsdOficial(b.pl.pl, assinada);
  const icms = /<ICMS>([\s\S]*?)<\/ICMS>/.exec(assinada)?.[1] ?? '';
  const ibscbs = /<IBSCBS>([\s\S]*?)<\/IBSCBS>/.exec(assinada)?.[1] ?? '';
  log(`[${runtime}] ${nome}: chave ${b.chave} | PL ${b.pl.pl} | vNF ${vNF} | assinatura confere | XSD oficial: ${xsd}`);
  log(`  ICMS ${icms}`);
  log(`  IBSCBS ${ibscbs}`);
  const arq = join(estado, `nfe-${arquivoDe(b.chave)}-assinada.xml`);
  writeFileSync(arq, assinada, { mode: 0o600 });
  if (!opt.enviar) {
    log(`[${runtime}] dry-run: não enviado`);
    return;
  }
  tentativas.push({ cenario: nome, chave: b.chave, em: systemClock.now().toISOString(), status: 'enviando' });
  writeFileSync(tentativasPath, `${JSON.stringify(tentativas, null, 2)}\n`, { mode: 0o600 });
  const t = transporte();
  try {
    const r = await operar(
      `NFeAutorizacao SVRS ${nome}`,
      'NFeAutorizacao',
      hostDe('NFeAutorizacao'),
      () => cliente(t).autorizar(assinada),
      true,
    );
    const texto = envio.texto ?? '';
    const lote = /<retEnviNFe[\s\S]*?<cStat>(\d+)<\/cStat><xMotivo>([^<]*)</.exec(texto);
    const prot = r.outcome?.status === 'authorized' ? r.outcome.value : undefined;
    const rec = {
      ...semOutcome(r),
      cenario: nome,
      transmissor: rotuloTls,
      chave: b.chave,
      em: systemClock.now().toISOString(),
      lote: lote ? { cStat: lote[1], xMotivo: lote[2] } : null,
      nProt: /<nProt>(\d+)<\/nProt>/.exec(texto)?.[1] ?? null,
      dhRecbto: /<dhRecbto>([^<]+)<\/dhRecbto>/.exec(texto)?.[1] ?? null,
    };
    tentativas[tentativas.length - 1] = rec;
    writeFileSync(tentativasPath, `${JSON.stringify(tentativas, null, 2)}\n`, { mode: 0o600 });
    if (texto) writeFileSync(join(estado, `nfe-${arquivoDe(b.chave)}-retorno.xml`), texto, { mode: 0o600 });
    if (prot?.nfeProc) writeFileSync(join(estado, `nfe-${arquivoDe(b.chave)}-proc.xml`), prot.nfeProc, { mode: 0o600 });
    log(linha(r));
    log(
      JSON.stringify({ lote: rec.lote, protocolo: { cStat: r.cStat, xMotivo: r.xMotivo }, nfeProc: !!prot?.nfeProc }),
    );
    log(`[${runtime}] tentativas de autorização na rodada: ${tentativas.length}/${MAX_AUTORIZACOES}`);
  } finally {
    await t.close();
  }
}

function assinadaDe(chave: string): string {
  const p = join(estado, `nfe-${arquivoDe(chave)}-assinada.xml`);
  if (!existsSync(p)) throw new Error('NF-e assinada não encontrada no estado');
  return readFileSync(p, 'utf8');
}

async function consultar(): Promise<void> {
  const chave = opt.chave ?? '';
  const t = transporte();
  try {
    const r = await operar('NfeConsultaProtocolo SVRS', 'NfeConsultaProtocolo', hostDe('NfeConsultaProtocolo'), () =>
      cliente(t).consultar(chave, assinadaDe(chave)),
    );
    const v = r.outcome?.status === 'authorized' ? r.outcome.value : undefined;
    log(linha(r));
    if (v) log(`  situação ${v.situacao}, eventos ${v.eventos.length}, digVal confere ${v.digValConfere ?? '?'}`);
    if (envio.texto)
      writeFileSync(join(estado, `consulta-${arquivoDe(chave)}-${systemClock.now().getTime()}.xml`), envio.texto, {
        mode: 0o600,
      });
    anexar('consultas.json', {
      ...semOutcome(r),
      chave,
      transmissor: rotuloTls,
      ...(v ? { situacao: v.situacao, eventos: v.eventos.length, digValConfere: v.digValConfere } : {}),
    });
  } finally {
    await t.close();
  }
}

function nProtDe(chave: string): string {
  const p = join(estado, `nfe-${arquivoDe(chave)}-retorno.xml`);
  const n = existsSync(p) ? /<nProt>(\d+)<\/nProt>/.exec(readFileSync(p, 'utf8'))?.[1] : undefined;
  if (!n) throw new Error('protocolo da NF-e não encontrado no estado');
  return n;
}

async function evento(tipo: 'cce' | 'cancelar'): Promise<void> {
  const chave = opt.chave ?? '';
  const t = transporte();
  try {
    const c = cliente(t);
    const r =
      tipo === 'cce'
        ? await operar(
            `CC-e seq ${opt.seq}`,
            'RecepcaoEvento 110110',
            hostDe('RecepcaoEvento'),
            () => c.cartaCorrecao({ chave, nSeqEvento: Number(opt.seq), xCorrecao: opt.texto ?? '' }),
            true,
          )
        : await operar(
            'Cancelamento',
            'RecepcaoEvento 110111',
            hostDe('RecepcaoEvento'),
            () =>
              c.cancelar({
                chave,
                nProt: nProtDe(chave),
                xJust: 'Cancelamento de NF-e de teste emitida em ambiente de homologacao',
              }),
            true,
          );
    log(linha(r));
    const v = r.outcome?.status === 'authorized' ? r.outcome.value : undefined;
    if (envio.texto) {
      writeFileSync(join(estado, `evento-${tipo}-${arquivoDe(chave)}-${opt.seq ?? '1'}.xml`), envio.texto, {
        mode: 0o600,
      });
    }
    if (v)
      writeFileSync(join(estado, `proc-evento-${tipo}-${arquivoDe(chave)}-${opt.seq ?? '1'}.xml`), v.procEventoNFe, {
        mode: 0o600,
      });
    anexar('eventos.json', { ...semOutcome(r), tipo, chave, seq: opt.seq ?? '1', nProt: v?.nProt ?? null });
  } finally {
    await t.close();
  }
}

async function dist(): Promise<void> {
  const t = transporte();
  try {
    const r = await operar(
      `DistribuicaoDFe AN distNSU ${opt.ultnsu}`,
      'NFeDistribuicaoDFe',
      hostDe('NFeDistribuicaoDFe'),
      () => cliente(t).distribuicaoDFe({ ultNSU: opt.ultnsu as string }, { autor: { CPF } }),
    );
    log(linha(r));
    const v = r.outcome?.status === 'authorized' ? r.outcome.value : undefined;
    const docs = v?.documentos.map((d) => ({ NSU: d.NSU, tipo: d.tipo, schema: d.schema })) ?? [];
    if (v) {
      log(
        `  ultNSU ${v.ultNSU} maxNSU ${v.maxNSU}; documentos: ${docs.map((d) => `${d.NSU}:${d.tipo}`).join(', ') || 'nenhum'}`,
      );
      for (const d of v.documentos) writeFileSync(join(estado, `dist-${d.NSU}-${d.tipo}.xml`), d.xml, { mode: 0o600 });
    }
    anexar('dist.json', { ...semOutcome(r), ...(v ? { ultNSU: v.ultNSU, maxNSU: v.maxNSU, documentos: docs } : {}) });
  } finally {
    await t.close();
  }
}

/** Valida contra o XSD oficial do PL com `xmllint`, quando os dois existem. */
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
  if (r.status !== 0)
    throw new Error(`XSD oficial recusou: ${mascarar(String(r.stderr).split('\n').slice(0, 5).join(' / '))}`);
  return 'ok';
}

if (comando === 'status') await status();
else if (comando === 'emitir') await emitir();
else if (comando === 'consultar') await consultar();
else if (comando === 'cce') await evento('cce');
else if (comando === 'cancelar') await evento('cancelar');
else await dist();
console.log(`[${runtime}] ledger: ${led.path}; hosts permitidos: ${HOSTS_HOMOLOGACAO_DF.size}`);
