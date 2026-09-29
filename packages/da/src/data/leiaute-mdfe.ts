/** Textos do DAMDFE, como dados (ADR 0006, decisão 2). */

import type { Fonte } from './leiaute.ts';

/** Endereço de consulta impresso no DAMDFE (MOC MDF-e 3.00a, Anexo II, 2.7, modelos de impressão). */
export const CONSULTA_MDFE: Fonte & { readonly url: string } = {
  source: 'MOC MDF-e 3.00a, Anexo II, 2.7.1 a 2.7.8; MOC MDF-e 3.00b, Visão Geral, 10.1',
  url: 'https://dfe-portal.svrs.rs.gov.br/MDFe/consulta',
};
