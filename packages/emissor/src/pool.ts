/**
 * Pool de emissores por certificado, para quem emite por muitos emitentes (ADR 0010, decisão 3).
 *
 * Abrir o PFX e subir o transporte mTLS a cada documento custa caro, e manter um emissor por certificado para sempre
 * segura conexões de emitentes que não emitem mais. O pool guarda cada emissor por `ttlMs` e no máximo `maximo` deles,
 * e fecha o transporte só quando ninguém mais o usa: o empréstimo é por escopo (`usar(cert, fn)`), com contagem
 * explícita, sem `AsyncLocalStorage` (que só existe no Node e no Bun).
 *
 * Com `CertificadoA1`, a chave do pool é o SHA-256 do PFX e da senha: nunca vai a log nem sai do pool, e nem o PFX
 * nem a senha ficam guardados nele. Quem identifica o certificado de outro jeito (o id no próprio banco, com o PFX lido
 * só na criação) passa `chave`.
 */

import type { Clock } from '@sinete/core';
import { ConfigError, systemClock } from '@sinete/core';
import type { CertificadoA1 } from './certificado.ts';

export interface OpcoesPool<E, C = CertificadoA1> {
  /**
   * Cria o emissor do certificado (em geral `createNfeEmissor({ ...cert, ...comum })`, ou com `certificado:
   * await abrirCertificado(cert)` para vários emissores do mesmo certificado).
   */
  readonly criar: (cert: C) => Promise<E>;
  /**
   * Identifica o certificado no pool. Padrão, para `CertificadoA1`: o SHA-256 do PFX e da senha. Obrigatória para
   * qualquer outro tipo de certificado.
   */
  readonly chave?: (cert: C) => string | Promise<string>;
  /**
   * Validade de um emissor no pool, a contar da criação. Padrão: 10 minutos. Conferida a cada empréstimo, para todos os
   * certificados; num pool sem empréstimos, o que venceu só sai no `fechar`.
   */
  readonly ttlMs?: number;
  /** Certificados no pool ao mesmo tempo; o mais antigo sai primeiro. Padrão: 32. */
  readonly maximo?: number;
  readonly clock?: Clock;
}

export interface PoolDeEmissores<E, C = CertificadoA1> {
  /** Empresta o emissor do certificado durante `fn`. O transporte só fecha quando nenhum empréstimo está em curso. */
  usar<T>(cert: C, fn: (emissor: E) => Promise<T>): Promise<T>;
  /** Fecha todos os emissores, em uso ou não (desligamento). O pool não aceita mais empréstimos. */
  fechar(): Promise<void>;
}

interface Entrada<E> {
  readonly criadoEm: number;
  readonly emissor: Promise<E>;
  usuarios: number;
  aposentada: boolean;
  fechada: boolean;
}

const encoder = new TextEncoder();

/** SHA-256 do PFX, de um separador e da senha, em hexadecimal. */
async function chaveA1(cert: CertificadoA1): Promise<string> {
  if (!(cert?.pfx instanceof Uint8Array) || typeof cert.senha !== 'string') {
    throw new ConfigError('o pool precisa da opção chave para certificado que não seja pfx e senha');
  }
  const senha = encoder.encode(cert.senha);
  const dados = new Uint8Array(cert.pfx.length + 1 + senha.length);
  dados.set(cert.pfx, 0);
  dados.set(senha, cert.pfx.length + 1);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', dados));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cria o pool. `E` é qualquer emissor do pacote (ou qualquer coisa com `fechar`); `C`, o certificado que `criar`
 * recebe (padrão: `CertificadoA1`).
 */
export function createPoolDeEmissores<E extends { fechar(): Promise<void> }, C = CertificadoA1>(
  opcoes: OpcoesPool<E, C>,
): PoolDeEmissores<E, C> {
  const chaveDe = opcoes.chave ?? ((cert: C): Promise<string> => chaveA1(cert as unknown as CertificadoA1));
  const ttlMs = opcoes.ttlMs ?? 10 * 60 * 1000;
  const maximo = opcoes.maximo ?? 32;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new ConfigError(`ttlMs do pool inválido: ${ttlMs}`);
  if (!Number.isInteger(maximo) || maximo < 1) throw new ConfigError(`maximo do pool inválido: ${maximo}`);
  const clock = opcoes.clock ?? systemClock;
  const entradas = new Map<string, Entrada<E>>();
  /** Todas as entradas ainda abertas, inclusive as aposentadas com empréstimo em curso: o `fechar` fecha todas. */
  const abertas = new Set<Entrada<E>>();
  let fechado = false;

  async function fecharEntrada(e: Entrada<E>): Promise<void> {
    if (e.fechada) return;
    e.fechada = true;
    abertas.delete(e);
    try {
      await (await e.emissor).fechar();
    } catch {
      // Emissor que nem chegou a abrir (PFX inválido): nada a fechar.
    }
  }

  /** Tira do pool; o emissor só fecha quando o último empréstimo terminar. */
  function aposentar(e: Entrada<E>): void {
    e.aposentada = true;
    if (e.usuarios === 0) void fecharEntrada(e);
  }

  function pegar(chave: string, cert: C): Entrada<E> {
    const agora = clock.now().getTime();
    // Aposenta as vencidas de qualquer certificado, não só deste: o `Map` está na ordem de criação, então as vencidas
    // estão no começo. Uma em uso só fecha quando o empréstimo terminar.
    for (const [k, e] of entradas) {
      if (agora - e.criadoEm < ttlMs) break;
      entradas.delete(k);
      aposentar(e);
    }
    const achada = entradas.get(chave);
    if (achada !== undefined) return achada;
    const nova: Entrada<E> = {
      criadoEm: agora,
      emissor: opcoes.criar(cert),
      usuarios: 0,
      aposentada: false,
      fechada: false,
    };
    // Falha ao criar (senha errada, certificado vencido): sai do pool, e o próximo empréstimo tenta de novo.
    nova.emissor.catch(() => {
      if (entradas.get(chave) === nova) entradas.delete(chave);
      abertas.delete(nova);
    });
    entradas.set(chave, nova);
    abertas.add(nova);
    while (entradas.size > maximo) {
      const [maisAntiga, e] = entradas.entries().next().value as [string, Entrada<E>];
      entradas.delete(maisAntiga);
      aposentar(e);
    }
    return nova;
  }

  return {
    async usar<T>(cert: C, fn: (emissor: E) => Promise<T>): Promise<T> {
      if (fechado) throw new ConfigError('o pool de emissores já foi fechado');
      const chave = await chaveDe(cert);
      // O `fechar` pode ter rodado enquanto o hash era calculado.
      if (fechado) throw new ConfigError('o pool de emissores já foi fechado');
      const entrada = pegar(chave, cert);
      entrada.usuarios++;
      try {
        return await fn(await entrada.emissor);
      } finally {
        entrada.usuarios--;
        if (entrada.aposentada && entrada.usuarios === 0) await fecharEntrada(entrada);
      }
    },
    async fechar(): Promise<void> {
      fechado = true;
      const todas = [...abertas];
      entradas.clear();
      await Promise.all(todas.map(fecharEntrada));
    },
  };
}
