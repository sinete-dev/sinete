/**
 * Obtenção dos artefatos oficiais com verificação de hash. Nada é redistribuído pelo repositório (ADR 0007, licença e
 * termos): o extrator baixa da URL oficial para um cache local e confere o sha256 antes de usar. Arquivo com hash
 * diferente do fixado em `sources.json` falha a extração; trocar de versão é mudar o pin no mesmo commit do dataset.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export function defaultCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
  return process.env.SINETE_IBS_CBS_CACHE || path.join(base, 'sinete', 'ibs-cbs');
}

export async function fileSha256(file: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest('hex');
}

export async function verify(file: string, sha256: string, label: string): Promise<void> {
  const got = await fileSha256(file);
  if (got !== sha256) {
    throw new Error(`${label}: sha256 ${got} difere do fixado ${sha256} (${file}); a fonte oficial mudou?`);
  }
}

/**
 * GET com cookies entre redirecionamentos. O Portal da NF-e responde 302 com `AspxAutoDetectCookieSupport` e só entrega
 * o arquivo quando o cookie volta na requisição seguinte.
 */
async function fetchWithCookies(url: string): Promise<Response> {
  const cookies = new Map<string, string>();
  let current = url;
  for (let hop = 0; hop < 10; hop++) {
    const cookieHeader = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(current, {
      redirect: 'manual',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';');
      const eq = pair?.indexOf('=') ?? -1;
      if (pair && eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`${current}: redirecionamento sem Location`);
      current = new URL(loc, current).toString();
      await res.body?.cancel();
      continue;
    }
    return res;
  }
  throw new Error(`${url}: redirecionamentos demais`);
}

/**
 * Garante o arquivo no cache: usa `local` se informado, senão o que já está no cache, senão baixa de `url`. Em todos os
 * casos confere o sha256 antes de devolver o caminho.
 */
export async function ensureFile(opts: {
  readonly url: string;
  readonly sha256: string;
  readonly name: string;
  readonly cacheDir: string;
  readonly local?: string | undefined;
  readonly log: (msg: string) => void;
}): Promise<string> {
  if (opts.local) {
    await verify(opts.local, opts.sha256, opts.name);
    return opts.local;
  }
  await mkdir(opts.cacheDir, { recursive: true });
  const target = path.join(opts.cacheDir, `${opts.sha256.slice(0, 16)}-${opts.name}`);
  if (existsSync(target)) {
    await verify(target, opts.sha256, opts.name);
    return target;
  }
  opts.log(`baixando ${opts.url}`);
  const res = await fetchWithCookies(opts.url);
  if (!res.ok || !res.body) throw new Error(`${opts.url}: HTTP ${res.status}`);
  const partial = `${target}.partial`;
  await Bun.write(partial, res);
  try {
    await verify(partial, opts.sha256, opts.name);
  } catch (e) {
    await rm(partial, { force: true });
    throw e;
  }
  await rename(partial, target);
  return target;
}
