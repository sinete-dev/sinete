// Extrator do dataset rtc-data a partir do SQLite embarcado na Calculadora offline (artefato fixado em pin.json).
// Uso: bun src/extract.ts --db <calculadora-pro.db> --out <dir> [--pin pin.json] [--source-label shipped|rebuilt-from-flyway]
//
// Por que o SQLite e não a API: a API dados-abertos não expõe vigências (dIniVig/dFimVig), os indicadores de grupo
// da CST (ind_gIBSCBS, ind_gRed, ind_gDif...), nem ind_gCredPresOper/gMono*/gEstornoCred/anexo da cClassTrib,
// nem a lista de NCM aplicáveis. O SQLite tem tudo, com vigência explícita, e é reconstruível byte a byte (em
// conteúdo) a partir das migrações Flyway que vêm no mesmo zip. A API fica como verificação cruzada (crosscheck.ts).
import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonical, dec, sha256 } from "./lib";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const dbPath = args.db ?? `${process.env.HOME}/.local/state/sinete/s7/pkg/rootfs/calculadora/calculadora/db/calculadora-pro.db`;
const out = args.out ?? "dataset/current";
const pin = existsSync(args.pin ?? "pin.json") ? JSON.parse(readFileSync(args.pin ?? "pin.json", "utf8")) : null;
const db = new Database(dbPath, { readonly: true });
const q = <T = any>(sql: string, ...p: any[]) => db.query(sql).all(...p) as T[];

const vig = (from: string | null, to: string | null) => ({ from: from?.slice(0, 10) ?? null, to: to?.slice(0, 10) ?? null });
const b = (x: any) => x === 1 || x === "1" || x === true;
const TRIB: Record<number, string> = Object.fromEntries(q("select TBTO_ID id, TBTO_SIGLA s from TRIBUTO").map((r: any) => [r.id, r.s]));
const byKey = <T>(xs: T[], k: (x: T) => string) => [...xs].sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));

// ---------------- versão ----------------
const versao = q("select VRBD_VERSAO_BASE_DADO v, substr(VRBD_DATA,1,10) d, VRBD_DESCRICAO descr from VERSAO_BASE_DADO order by VRBD_ID desc limit 1")[0];

// ---------------- CST ----------------
const cstTrib = q("select TRST_SITR_ID s, TRST_TBTO_ID t, TRST_INICIO_VIGENCIA f, TRST_FIM_VIGENCIA e from TRIBUTO_SITUACAO_TRIBUTARIA");
const cst = byKey(
  q("select * from SITUACAO_TRIBUTARIA").map((r: any) => {
    const tribs = cstTrib.filter((x) => x.s === r.SITR_ID).map((x) => TRIB[x.t]);
    const family = tribs.includes("IS") ? "IS" : "CBS_IBS";
    return {
      key: `${family}:${r.SITR_CD}:${r.SITR_INICIO_VIGENCIA}`,
      family,
      code: r.SITR_CD,
      description: r.SITR_DESCRICAO,
      validity: vig(r.SITR_INICIO_VIGENCIA, r.SITR_FIM_VIGENCIA),
      tributos: tribs.sort(),
      groups: {
        gIBSCBS: b(r.SITR_IND_GIBSCBS), gIBSCBSMono: b(r.SITR_IND_GIBSCBSMONO), gRed: b(r.SITR_IND_GRED), gDif: b(r.SITR_IND_GDIF),
        gTransfCred: b(r.SITR_IND_GTRANSFCRED), gCredPresIBSZFM: b(r.SITR_IND_GCREDPRESIBSZFM), gAjusteCompet: b(r.SITR_IND_GAJUSTECOMPET),
      },
      _id: r.SITR_ID,
    };
  }),
  (x) => x.key,
);
const cstById = new Map(cst.map((c) => [c._id, c]));

// ---------------- tratamentos (expressões de cálculo) ----------------
const treatments = byKey(
  q("select * from TRATAMENTO_TRIBUTARIO").map((r: any) => ({
    key: String(r.TRTR_ID).padStart(3, "0"),
    id: r.TRTR_ID,
    description: r.TRTR_DESCRICAO,
    validity: vig(r.TRTR_INICIO_VIGENCIA, r.TRTR_FIM_VIGENCIA),
    expr: {
      aliquota: r.TRTR_EXPRESSAO_ALIQUOTA || null, aliquotaEfetiva: r.TRTR_EXPRESSAO_ALIQUOTA_EFETIVA || null,
      baseCalculo: r.TRTR_EXPRESSAO_BASE_CALCULO || null, tributoCalculado: r.TRTR_EXPRESSAO_TRIBUTO_CALCULADO || null,
      tributoDevido: r.TRTR_EXPRESSAO_TRIBUTO_DEVIDO || null, percentualDiferimento: r.TRTR_EXPRESSAO_PERCENTUAL_DIFERIMENTO || null,
      valorDiferimento: r.TRTR_EXPRESSAO_VALOR_DIFERIMENTO || null,
    },
    flags: {
      incompativelComSuspensao: b(r.TRTR_IN_INCOMPATIVEL_COM_SUSPENSAO), exigeGrupoTribRegular: b(r.TRTR_IN_EXIGE_GRUPO_DESONERACAO),
      possuiPercentualReducao: b(r.TRTR_IN_POSSUI_PERCENTUAL_REDUCAO), possuiAjuste: b(r.TRTR_IN_POSSUI_AJUSTE),
      possuiRedutor: b(r.TRTR_IN_POSSUI_REDUTOR), possuiMonofasia: b(r.TRTR_IN_POSSUI_MONOFASIA),
    },
  })),
  (x) => x.key,
);

// ---------------- cClassTrib ----------------
const tdcl = q("select c.TDCL_CLTR_ID c, t.TPDF_SIGLA s, t.TPDF_TIPO m, c.TDCL_INICIO_VIGENCIA f, c.TDCL_FIM_VIGENCIA e from TIPO_DFE_CLASSIFICACAO c join TIPO_DFE t on t.TPDF_ID=c.TDCL_TPDF_ID");
const pere = q("select PERE_CLTR_ID c, PERE_TBTO_ID t, PERE_VALOR v, PERE_INICIO_VIGENCIA f, PERE_FIM_VIGENCIA e from PERCENTUAL_REDUCAO");
const trcl = q("select TRCL_CLTR_ID c, TRCL_TRTR_ID t, TRCL_INICIO_VIGENCIA f, TRCL_FIM_VIGENCIA e from TRATAMENTO_CLASSIFICACAO");
const fund = q("select f.FDCL_CLTR_ID c, l.FDLG_TEXTO_CURTO short, l.FDLG_TEXTO texto, f.FDCL_INICIO_VIGENCIA f, f.FDCL_FIM_VIGENCIA e from FUNDAMENTACAO_CLASSIFICACAO f join FUNDAMENTACAO_LEGAL l on l.FDLG_ID=f.FDCL_FDLG_ID");
const aadv = q("select AADV_CLTR_ID c, AADV_TBTO_ID t, AADV_VALOR v, AADV_INICIO_VIGENCIA f, AADV_FIM_VIGENCIA e from ALIQUOTA_AD_VALOREM where AADV_CLTR_ID is not null");

const classTrib = byKey(
  q("select * from CLASSIFICACAO_TRIBUTARIA").map((r: any) => {
    const c = cstById.get(r.CLTR_SITR_ID);
    return {
      key: `${c?.family}:${r.CLTR_CD}:${r.CLTR_INICIO_VIGENCIA}`,
      family: c?.family,
      code: r.CLTR_CD,
      cst: c?.code ?? null,
      description: r.CLTR_DESCRICAO,
      rateKind: r.CLTR_TIPO_ALIQUOTA,
      nomenclature: r.CLTR_NOMENCLATURA,
      annex: r.CLTR_ANEXO ?? null,
      tpRBSN: r.CLTR_TPRBSN ?? null,
      credit: {
        buyerCbs: b(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_CBS), buyerIbs: b(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_IBS),
        presumedSupplier: b(r.CLTR_IN_CREDITO_PRESUMIDO_FORNECEDOR), presumedBuyer: b(r.CLTR_IN_CREDITO_PRESUMIDO_ADQUIRENTE),
        priorOperationCredit: r.CLTR_CREDITO_OPERACAO_ANTECEDENTE,
      },
      groups: {
        gCredPresOper: r.CLTR_IND_GCREDPRESOPER ?? null, gMonoPadrao: b(r.CLTR_IND_GMONOPADRAO), gMonoReten: b(r.CLTR_IND_GMONORETEN),
        gMonoRet: b(r.CLTR_IND_GMONORET), gMonoDif: b(r.CLTR_IND_GMONODIF), gEstornoCred: b(r.CLTR_IND_GESTORNOCRED),
      },
      treatments: trcl.filter((x) => x.c === r.CLTR_ID).map((x) => ({ treatment: x.t, validity: vig(x.f, x.e) })),
      reductions: byKey(pere.filter((x) => x.c === r.CLTR_ID).map((x) => ({ tributo: TRIB[x.t], pRed: dec(x.v), validity: vig(x.f, x.e) })), (x) => x.tributo + x.validity.from),
      fixedRates: byKey(aadv.filter((x) => x.c === r.CLTR_ID).map((x) => ({ tributo: TRIB[x.t], aliquota: dec(x.v), validity: vig(x.f, x.e) })), (x) => x.tributo + x.validity.from),
      dfe: byKey(tdcl.filter((x) => x.c === r.CLTR_ID).map((x) => ({ sigla: x.s, modelo: x.m, validity: vig(x.f, x.e) })), (x) => x.sigla + x.validity.from),
      legal: fund.filter((x) => x.c === r.CLTR_ID).map((x) => ({ short: x.short, validity: vig(x.f, x.e), textSha256: sha256(x.texto ?? "") })),
      memoriaTemplate: r.CLTR_MEMORIA_CALCULO,
      validity: vig(r.CLTR_INICIO_VIGENCIA, r.CLTR_FIM_VIGENCIA),
      updatedAt: r.CLTR_DATA_ATUALIZACAO?.slice(0, 10) ?? null,
    };
  }),
  (x) => x.key,
);

// ---------------- alíquotas ----------------
const rates = {
  referencia: byKey(q("select ALRE_TBTO_ID t, ALRE_VALOR v, ALRE_INICIO_VIGENCIA f, ALRE_FIM_VIGENCIA e from ALIQUOTA_REFERENCIA").map((x: any) => ({ key: `${TRIB[x.t]}:${x.f}`, tributo: TRIB[x.t], aliquota: dec(x.v), validity: vig(x.f, x.e) })), (x) => x.key),
  padraoPorEnte: q("select count(*) n from ALIQUOTA_PADRAO")[0].n, // hoje 0 linhas: alíquota por UF/município ainda não existe como dado
  adValoremPorNcm: byKey(q("select p.AAVP_NCM_CD ncm, a.AADV_TBTO_ID t, a.AADV_VALOR v, p.AAVP_INICIO_VIGENCIA f, p.AAVP_FIM_VIGENCIA e from ALIQUOTA_AD_VALOREM_PRODUTO p join ALIQUOTA_AD_VALOREM a on a.AADV_ID=p.AAVP_AADV_ID").map((x: any) => ({ key: `${TRIB[x.t]}:${x.ncm}:${x.f}`, tributo: TRIB[x.t], ncm: x.ncm, aliquota: dec(x.v), validity: vig(x.f, x.e) })), (x) => x.key),
  adRemPorNcm: byKey(q("select p.AARP_NCM_CD ncm, a.AARE_TBTO_ID t, a.AARE_VALOR v, u.UNMD_SIGLA un, p.AARP_INICIO_VIGENCIA f, p.AARP_FIM_VIGENCIA e from ALIQUOTA_AD_REM_PRODUTO p join ALIQUOTA_AD_REM a on a.AARE_ID=p.AARP_AARE_ID join UNIDADE_MEDIDA u on u.UNMD_ID=a.AARE_UNMD_ID").map((x: any) => ({ key: `${TRIB[x.t]}:${x.ncm}:${x.f}`, tributo: TRIB[x.t], ncm: x.ncm, aliquota: dec(x.v), unidade: x.un, validity: vig(x.f, x.e) })), (x) => x.key),
  redutorCompraGov: q("select RCGO_VALOR v, RCGO_INICIO_VIGENCIA f, RCGO_FIM_VIGENCIA e from REDUTOR_COMPRA_GOVERNAMENTAL").map((x: any) => ({ pRedutor: dec(x.v), validity: vig(x.f, x.e) })),
  transferenciaCbsEnteGov: byKey(q("select TCEG_VALOR v, TCEG_INICIO_VIGENCIA f, TCEG_FIM_VIGENCIA e from TRANSFERENCIA_CBS_ENTE_GOV").map((x: any) => ({ percentual: dec(x.v), validity: vig(x.f, x.e) })), (x) => x.validity.from!),
};

// ---------------- aplicabilidade NCM/NBS ----------------
const cltrCode = new Map(q("select CLTR_ID id, CLTR_CD cd from CLASSIFICACAO_TRIBUTARIA").map((r: any) => [r.id, r.cd]));
const cltrFamily = new Map(q("select CLTR_ID id, CLTR_SITR_ID s from CLASSIFICACAO_TRIBUTARIA").map((r: any) => [r.id, cstById.get(r.s)?.family ?? null]));
const annexNum = new Map(q("select ANXO_ID id, ANXO_NUMERO n, ANXO_NUMERO_ITEM i from ANEXO").map((r: any) => [r.id, `${r.n}${r.i ? "/" + r.i : ""}`]));
const encm = q("select ENCM_NCMA_ID a, ENCM_NCM_CD ncm, ENCM_INICIO_VIGENCIA f, ENCM_FIM_VIGENCIA e from EXCECAO_NCM_APLICAVEL");
const ncmApplicability = byKey(
  q("select * from NCM_APLICAVEL").map((r: any) => ({
    key: `${cltrFamily.get(r.NCMA_CLTR_ID)}:${cltrCode.get(r.NCMA_CLTR_ID)}:${r.NCMA_NCM_CD}:${r.NCMA_INICIO_VIGENCIA}`,
    family: cltrFamily.get(r.NCMA_CLTR_ID), cClassTrib: cltrCode.get(r.NCMA_CLTR_ID), ncmPrefix: r.NCMA_NCM_CD, annexItem: annexNum.get(r.NCMA_ANXO_ID) ?? null,
    validity: vig(r.NCMA_INICIO_VIGENCIA, r.NCMA_FIM_VIGENCIA),
    exceptions: byKey(encm.filter((x) => x.a === r.NCMA_ID).map((x) => ({ ncmPrefix: x.ncm, validity: vig(x.f, x.e) })), (x) => x.ncmPrefix),
  })),
  (x) => x.key,
);
const enbs = q("select ENBS_NBSA_ID a, ENBS_NBS_CD nbs, ENBS_INICIO_VIGENCIA f, ENBS_FIM_VIGENCIA e from EXCECAO_NBS_APLICAVEL");
const nbsApplicability = byKey(
  q("select * from NBS_APLICAVEL").map((r: any) => ({
    key: `${cltrFamily.get(r.NBSA_CLTR_ID)}:${cltrCode.get(r.NBSA_CLTR_ID)}:${r.NBSA_NBS_CD}:${r.NBSA_INICIO_VIGENCIA}`,
    family: cltrFamily.get(r.NBSA_CLTR_ID), cClassTrib: cltrCode.get(r.NBSA_CLTR_ID), nbsPrefix: r.NBSA_NBS_CD, annexItem: annexNum.get(r.NBSA_ANXO_ID) ?? null,
    validity: vig(r.NBSA_INICIO_VIGENCIA, r.NBSA_FIM_VIGENCIA),
    exceptions: enbs.filter((x) => x.a === r.NBSA_ID).map((x) => ({ nbsPrefix: x.nbs, validity: vig(x.f, x.e) })),
  })),
  (x) => x.key,
);

// NFS-e: vínculo NBS x cClassTrib x cIndOp (item da LC 116), é o que a Calculadora usa para aceitar a NBS na NFS-e
const ioic = new Map(q("select IOIC_ID id, IOIC_CD cd from INDICADOR_OPERACAO_IBS_CBS").map((r: any) => [r.id, r.cd]));
const nfseNbsClassTrib = byKey(
  q("select * from CLASSIF_NBS_INDOP_LC").map((r: any) => ({
    key: `${r.CNIL_NBS_CD}:${cltrCode.get(r.CNIL_CLTR_ID)}:${r.CNIL_IN_PS_ONEROSA}:${r.CNIL_IN_ADQ_EXTERIOR}:${r.CNIL_INICIO_VIGENCIA}`,
    nbs: r.CNIL_NBS_CD, cClassTrib: cltrCode.get(r.CNIL_CLTR_ID) ?? null, itemLc116: r.CNIL_LSLC_CD, cIndOp: ioic.get(r.CNIL_IOIC_ID) ?? null,
    onerosa: b(r.CNIL_IN_PS_ONEROSA), adquirenteExterior: b(r.CNIL_IN_ADQ_EXTERIOR), validity: vig(r.CNIL_INICIO_VIGENCIA, r.CNIL_FIM_VIGENCIA),
  })),
  (x) => x.key,
);

// ---------------- atores ----------------
const actors = {
  groups: byKey(q("select * from GRUPO_ATOR").map((r: any) => ({ key: String(r.GRAT_ID).padStart(3, "0"), id: r.GRAT_ID, description: r.GRAT_DESCRICAO, order: r.GRAT_ORDEM, validity: vig(r.GRAT_INICIO_VIGENCIA, r.GRAT_FIM_VIGENCIA) })), (x) => x.key),
  actors: byKey(q("select * from ATOR").map((r: any) => ({ key: String(r.ATOR_ID).padStart(3, "0"), id: r.ATOR_ID, group: r.ATOR_GRAT_ID, description: r.ATOR_DESCRICAO, order: r.ATOR_ORDEM, validity: vig(r.ATOR_INICIO_VIGENCIA, r.ATOR_FIM_VIGENCIA) })), (x) => x.key),
  classTribByActor: byKey(q("select * from ATOR_CLASSIFICACAO").map((r: any) => ({ key: `${r.ATCL_ATOR_ID}:${r.ATCL_IN_PAPEL}:${cltrCode.get(r.ATCL_CLTR_ID)}`, actor: r.ATCL_ATOR_ID, role: r.ATCL_IN_PAPEL, cClassTrib: cltrCode.get(r.ATCL_CLTR_ID), validity: vig(r.ATCL_INICIO_VIGENCIA, r.ATCL_FIM_VIGENCIA) })), (x) => x.key),
};

const dfeTypes = byKey(q("select * from TIPO_DFE").map((r: any) => ({ key: r.TPDF_SIGLA, sigla: r.TPDF_SIGLA, modelo: r.TPDF_TIPO, description: r.TPDF_DESCRICAO, validity: vig(r.TPDF_INICIO_VIGENCIA, r.TPDF_FIM_VIGENCIA) })), (x) => x.key);

// ---------------- escrita ----------------
mkdirSync(join(out, "tables"), { recursive: true });
const strip = (xs: any[]) => xs.map(({ _id, ...rest }) => rest);
const tables: Record<string, any> = {
  cst: strip(cst), classTrib, treatments, rates, ncmApplicability, nbsApplicability, nfseNbsClassTrib, actors, dfeTypes,
};
const files = Object.entries(tables).map(([name, data]) => {
  const body = canonical(data);
  const path = `tables/${name}.json`;
  writeFileSync(join(out, path), body);
  const records = Array.isArray(data) ? data.length : Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]));
  return { path, sha256: sha256(body), records };
});

const manifest = {
  dataSchemaVersion: 1,
  packageVersion: `${versao.d.slice(0, 4)}.${versao.d.slice(5, 7)}.0-${versao.v}`,
  knownAt: versao.d, // data de conhecimento = data da base oficial, não a data da coleta (determinismo)
  sources: [
    {
      kind: "CALCULADORA_OFFLINE",
      versaoDb: versao.v, dataVersaoDb: versao.d, descricaoVersaoDb: versao.descr,
      versaoApp: pin?.versao?.versaoApp ?? null,
      artifact: pin ? { url: pin.url, zipSha256: pin.zipSha256, tarGzSha256: pin.entries["calculadora.tar.gz"], dockerLayerDiffId: pin.dockerLayerDiffId, dbPathInTar: pin.db.pathInTar, dbSha256Pinned: pin.db.sha256 } : null,
      extractedFrom: args["source-label"] ?? "shipped-sqlite",
      dbFileSha256: sha256(readFileSync(dbPath)),
    },
  ],
  files,
};
// o manifest tem conteúdo determinístico; a data de coleta vai num arquivo à parte, fora do hash do dataset
writeFileSync(join(out, "manifest.json"), canonical(manifest));
writeFileSync(join(out, "collected.json"), canonical({ collectedAt: new Date().toISOString(), host: process.platform }));
const datasetSha = sha256(files.map((f) => `${f.sha256}  ${f.path}`).join("\n"));
console.log(JSON.stringify({ out, versaoDb: versao.v, datasetSha256: datasetSha, files: files.map((f) => [f.path, f.sha256.slice(0, 12), f.records]) }, null, 1));
