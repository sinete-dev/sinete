// Lê a documentação Swagger (read-only) da parametrização do ADN em produção restrita, para achar o caminho oficial.
import { loadCert } from "./cert.ts";
import { send } from "./transport.ts";
const cert = loadCert();
const url = process.argv[2];
const r = await send(cert, { url, method: "GET", service: "NFS-e swagger docs (leitura)" });
console.log(r.status, r.error ?? "");
const b = r.body;
if (/swagger|openapi/i.test(b) && b.trim().startsWith("{")) {
  const j = JSON.parse(b);
  for (const [p, ops] of Object.entries<any>(j.paths ?? {})) console.log(Object.keys(ops).join(",").toUpperCase(), p, Object.values<any>(ops)[0]?.summary ?? "");
  console.log("servers:", JSON.stringify(j.servers ?? j.basePath ?? null));
} else console.log(b.match(/.{0,80}(specUrl|swagger|openapi).{0,120}/gi), b.match(/[A-Za-z0-9_\/.:-]+\.json/g), b.match(/Redoc\.init\([^)]*\)/g), b.match(/spec-url=["'][^"']+|redoc[^>]{0,200}/gi), b.match(/[^"' ]*swagger[^"' ]*\.json|url:\s*"[^"]+"|configUrl[^,]+|urls[^\]]+\]/gi)?.slice(0, 10), b.slice(0, 400).replace(/\s+/g, " "));
