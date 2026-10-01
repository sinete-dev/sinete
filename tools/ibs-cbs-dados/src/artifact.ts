/**
 * Desmonta o `calculadora.zip` oficial em cache: o rootfs (`calculadora.tar.gz`), o SQLite embarcado nele e as
 * migrações Flyway do `codigo-fonte-backend.zip`; e reconstrói o SQLite a partir das migrações (segundo caminho de
 * build, ADR 0007 decisão 3). Desde a V0058 o código-fonte publicado não traz mais as migrações, só o próprio `.db`;
 * nesse caso o segundo caminho se reduz a conferir que esse `.db` é o mesmo do rootfs (`segundoCaminho` do pin). Todo
 * arquivo intermediário é conferido pelo sha256 fixado em `sources.json`.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import { fileSha256, verify } from './fetch.ts';

export interface CalculadoraPin {
  readonly id: string;
  readonly title: string;
  readonly downloadUrlEndpoint: string;
  readonly url: string;
  readonly lastModified: string;
  readonly contentLength: number;
  readonly zipSha256: string;
  readonly entries: Readonly<Record<string, string>>;
  readonly dockerLayerDiffId: string;
  readonly db: { readonly pathInTar: string; readonly sha256: string };
  /**
   * Como conferir o `.db` por um segundo caminho. Ausente ou `flyway`: reconstruir das migrações do código-fonte, que
   * é independente do `.db` distribuído. `db-do-codigo-fonte`: o código-fonte deixou de publicar as migrações e traz
   * o `.db` em `pathInSourceZip`; só dá para conferir que é o mesmo arquivo do rootfs, sem reconstrução independente.
   */
  readonly segundoCaminho?:
    | { readonly tipo: 'flyway' }
    | { readonly tipo: 'db-do-codigo-fonte'; readonly pathInSourceZip: string; readonly nota: string };
  readonly versao: {
    readonly versaoApp: string;
    readonly versaoDb: string;
    readonly dataVersaoDb: string;
    readonly descricaoVersaoDb: string;
  };
}

async function unzipEntry(zip: string, entry: string, out: string, sha256: string): Promise<string> {
  if (!existsSync(out)) {
    await $`unzip -p ${zip} ${entry} > ${`${out}.partial`}`.quiet();
    await verify(`${out}.partial`, sha256, entry);
    await $`mv ${`${out}.partial`} ${out}`.quiet();
  } else {
    await verify(out, sha256, entry);
  }
  return out;
}

export async function unpackCalculadora(
  zip: string,
  pin: CalculadoraPin,
  cacheDir: string,
): Promise<{ tarGz: string; db: string; sourceZip: string }> {
  const dir = path.join(cacheDir, pin.zipSha256.slice(0, 16));
  await mkdir(dir, { recursive: true });
  const tarSha = pin.entries['calculadora.tar.gz'];
  const srcSha = pin.entries['codigo-fonte-backend.zip'];
  if (!tarSha || !srcSha)
    throw new Error('sources.json: faltam os hashes de calculadora.tar.gz e codigo-fonte-backend.zip');
  const tarGz = await unzipEntry(zip, 'calculadora.tar.gz', path.join(dir, 'calculadora.tar.gz'), tarSha);
  const sourceZip = await unzipEntry(
    zip,
    'codigo-fonte-backend.zip',
    path.join(dir, 'codigo-fonte-backend.zip'),
    srcSha,
  );
  const db = path.join(dir, 'calculadora-pro.db');
  if (!existsSync(db)) {
    await $`tar -xzOf ${tarGz} ${pin.db.pathInTar} > ${`${db}.partial`}`.quiet();
    await verify(`${db}.partial`, pin.db.sha256, pin.db.pathInTar);
    await $`mv ${`${db}.partial`} ${db}`.quiet();
  } else {
    await verify(db, pin.db.sha256, pin.db.pathInTar);
  }
  return { tarGz, db, sourceZip };
}

/**
 * Extrai o `.db` que o `codigo-fonte-backend.zip` publica no lugar das migrações (V0058 em diante) e confere que é o
 * mesmo arquivo do rootfs, pelo sha256 fixado em `db.sha256`.
 */
export async function dbFromSourceZip(
  sourceZip: string,
  pathInSourceZip: string,
  sha256: string,
  cacheDir: string,
): Promise<string> {
  const dir = path.join(cacheDir, `fonte-${(await fileSha256(sourceZip)).slice(0, 16)}`);
  await mkdir(dir, { recursive: true });
  return await unzipEntry(sourceZip, pathInSourceZip, path.join(dir, path.basename(pathInSourceZip)), sha256);
}

/**
 * sha256 do tar descomprimido: é o `diff_id` da camada que o `docker import` cria, estável entre imports (o Image ID
 * não é). É o que amarra o dataset ao contêiner usado como oráculo.
 */
export async function layerDiffId(tarGz: string): Promise<string> {
  const out = await $`gunzip -c ${tarGz} | shasum -a 256`.quiet().text();
  return `sha256:${out.split(/\s+/)[0]}`;
}

/**
 * Reconstrói o SQLite aplicando `beforeMigrate.sql`, `B0001` e `V0002..versaoDb`, sem `afterMigrate` (o `.db`
 * distribuído foi gerado sem ele, ADR 0007). O Flyway roda cada migração em transação, onde `PRAGMA foreign_keys` é
 * ignorado; aqui a checagem de FK fica desligada durante a reconstrução pelo mesmo motivo.
 */
export async function rebuildFromFlyway(sourceZip: string, versaoDb: string, cacheDir: string): Promise<string> {
  const dir = path.join(cacheDir, `flyway-${(await fileSha256(sourceZip)).slice(0, 16)}`);
  const sqlDir = path.join(dir, 'flyway/sql');
  if (!existsSync(sqlDir)) {
    await mkdir(dir, { recursive: true });
    await $`unzip -q -o ${sourceZip} ${'flyway/sql/*'} -d ${dir}`.quiet();
  }
  const out = path.join(dir, `rebuilt-${versaoDb}.db`);
  await rm(out, { force: true });
  const migrations = (await readdir(path.join(sqlDir, 'manutencao')))
    .filter((f) => /^V\d+__.*\.sql$/.test(f))
    .sort()
    .filter((f) => (f.split('__')[0] ?? '') <= versaoDb);
  if (!migrations.some((f) => f.startsWith(`${versaoDb}__`))) {
    throw new Error(`migração ${versaoDb} não encontrada em ${sqlDir}/manutencao`);
  }
  const parts = [
    await Bun.file(path.join(sqlDir, 'criacao/beforeMigrate.sql')).text(),
    await Bun.file(path.join(sqlDir, 'criacao/B0001__sistema_tributario_completo.sql')).text(),
  ];
  for (const f of migrations) parts.push(`${await Bun.file(path.join(sqlDir, 'manutencao', f)).text()}\n;`);
  const script = parts.join('\n').replace(/PRAGMA\s+foreign_keys\s*=\s*ON\s*;/gi, 'PRAGMA foreign_keys = OFF;');
  const scriptFile = path.join(dir, `rebuild-${versaoDb}.sql`);
  await Bun.write(scriptFile, script);
  await $`sqlite3 -bail ${out} < ${scriptFile}`.quiet();
  return out;
}
