import { describe, expect, test } from 'bun:test';
import { createHash, X509Certificate } from 'node:crypto';
import data from '../src/data/icp-brasil.json' with { type: 'json' };
import { ICP_BRASIL_BUNDLE, icpBrasilCertificates, icpBrasilTlsPem, parseCertificate } from '../src/index.ts';

describe('bundle ICP-Brasil', () => {
  test('metadados de proveniência', () => {
    expect(ICP_BRASIL_BUNDLE.version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(ICP_BRASIL_BUNDLE.source.url).toBe(
      'http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip',
    );
    expect(ICP_BRASIL_BUNDLE.source.sha512).toMatch(/^[0-9a-f]{128}$/);
    expect(ICP_BRASIL_BUNDLE.excluded.map((e) => e.file)).toEqual(['ICP-Brasilv6.crt', 'ICP-Brasilv7.crt']);
  });

  test('raízes v5, v10, v11 e v12 e as três intermediárias SSL', () => {
    const certs = icpBrasilCertificates();
    expect(certs.filter((c) => c.kind === 'root').map((c) => c.id)).toEqual([
      'icp-brasil-v5',
      'icp-brasil-v10',
      'icp-brasil-v11',
      'icp-brasil-v12',
    ]);
    expect(certs.filter((c) => c.kind === 'intermediate').map((c) => c.subjectCN)).toEqual([
      'Autoridade Certificadora do SERPRO SSLv1',
      'AC SOLUTI SSL EV G4',
      'AC Certisign ICP-Brasil SSL EV G4',
    ]);
    expect(icpBrasilCertificates()).toBe(certs);
  });

  test('SHA-256, validade e titular declarados conferem com o DER', () => {
    for (const c of icpBrasilCertificates()) {
      const x = new X509Certificate(c.der);
      expect(x.fingerprint256).toBe(c.sha256);
      expect(createHash('sha256').update(c.der).digest('hex').toUpperCase()).toBe(c.sha256.replace(/:/g, ''));
      expect(parseCertificate(c.der).notAfterIso).toBe(c.notAfter);
      expect(x.subject).toContain(c.subjectCN);
    }
  });

  test('conjunto TLS em PEM que o runtime lê', () => {
    const pems = icpBrasilTlsPem();
    expect(pems).toHaveLength(data.certificates.length);
    for (const p of pems) expect(() => new X509Certificate(p)).not.toThrow();
  });
});
