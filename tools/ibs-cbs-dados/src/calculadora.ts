/**
 * Extração das tabelas do SQLite da Calculadora offline (ADR 0007, decisão 1).
 *
 * Por que o SQLite e não a API `dados-abertos`: a API não expõe vigências, os indicadores de grupo da CST, parte dos
 * indicadores da cClassTrib nem a lista de NCM aplicáveis. O SQLite tem tudo, com vigência explícita, e é reconstruível
 * a partir das migrações Flyway publicadas no mesmo zip (`flyway.ts`), o que dá o segundo caminho de build.
 *
 * Saída: registros no schema de `packages/ibs-cbs-dados/src/types.ts`, sem nada que dependa do arquivo (ids internos viram
 * chaves estáveis `família:código:início`).
 */
import { Database } from 'bun:sqlite';
import type {
  ActorClassTribRecord,
  ActorGroupRecord,
  ActorRecord,
  AnnexRecord,
  ApplicabilityRecord,
  CbsTransferRecord,
  ClassTribRecord,
  CstRecord,
  DfeTypeRecord,
  Family,
  GovPurchaseReducerRecord,
  Indicator,
  NfseNbsRecord,
  Nomenclature,
  RateKind,
  TreatmentRecord,
  Tributo,
  Validity,
} from '../../../packages/ibs-cbs-dados/src/types.ts';
import { decimalText, isoDate, sortBy } from './lib.ts';

/** Registro de CST antes do merge com o IT (`redutorBC` ainda desconhecido). */
export type CalcCst = Omit<CstRecord, 'sources'> & { readonly _id: number };
/** Registro de cClassTrib antes do merge com o IT. */
export type CalcClassTrib = Omit<ClassTribRecord, 'sources' | 'name' | 'legal' | 'groups'> & {
  readonly _id: number;
  readonly groups: Omit<ClassTribRecord['groups'], 'gTribRegular' | 'gpBioDiferenca'>;
  readonly basis: ClassTribRecord['legal']['basis'];
};

export interface CalcTables {
  readonly versao: { readonly versaoDb: string; readonly data: string; readonly descricao: string };
  readonly cst: readonly CalcCst[];
  readonly classTrib: readonly CalcClassTrib[];
  readonly treatments: readonly TreatmentRecord[];
  readonly ncmApplicability: readonly ApplicabilityRecord[];
  readonly nbsApplicability: readonly ApplicabilityRecord[];
  readonly annexes: readonly AnnexRecord[];
  readonly nfseNbs: readonly NfseNbsRecord[];
  readonly actorGroups: readonly ActorGroupRecord[];
  readonly actors: readonly ActorRecord[];
  readonly actorClassTrib: readonly ActorClassTribRecord[];
  readonly dfeTypes: readonly DfeTypeRecord[];
  readonly govPurchaseReducer: readonly GovPurchaseReducerRecord[];
  readonly cbsTransfer: readonly CbsTransferRecord[];
  /** Alíquotas de referência por tributo (vão para o `@sinete/ibs-cbs/aliquotas`). */
  readonly referenceRates: readonly { tributo: Tributo; rate: string; validity: Validity }[];
}

type Row = Record<string, unknown>;

function vig(from: unknown, to: unknown): Validity {
  const f = isoDate(from as string | null);
  if (!f) throw new Error('vigência sem início');
  return { from: f, to: isoDate(to as string | null) };
}

const bool = (x: unknown): boolean => x === 1 || x === '1' || x === true;
/** Indicador de grupo com semântica "exige / não permite". */
const reqForb = (x: unknown): Indicator => (bool(x) ? 'required' : 'forbidden');
const str = (x: unknown): string => (x === null || x === undefined ? '' : String(x));
const optStr = (x: unknown): string | null => (x === null || x === undefined || x === '' ? null : String(x));
const dec = (x: unknown): string => {
  const d = decimalText(x as number | null);
  if (d === null) throw new Error('decimal ausente');
  return d;
};

/** Desempate de chaves repetidas por sufixo ordinal (`#2`), na ordem já estável da lista. */
function ordinalKeys<T extends { key: string }>(xs: T[]): T[] {
  const seen = new Map<string, number>();
  return xs.map((x) => {
    const n = (seen.get(x.key) ?? 0) + 1;
    seen.set(x.key, n);
    return n === 1 ? x : { ...x, key: `${x.key}#${n}` };
  });
}

export function extractCalculadora(dbPath: string): CalcTables {
  const db = new Database(dbPath, { readonly: true });
  try {
    return extract(db);
  } finally {
    db.close();
  }
}

function extract(db: Database): CalcTables {
  const q = (sql: string): Row[] => db.query(sql).all() as Row[];
  const tributoById = new Map(
    q('select TBTO_ID id, TBTO_SIGLA s from TRIBUTO').map((r) => [r.id, str(r.s) as Tributo]),
  );
  const trib = (id: unknown): Tributo => {
    const t = tributoById.get(id);
    if (!t) throw new Error(`tributo ${String(id)} desconhecido`);
    return t;
  };

  const v = q(
    'select VRBD_VERSAO_BASE_DADO v, VRBD_DATA d, VRBD_DESCRICAO descr from VERSAO_BASE_DADO order by VRBD_ID desc limit 1',
  )[0];
  if (!v) throw new Error('VERSAO_BASE_DADO vazia');
  const versao = { versaoDb: str(v.v), data: isoDate(str(v.d)) ?? '', descricao: str(v.descr) };

  // ---------------- CST ----------------
  const cstTrib = q('select TRST_SITR_ID s, TRST_TBTO_ID t from TRIBUTO_SITUACAO_TRIBUTARIA');
  const cst: CalcCst[] = sortBy(
    q('select * from SITUACAO_TRIBUTARIA').map((r): CalcCst => {
      const tributos = [...new Set(cstTrib.filter((x) => x.s === r.SITR_ID).map((x) => trib(x.t)))].sort();
      const family: Family = tributos.includes('IS') ? 'IS' : 'CBS_IBS';
      const validity = vig(r.SITR_INICIO_VIGENCIA, r.SITR_FIM_VIGENCIA);
      return {
        _id: Number(r.SITR_ID),
        key: `${family}:${str(r.SITR_CD)}:${validity.from}`,
        family,
        code: str(r.SITR_CD),
        description: str(r.SITR_DESCRICAO),
        tributos,
        groups: {
          gIBSCBS: reqForb(r.SITR_IND_GIBSCBS),
          gIBSCBSMono: reqForb(r.SITR_IND_GIBSCBSMONO),
          gRed: reqForb(r.SITR_IND_GRED),
          gDif: reqForb(r.SITR_IND_GDIF),
          gTransfCred: reqForb(r.SITR_IND_GTRANSFCRED),
          gCredPresIBSZFM: reqForb(r.SITR_IND_GCREDPRESIBSZFM),
          gAjusteCompet: reqForb(r.SITR_IND_GAJUSTECOMPET),
          redutorBC: null,
        },
        validity,
      };
    }),
    (x) => x.key,
  );
  const cstById = new Map(cst.map((c) => [c._id, c]));

  // ---------------- tratamentos ----------------
  const treatments: TreatmentRecord[] = sortBy(
    q('select * from TRATAMENTO_TRIBUTARIO').map(
      (r): TreatmentRecord => ({
        key: String(r.TRTR_ID).padStart(3, '0'),
        id: Number(r.TRTR_ID),
        description: str(r.TRTR_DESCRICAO),
        expr: {
          aliquota: optStr(r.TRTR_EXPRESSAO_ALIQUOTA),
          aliquotaEfetiva: optStr(r.TRTR_EXPRESSAO_ALIQUOTA_EFETIVA),
          baseCalculo: str(r.TRTR_EXPRESSAO_BASE_CALCULO),
          tributoCalculado: str(r.TRTR_EXPRESSAO_TRIBUTO_CALCULADO),
          tributoDevido: optStr(r.TRTR_EXPRESSAO_TRIBUTO_DEVIDO),
          percentualDiferimento: optStr(r.TRTR_EXPRESSAO_PERCENTUAL_DIFERIMENTO),
          valorDiferimento: optStr(r.TRTR_EXPRESSAO_VALOR_DIFERIMENTO),
        },
        flags: {
          incompativelComSuspensao: bool(r.TRTR_IN_INCOMPATIVEL_COM_SUSPENSAO),
          exigeGrupoTribRegular: bool(r.TRTR_IN_EXIGE_GRUPO_DESONERACAO),
          possuiPercentualReducao: bool(r.TRTR_IN_POSSUI_PERCENTUAL_REDUCAO),
          possuiAjuste: bool(r.TRTR_IN_POSSUI_AJUSTE),
          possuiRedutor: bool(r.TRTR_IN_POSSUI_REDUTOR),
          possuiMonofasia: bool(r.TRTR_IN_POSSUI_MONOFASIA),
        },
        validity: vig(r.TRTR_INICIO_VIGENCIA, r.TRTR_FIM_VIGENCIA),
      }),
    ),
    (x) => x.key,
  );

  // ---------------- cClassTrib ----------------
  const tdcl = q(
    'select c.TDCL_CLTR_ID c, t.TPDF_SIGLA s, t.TPDF_TIPO m, c.TDCL_INICIO_VIGENCIA f, c.TDCL_FIM_VIGENCIA e from TIPO_DFE_CLASSIFICACAO c join TIPO_DFE t on t.TPDF_ID=c.TDCL_TPDF_ID',
  );
  const pere = q(
    'select PERE_CLTR_ID c, PERE_TBTO_ID t, PERE_VALOR v, PERE_INICIO_VIGENCIA f, PERE_FIM_VIGENCIA e from PERCENTUAL_REDUCAO',
  );
  const trcl = q(
    'select TRCL_CLTR_ID c, TRCL_TRTR_ID t, TRCL_INICIO_VIGENCIA f, TRCL_FIM_VIGENCIA e from TRATAMENTO_CLASSIFICACAO',
  );
  const fund = q(
    'select f.FDCL_CLTR_ID c, l.FDLG_TEXTO_CURTO short, l.FDLG_TEXTO texto, l.FDLG_REFERENCIA_NORMATIVA ref, f.FDCL_INICIO_VIGENCIA f, f.FDCL_FIM_VIGENCIA e from FUNDAMENTACAO_CLASSIFICACAO f join FUNDAMENTACAO_LEGAL l on l.FDLG_ID=f.FDCL_FDLG_ID',
  );
  const aadv = q(
    'select AADV_CLTR_ID c, AADV_TBTO_ID t, AADV_VALOR v, AADV_INICIO_VIGENCIA f, AADV_FIM_VIGENCIA e from ALIQUOTA_AD_VALOREM where AADV_CLTR_ID is not null',
  );
  const byValidity = <T extends { validity: Validity }>(xs: T[], k: (x: T) => string): T[] =>
    sortBy(xs, (x) => `${k(x)}@${x.validity.from}`);

  const classTrib: CalcClassTrib[] = sortBy(
    q('select * from CLASSIFICACAO_TRIBUTARIA').map((r): CalcClassTrib => {
      const c = cstById.get(Number(r.CLTR_SITR_ID));
      if (!c) throw new Error(`cClassTrib ${str(r.CLTR_CD)} sem CST`);
      const validity = vig(r.CLTR_INICIO_VIGENCIA, r.CLTR_FIM_VIGENCIA);
      const id = r.CLTR_ID;
      return {
        _id: Number(id),
        key: `${c.family}:${str(r.CLTR_CD)}:${validity.from}`,
        family: c.family,
        code: str(r.CLTR_CD),
        cst: c.code,
        description: str(r.CLTR_DESCRICAO),
        rateKind: str(r.CLTR_TIPO_ALIQUOTA) as RateKind,
        nomenclature: optStr(r.CLTR_NOMENCLATURA) as Nomenclature | null,
        annex: optStr(r.CLTR_ANEXO),
        tpRBSN: Number(r.CLTR_TPRBSN ?? 0),
        credit: {
          buyerCbs: bool(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_CBS),
          buyerIbs: bool(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_IBS),
          presumedSupplier: bool(r.CLTR_IN_CREDITO_PRESUMIDO_FORNECEDOR),
          presumedBuyer: bool(r.CLTR_IN_CREDITO_PRESUMIDO_ADQUIRENTE),
          priorOperation: optStr(r.CLTR_CREDITO_OPERACAO_ANTECEDENTE) as 'Manutenção' | 'Anulação' | null,
        },
        groups: {
          gCredPresOper: bool(r.CLTR_IND_GCREDPRESOPER) ? 'allowed' : 'forbidden',
          gMonoPadrao: reqForb(r.CLTR_IND_GMONOPADRAO),
          gMonoReten: reqForb(r.CLTR_IND_GMONORETEN),
          gMonoRet: reqForb(r.CLTR_IND_GMONORET),
          gMonoDif: reqForb(r.CLTR_IND_GMONODIF),
          gEstornoCred: reqForb(r.CLTR_IND_GESTORNOCRED),
        },
        treatments: byValidity(
          trcl.filter((x) => x.c === id).map((x) => ({ treatment: Number(x.t), validity: vig(x.f, x.e) })),
          (x) => String(x.treatment).padStart(3, '0'),
        ),
        reductions: byValidity(
          pere.filter((x) => x.c === id).map((x) => ({ tributo: trib(x.t), pRed: dec(x.v), validity: vig(x.f, x.e) })),
          (x) => x.tributo,
        ),
        fixedRates: byValidity(
          aadv.filter((x) => x.c === id).map((x) => ({ tributo: trib(x.t), rate: dec(x.v), validity: vig(x.f, x.e) })),
          (x) => x.tributo,
        ),
        dfe: byValidity(
          tdcl
            .filter((x) => x.c === id)
            .map((x) => ({ sigla: str(x.s), modelo: Number(x.m), validity: vig(x.f, x.e) })),
          (x) => String(x.modelo).padStart(3, '0'),
        ),
        basis: byValidity(
          fund
            .filter((x) => x.c === id)
            .map((x) => ({ short: str(x.short), text: str(x.texto), reference: str(x.ref), validity: vig(x.f, x.e) })),
          (x) => x.short,
        ),
        memoriaTemplate: str(r.CLTR_MEMORIA_CALCULO),
        validity,
        updatedAt: isoDate(optStr(r.CLTR_DATA_ATUALIZACAO)),
      };
    }),
    (x) => x.key,
  );
  const classTribById = new Map(classTrib.map((c) => [c._id, c]));
  const ct = (id: unknown): CalcClassTrib => {
    const c = classTribById.get(Number(id));
    if (!c) throw new Error(`CLTR_ID ${String(id)} inexistente`);
    return c;
  };

  // ---------------- anexos e aplicabilidade ----------------
  const annexRows = q('select * from ANEXO');
  const annexKey = (r: Row): string =>
    `${str(r.ANXO_NUMERO)}${r.ANXO_NUMERO_ITEM ? `/${str(r.ANXO_NUMERO_ITEM)}` : ''}`;
  const annexById = new Map(annexRows.map((r) => [r.ANXO_ID, annexKey(r)]));
  const annexes: AnnexRecord[] = sortBy(
    annexRows.map((r): AnnexRecord => {
      const validity = vig(r.ANXO_INICIO_VIGENCIA, r.ANXO_FIM_VIGENCIA);
      return {
        key: `${annexKey(r)}@${validity.from}`,
        annex: str(r.ANXO_NUMERO),
        item: optStr(r.ANXO_NUMERO_ITEM),
        description: optStr(r.ANXO_DESCRICAO),
        text: optStr(r.ANXO_TEXTO_ITEM),
        validity,
      };
    }),
    (x) => x.key,
  );

  const applicability = (table: 'NCM' | 'NBS'): ApplicabilityRecord[] => {
    const p = table === 'NCM' ? 'NCMA' : 'NBSA';
    const e = table === 'NCM' ? 'ENCM' : 'ENBS';
    const exc = q(
      `select ${e}_${p}_ID a, ${e}_${table}_CD cd, ${e}_INICIO_VIGENCIA f, ${e}_FIM_VIGENCIA e from EXCECAO_${table}_APLICAVEL`,
    );
    return sortBy(
      q(`select * from ${table}_APLICAVEL`).map((r): ApplicabilityRecord => {
        const c = ct(r[`${p}_CLTR_ID`]);
        const validity = vig(r[`${p}_INICIO_VIGENCIA`], r[`${p}_FIM_VIGENCIA`]);
        const prefix = str(r[`${p}_${table}_CD`]);
        return {
          key: `${c.key}:${prefix}:${validity.from}`,
          classTribKey: c.key,
          family: c.family,
          cClassTrib: c.code,
          prefix,
          annexItem: annexById.get(r[`${p}_ANXO_ID`]) ?? null,
          validity,
          exceptions: sortBy(
            exc.filter((x) => x.a === r[`${p}_ID`]).map((x) => ({ prefix: str(x.cd), validity: vig(x.f, x.e) })),
            (x) => `${x.prefix}@${x.validity.from}`,
          ),
        };
      }),
      (x) => `${x.key} ${JSON.stringify([x.annexItem, x.validity.to, x.exceptions])}`,
    );
  };
  // O mesmo prefixo pode aparecer mais de uma vez para o mesmo código (vínculo genérico duplicado por exceção, ver
  // NcmAplicavelService). A ordem é pelo conteúdo, nunca pelo id interno, e o desempate vira um sufixo ordinal.
  const ncmApplicability = ordinalKeys(applicability('NCM'));
  const nbsApplicability = ordinalKeys(applicability('NBS'));

  const ioic = new Map(
    q('select IOIC_ID id, IOIC_CD cd from INDICADOR_OPERACAO_IBS_CBS').map((r) => [r.id, str(r.cd)]),
  );
  // A tabela oficial tem linhas repetidas por inteiro; ficam todas, com sufixo ordinal na chave.
  const nfseNbs: NfseNbsRecord[] = ordinalKeys(
    sortBy(
      q('select * from CLASSIF_NBS_INDOP_LC').map((r): NfseNbsRecord => {
        const c = ct(r.CNIL_CLTR_ID);
        const validity = vig(r.CNIL_INICIO_VIGENCIA, r.CNIL_FIM_VIGENCIA);
        const cIndOp = ioic.get(r.CNIL_IOIC_ID);
        if (!cIndOp) throw new Error(`cIndOp ${String(r.CNIL_IOIC_ID)} inexistente`);
        return {
          key: `${str(r.CNIL_NBS_CD)}:${c.key}:${str(r.CNIL_LSLC_CD)}:${cIndOp}:${bool(r.CNIL_IN_PS_ONEROSA) ? 1 : 0}:${bool(r.CNIL_IN_ADQ_EXTERIOR) ? 1 : 0}:${validity.from}`,
          nbs: str(r.CNIL_NBS_CD),
          classTribKey: c.key,
          cClassTrib: c.code,
          itemLc116: str(r.CNIL_LSLC_CD),
          cIndOp,
          onerosa: bool(r.CNIL_IN_PS_ONEROSA),
          adquirenteExterior: bool(r.CNIL_IN_ADQ_EXTERIOR),
          validity,
        };
      }),
      (x) => `${x.key} ${x.validity.to ?? ''}`,
    ),
  );

  // ---------------- atores ----------------
  const actorGroups: ActorGroupRecord[] = sortBy(
    q('select * from GRUPO_ATOR').map((r) => ({
      key: String(r.GRAT_ID).padStart(3, '0'),
      id: Number(r.GRAT_ID),
      description: str(r.GRAT_DESCRICAO),
      order: Number(r.GRAT_ORDEM),
      validity: vig(r.GRAT_INICIO_VIGENCIA, r.GRAT_FIM_VIGENCIA),
    })),
    (x) => x.key,
  );
  const actors: ActorRecord[] = sortBy(
    q('select * from ATOR').map((r) => ({
      key: String(r.ATOR_ID).padStart(3, '0'),
      id: Number(r.ATOR_ID),
      group: Number(r.ATOR_GRAT_ID),
      description: str(r.ATOR_DESCRICAO),
      order: Number(r.ATOR_ORDEM),
      validity: vig(r.ATOR_INICIO_VIGENCIA, r.ATOR_FIM_VIGENCIA),
    })),
    (x) => x.key,
  );
  const actorClassTrib: ActorClassTribRecord[] = sortBy(
    q('select * from ATOR_CLASSIFICACAO').map((r): ActorClassTribRecord => {
      const c = ct(r.ATCL_CLTR_ID);
      const validity = vig(r.ATCL_INICIO_VIGENCIA, r.ATCL_FIM_VIGENCIA);
      return {
        key: `${String(r.ATCL_ATOR_ID).padStart(3, '0')}:${str(r.ATCL_IN_PAPEL)}:${c.key}:${validity.from}`,
        actor: Number(r.ATCL_ATOR_ID),
        role: str(r.ATCL_IN_PAPEL) as 'Fornecedor' | 'Adquirente',
        classTribKey: c.key,
        cClassTrib: c.code,
        validity,
      };
    }),
    (x) => x.key,
  );

  const dfeTypes: DfeTypeRecord[] = sortBy(
    q('select * from TIPO_DFE').map((r) => ({
      key: String(r.TPDF_TIPO).padStart(3, '0'),
      sigla: str(r.TPDF_SIGLA),
      modelo: Number(r.TPDF_TIPO),
      description: str(r.TPDF_DESCRICAO).trim(),
      validity: vig(r.TPDF_INICIO_VIGENCIA, r.TPDF_FIM_VIGENCIA),
    })),
    (x) => x.key,
  );

  // ---------------- compras governamentais e alíquotas de referência ----------------
  const govPurchaseReducer: GovPurchaseReducerRecord[] = sortBy(
    q('select RCGO_VALOR v, RCGO_INICIO_VIGENCIA f, RCGO_FIM_VIGENCIA e from REDUTOR_COMPRA_GOVERNAMENTAL').map((r) => {
      const validity = vig(r.f, r.e);
      return { key: validity.from, pRedutor: dec(r.v), validity };
    }),
    (x) => x.key,
  );
  const cbsTransfer: CbsTransferRecord[] = sortBy(
    q('select TCEG_VALOR v, TCEG_INICIO_VIGENCIA f, TCEG_FIM_VIGENCIA e from TRANSFERENCIA_CBS_ENTE_GOV').map((r) => {
      const validity = vig(r.f, r.e);
      return { key: validity.from, percent: dec(r.v), validity };
    }),
    (x) => x.key,
  );
  const padrao = Number(q('select count(*) n from ALIQUOTA_PADRAO')[0]?.n ?? 0);
  if (padrao > 0) {
    // A tabela de alíquota padrão por ente estava vazia até a V0057. Quando vier preenchida, o extrator precisa
    // levá-la para o `@sinete/ibs-cbs/aliquotas`; falhar aqui é melhor do que ignorar dado oficial em silêncio.
    throw new Error(`ALIQUOTA_PADRAO tem ${padrao} linha(s): o extrator ainda não leva alíquota por ente`);
  }
  const referenceRates = sortBy(
    q('select ALRE_TBTO_ID t, ALRE_VALOR v, ALRE_INICIO_VIGENCIA f, ALRE_FIM_VIGENCIA e from ALIQUOTA_REFERENCIA').map(
      (r) => ({ tributo: trib(r.t), rate: dec(r.v), validity: vig(r.f, r.e) }),
    ),
    (x) => `${x.tributo}@${x.validity.from}`,
  );

  return {
    versao,
    cst,
    classTrib,
    treatments,
    ncmApplicability,
    nbsApplicability,
    annexes,
    nfseNbs,
    actorGroups,
    actors,
    actorClassTrib,
    dfeTypes,
    govPurchaseReducer,
    cbsTransfer,
    referenceRates,
  };
}
