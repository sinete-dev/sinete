import { describe, expect, test } from 'bun:test';
import { ErroDeTempoEsgotado } from '@sinete/core';
import { classifyTransportFailure, http403Error } from '../src/index.ts';

const host = 'hom.exemplo.invalid';
const c = (err: unknown) => classifyTransportFailure(err, { host });
const e = (code: string | undefined, message: string, cause?: unknown) =>
  Object.assign(new Error(message), code ? { code } : {}, cause ? { cause } : {});

describe('mapa de falhas observadas (ADR 0004, seção 4)', () => {
  test.each([
    // OpenSSL (Node)
    [
      e('ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE', 'sslv3 alert bad certificate'),
      'certificado_nao_apresentado',
      'bad_certificate',
    ],
    [
      e('ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE', 'sslv3 alert handshake failure'),
      'certificado_nao_apresentado',
      'handshake_failure',
    ],
    [
      e('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED', 'tlsv13 alert certificate required'),
      'certificado_nao_apresentado',
      'certificate_required',
    ],
    [e('ERR_SSL_SSLV3_ALERT_CERTIFICATE_UNKNOWN', 'x'), 'certificado_recusado', 'certificate_unknown'],
    [e('ERR_SSL_TLSV1_ALERT_UNKNOWN_CA', 'tlsv1 alert unknown ca'), 'certificado_recusado', 'unknown_ca'],
    [e('ERR_SSL_SSLV3_ALERT_CERTIFICATE_EXPIRED', 'x'), 'certificado_recusado', 'certificate_expired'],
    [e('ERR_SSL_SSLV3_ALERT_CERTIFICATE_REVOKED', 'x'), 'certificado_recusado', 'certificate_revoked'],
    [e('ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'tlsv1 alert protocol version'), 'falha_tls', 'protocol_version'],
    // rustls (Deno)
    [
      e(undefined, 'client error (Connect): received fatal alert: BadCertificate'),
      'certificado_nao_apresentado',
      'bad_certificate',
    ],
    [e(undefined, 'received fatal alert: CertificateUnknown'), 'certificado_recusado', 'certificate_unknown'],
    [
      e(undefined, 'error sending request', e(undefined, 'received fatal alert: HandshakeFailure')),
      'certificado_nao_apresentado',
      'handshake_failure',
    ],
  ])('%p', (err, code, alert) => {
    const r = c(err);
    expect(r.code).toBe(code);
    expect(r.detalhes).toMatchObject({ host, alert });
    expect(r.cause).toBe(err);
  });

  test.each([
    [
      e('ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC', 'decryption failed or bad record mac'),
      'certificado_ausente_ou_recusado',
    ],
    [e(undefined, 'peer misbehaved: BadRecordMac'), 'certificado_ausente_ou_recusado'],
    [e('UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'unable to get local issuer certificate'), 'cadeia_servidor_nao_confiavel'],
    [e('SELF_SIGNED_CERT_IN_CHAIN', 'self-signed certificate in certificate chain'), 'cadeia_servidor_nao_confiavel'],
    [e(undefined, 'invalid peer certificate: UnknownIssuer'), 'cadeia_servidor_nao_confiavel'],
    [
      e('ERR_TLS_CERT_ALTNAME_INVALID', "Hostname/IP does not match certificate's altnames"),
      'nome_servidor_divergente',
    ],
    [e(undefined, 'invalid peer certificate: NotValidForName'), 'nome_servidor_divergente'],
    [e('ECONNRESET', 'socket hang up'), 'conexao_recusada'],
    [e('ECONNREFUSED', 'connect ECONNREFUSED'), 'conexao_recusada'],
    [e(undefined, 'connection reset'), 'conexao_recusada'],
    [e('ENOTFOUND', 'getaddrinfo ENOTFOUND'), 'falha_rede'],
    [e(undefined, 'dns error: failed to lookup address'), 'falha_rede'],
    [e('ERR_SSL_NO_SHARED_CIPHER', 'no shared cipher'), 'falha_tls'],
    [e(undefined, 'algo estranho'), 'falha_rede'],
    ['texto solto', 'falha_rede'],
    [null, 'falha_rede'],
  ])('%p', (err, code) => {
    expect(c(err).code).toBe(code);
  });

  test('chave que não casa vira ConfigError', () => {
    expect(c(e('ERR_OSSL_X509_KEY_VALUES_MISMATCH', 'key values mismatch')).code).toBe('config_invalida');
  });

  test('erro do sinete passa direto', () => {
    const t = new ErroDeTempoEsgotado('x', 1);
    expect(c(t)).toBe(t);
  });

  test('mensagem do alerta 40 avisa da ambiguidade', () => {
    expect(c(e('ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE', 'x')).message).toContain('cifra ou versão');
  });

  test('403', () => {
    expect(http403Error(host)).toMatchObject({
      code: 'certificado_ausente_ou_recusado',
      detalhes: { host, status: 403 },
    });
  });
});
