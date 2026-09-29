/**
 * Ciclo de vida do contêiner da Calculadora offline usado como oráculo.
 *
 * A imagem não é redistribuída: vem do `calculadora.zip` oficial (baixado e conferido pelo `tools/ibs-cbs-dados`) com
 * `docker import` do rootfs. Como `docker import` não tem digest estável, a imagem é conferida pelo `diff_id` da única
 * camada, fixado em `tools/ibs-cbs-dados/sources.json`. O contêiner tem nome único por execução, publica só a API do regime
 * geral em `127.0.0.1` e é removido pelo nome no fim: nada de filtros por padrão, que atingiriam contêineres alheios.
 */
import path from 'node:path';
import { $ } from 'bun';
import type { CalculadoraPin } from '../../ibs-cbs-dados/src/artifact.ts';
import { unpackCalculadora } from '../../ibs-cbs-dados/src/artifact.ts';
import { defaultCacheDir, ensureFile } from '../../ibs-cbs-dados/src/fetch.ts';

const root = path.resolve(import.meta.dir, '../../..');

export async function loadPin(): Promise<CalculadoraPin> {
  const sources = (await Bun.file(path.join(root, 'tools/ibs-cbs-dados/sources.json')).json()) as {
    calculadora: CalculadoraPin;
  };
  return sources.calculadora;
}

/** Tag local da imagem importada, derivada do pin (nunca `latest`). */
export function imageTag(pin: CalculadoraPin): string {
  return `sinete-ibs-cbs-oraculo/calculadora:${pin.versao.versaoDb.toLowerCase()}-${pin.dockerLayerDiffId.slice(7, 19)}`;
}

async function layers(image: string): Promise<string[] | undefined> {
  const r = await $`docker image inspect ${image} --format ${'{{json .RootFS.Layers}}'}`.quiet().nothrow();
  if (r.exitCode !== 0) return undefined;
  return JSON.parse(r.stdout.toString()) as string[];
}

/**
 * Garante uma imagem local cuja camada confere com o pin. Usa `image` se informada (e conferida); senão a tag
 * derivada do pin, importando do rootfs oficial quando ela ainda não existe.
 */
export async function ensureImage(
  pin: CalculadoraPin,
  opts: { image?: string; cacheDir?: string; log: (m: string) => void },
): Promise<string> {
  const candidates = [opts.image, imageTag(pin)].filter((x): x is string => x !== undefined);
  for (const image of candidates) {
    const ls = await layers(image);
    if (!ls) continue;
    if (ls.length !== 1 || ls[0] !== pin.dockerLayerDiffId) {
      throw new Error(`imagem ${image}: camada ${ls.join(',')} difere do diff_id fixado ${pin.dockerLayerDiffId}`);
    }
    opts.log(`imagem ${image} confere com o diff_id fixado`);
    return image;
  }
  const cacheDir = opts.cacheDir ?? defaultCacheDir();
  const zip = await ensureFile({
    url: pin.url,
    sha256: pin.zipSha256,
    name: 'calculadora.zip',
    cacheDir,
    log: opts.log,
  });
  const { tarGz } = await unpackCalculadora(zip, pin, cacheDir);
  const tag = imageTag(pin);
  opts.log(`importando o rootfs oficial como ${tag}`);
  await $`docker import --platform linux/amd64 ${tarGz} ${tag}`.quiet();
  const ls = await layers(tag);
  if (!ls || ls[0] !== pin.dockerLayerDiffId) throw new Error(`imagem importada ${tag} não confere com o diff_id`);
  return tag;
}

async function freePort(): Promise<number> {
  const server = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
  const port = server.port;
  server.stop(true);
  return port;
}

export interface Oracle {
  readonly api: string;
  readonly name: string;
  readonly versaoDb: string;
  stop(): Promise<void>;
}

/** Sobe um contêiner com nome único e espera a API responder com a versão fixada. */
export async function startOracle(
  pin: CalculadoraPin,
  image: string,
  opts: { log: (m: string) => void; timeoutMs?: number },
): Promise<Oracle> {
  const name = `sinete-ibs-cbs-oraculo-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const port = await freePort();
  // VERSAO_OFFLINE_URL inválida: a única chamada de saída do offline (checagem de versão) não sai para a rede.
  await $`docker run -d --name ${name} --platform linux/amd64 -p ${`127.0.0.1:${port}:8080`} -e VERSAO_OFFLINE_URL=http://127.0.0.1:9/ -w /calculadora ${image} bash start.sh`.quiet();
  const api = `http://127.0.0.1:${port}/api`;
  const stop = async (): Promise<void> => {
    await $`docker rm -f ${name}`.quiet().nothrow();
  };
  const deadline = performance.now() + (opts.timeoutMs ?? 180_000);
  opts.log(`contêiner ${name} em ${api}, aguardando a API`);
  for (;;) {
    try {
      const r = await fetch(`${api}/calculadora/dados-abertos/versao`);
      if (r.ok) {
        const v = (await r.json()) as { versaoDb?: string };
        if (v.versaoDb !== pin.versao.versaoDb) {
          await stop();
          throw new Error(`oráculo responde ${v.versaoDb}, o pin é ${pin.versao.versaoDb}`);
        }
        opts.log(`API pronta (${v.versaoDb})`);
        return { api, name, versaoDb: v.versaoDb, stop };
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('oráculo responde')) throw e;
    }
    if (performance.now() > deadline) {
      await stop();
      throw new Error(`API do oráculo não respondeu em ${opts.timeoutMs ?? 180_000} ms`);
    }
    await Bun.sleep(1000);
  }
}
