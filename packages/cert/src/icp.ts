/**
 * Identidade ICP-Brasil do titular, lida dos `otherName` do SubjectAltName.
 *
 * Fonte: DOC-ICP-04 (Requisitos mínimos para as políticas de certificado na ICP-Brasil), item 7.1.2.3, que define os
 * OIDs sob 2.16.76.1.3 e o leiaute posicional de cada um:
 *
 * - 2.16.76.1.3.1 (e-CPF, titular) e 2.16.76.1.3.4 (e-CNPJ, responsável): data de nascimento (8, `ddmmaaaa`),
 *   CPF (11), NIS (11), RG (15) e órgão expedidor com UF (10).
 * - 2.16.76.1.3.2 (e-CNPJ): nome do responsável.
 * - 2.16.76.1.3.3 (e-CNPJ): CNPJ (14).
 * - 2.16.76.1.3.5 (e-CPF): título de eleitor; 2.16.76.1.3.6 e 2.16.76.1.3.7: CEI de PF e de PJ (ignorados aqui).
 *
 * Campo não informado vem com zeros. Sem os OIDs (certificado fora da ICP-Brasil ou emitido com defeito), cai no
 * padrão `NOME:DOCUMENTO` do CN, e `source` diz de onde veio.
 */

import type { CertificateInfo } from './x509.ts';

export const ICP_OIDS = {
  pessoaFisicaTitular: '2.16.76.1.3.1',
  nomeResponsavel: '2.16.76.1.3.2',
  cnpj: '2.16.76.1.3.3',
  pessoaFisicaResponsavel: '2.16.76.1.3.4',
  tituloEleitor: '2.16.76.1.3.5',
  ceiPessoaFisica: '2.16.76.1.3.6',
  ceiPessoaJuridica: '2.16.76.1.3.7',
} as const;

/** Dados de pessoa física do leiaute posicional (titular do e-CPF ou responsável do e-CNPJ). */
export interface IcpPessoa {
  readonly cpf: string;
  /** `AAAA-MM-DD`, quando informada. */
  readonly dataNascimento: string | undefined;
  readonly nome: string | undefined;
}

export interface IcpIdentity {
  /** `e-CNPJ` quando há CNPJ, `e-CPF` quando há só CPF, `desconhecido` quando nenhum dos dois aparece. */
  readonly tipo: 'e-CNPJ' | 'e-CPF' | 'desconhecido';
  readonly cnpj: string | undefined;
  readonly cpf: string | undefined;
  /** Titular do e-CPF ou responsável pelo e-CNPJ. */
  readonly pessoa: IcpPessoa | undefined;
  /** Nome do titular sem o sufixo `:DOCUMENTO` do CN. */
  readonly nome: string | undefined;
  /** `san` quando veio dos `otherName` da ICP-Brasil, `cn` quando só do CN. */
  readonly source: 'san' | 'cn' | 'nenhuma';
}

/**
 * CNPJ numérico ou alfanumérico (IN RFB 2.229/2024: 12 posições `[A-Z0-9]` e 2 dígitos verificadores numéricos). A
 * pontuação cai; as letras ficam, em maiúsculas.
 */
const CNPJ = /^[A-Z0-9]{12}\d{2}$/;
const cnpjOnly = (s: string): string => s.replace(/[.\-/\s]/g, '').toUpperCase();
const allZero = (s: string): boolean => /^0*$/.test(s);

function parsePessoa(value: string, nome: string | undefined): IcpPessoa | undefined {
  const v = value.replace(/\s+$/, '');
  if (v.length < 19) return undefined;
  const nasc = v.slice(0, 8);
  const cpf = v.slice(8, 19);
  if (!/^\d{11}$/.test(cpf) || allZero(cpf)) return undefined;
  const dataNascimento =
    /^\d{8}$/.test(nasc) && !allZero(nasc) ? `${nasc.slice(4, 8)}-${nasc.slice(2, 4)}-${nasc.slice(0, 2)}` : undefined;
  return { cpf, dataNascimento, nome };
}

/** Extrai CNPJ, CPF e responsável de um certificado ICP-Brasil. Nunca lança: sem dados, `tipo` é `desconhecido`. */
export function icpIdentity(cert: CertificateInfo): IcpIdentity {
  const other = new Map(cert.subjectAltNames.otherNames.map((o) => [o.oid, o.value]));
  const cn = cert.subject.commonName;
  const cnMatch = cn ? /^(.*?):(\d{11}|[A-Za-z0-9]{12}\d{2})$/.exec(cn.trim()) : null;
  const nome = cnMatch ? cnMatch[1]?.trim() : cn;

  const cnpjRaw = other.get(ICP_OIDS.cnpj);
  const cnpj = cnpjRaw !== undefined && CNPJ.test(cnpjOnly(cnpjRaw)) ? cnpjOnly(cnpjRaw) : undefined;
  if (cnpj && !allZero(cnpj)) {
    const resp = other.get(ICP_OIDS.pessoaFisicaResponsavel);
    const nomeResp = other.get(ICP_OIDS.nomeResponsavel)?.trim() || undefined;
    return {
      tipo: 'e-CNPJ',
      cnpj,
      cpf: undefined,
      pessoa: resp === undefined ? undefined : parsePessoa(resp, nomeResp),
      nome,
      source: 'san',
    };
  }
  const titular = other.get(ICP_OIDS.pessoaFisicaTitular);
  const pessoa = titular === undefined ? undefined : parsePessoa(titular, nome);
  if (pessoa) return { tipo: 'e-CPF', cnpj: undefined, cpf: pessoa.cpf, pessoa, nome, source: 'san' };

  const doc = cnMatch?.[2];
  if (doc?.length === 14)
    return { tipo: 'e-CNPJ', cnpj: doc.toUpperCase(), cpf: undefined, pessoa: undefined, nome, source: 'cn' };
  if (doc?.length === 11) return { tipo: 'e-CPF', cnpj: undefined, cpf: doc, pessoa: undefined, nome, source: 'cn' };
  return { tipo: 'desconhecido', cnpj: undefined, cpf: undefined, pessoa: undefined, nome, source: 'nenhuma' };
}
