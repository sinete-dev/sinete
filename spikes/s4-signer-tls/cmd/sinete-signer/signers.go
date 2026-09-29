// Spike S4: signers que não guardam a chave. O crypto/tls chama Sign (digest pronto) ou,
// desde o Go 1.25, SignMessage (transcript inteiro do handshake TLS 1.2) quando o signer
// implementa crypto.MessageSigner. Os dois modos existem porque os backends diferem:
//
//	digest:  PKCS#11, PSC (DOC-ICP-17.01 RAW), OpenBao Transit prehashed, KeyObject no Node/Bun
//	message: WebCrypto (CryptoKey não exportável só assina mensagem, não hash pronto)
package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"sync/atomic"
	"time"
)

// Só PKCS#1 v1.5: assinadores remotos (PSC RAW, OpenBao pkcs1v15, tokens antigos) não fazem PSS.
// SHA-1 fica na lista, mas o Go 1.25+ o descarta em TLS 1.2 sem GODEBUG=tlssha1=1.
var pkcs1Only = []tls.SignatureScheme{tls.PKCS1WithSHA256, tls.PKCS1WithSHA1}

func schemeName(h crypto.Hash) (string, error) {
	switch h {
	case crypto.SHA256:
		return "rsa_pkcs1_sha256", nil
	case crypto.SHA1:
		return "rsa_pkcs1_sha1", nil
	}
	return "", fmt.Errorf("hash %v não permitido (só PKCS#1 v1.5 SHA-256/SHA-1)", h)
}

// signContext amarra cada assinatura ao handshake que o próprio helper iniciou.
type signContext struct {
	Purpose   string `json:"purpose"` // sempre "tls12-client-certificate-verify" neste helper
	Host      string `json:"host"`
	Conn      int64  `json:"conn"`
	Handshake int    `json:"handshake"` // 1 = inicial, 2 = renegociação
}

type signStat struct {
	Scheme string  `json:"scheme"`
	Mode   string  `json:"mode"`
	Ms     float64 `json:"ms"`
}

// identity é o que o transporte usa: cadeia pública + um jeito de assinar.
type identity struct {
	ID      string
	Chain   [][]byte
	Leaf    *x509.Certificate
	Backend string // remote | pkcs11 | inproc
	newKey  func(ctx signContext, rec func(signStat)) crypto.Signer
	Signs   atomic.Int64
}

func (id *identity) certificate(ctx signContext, rec func(signStat)) *tls.Certificate {
	return &tls.Certificate{
		Certificate:                  id.Chain,
		Leaf:                         id.Leaf,
		PrivateKey:                   id.newKey(ctx, rec),
		SupportedSignatureAlgorithms: pkcs1Only,
	}
}

// ---------- backend remote: a chave mora no processo JS (ou atrás dele: PSC, OpenBao, navegador) ----------

type remoteDigestSigner struct {
	pub  crypto.PublicKey
	p    *peer
	id   *identity
	ctx  signContext
	rec  func(signStat)
	mode string
}

func (s *remoteDigestSigner) Public() crypto.PublicKey { return s.pub }

func (s *remoteDigestSigner) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, fmt.Errorf("RSA-PSS recusado: signer remoto só faz PKCS#1 v1.5")
	}
	scheme, err := schemeName(opts.HashFunc())
	if err != nil {
		return nil, err
	}
	return s.remote(scheme, map[string]any{"digest": base64.StdEncoding.EncodeToString(digest)})
}

func (s *remoteDigestSigner) remote(scheme string, payload map[string]any) ([]byte, error) {
	t0 := time.Now()
	payload["identity"] = s.id.ID
	payload["scheme"] = scheme
	payload["mode"] = s.mode
	payload["context"] = s.ctx
	raw, err := s.p.call("sign", payload, 30*time.Second)
	if err != nil {
		return nil, err
	}
	var r struct {
		Signature string `json:"signature"`
	}
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, err
	}
	sig, err := base64.StdEncoding.DecodeString(r.Signature)
	if err != nil {
		return nil, err
	}
	s.id.Signs.Add(1)
	s.rec(signStat{scheme, s.mode, float64(time.Since(t0).Microseconds()) / 1000})
	return sig, nil
}

// remoteMessageSigner manda o transcript inteiro (modo "message"), para WebCrypto.
type remoteMessageSigner struct{ remoteDigestSigner }

func (s *remoteMessageSigner) SignMessage(_ io.Reader, msg []byte, opts crypto.SignerOpts) ([]byte, error) {
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, fmt.Errorf("RSA-PSS recusado")
	}
	scheme, err := schemeName(opts.HashFunc())
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(msg)
	return s.remote(scheme, map[string]any{"message": base64.StdEncoding.EncodeToString(msg), "messageSha256": base64.StdEncoding.EncodeToString(sum[:])})
}

// ---------- backend inproc (só lab): chave Go em memória, linha de base para medir o custo do signer externo ----------

type timedSigner struct {
	k   crypto.Signer
	id  *identity
	rec func(signStat)
}

func (s *timedSigner) Public() crypto.PublicKey { return s.k.Public() }
func (s *timedSigner) Sign(r io.Reader, d []byte, o crypto.SignerOpts) ([]byte, error) {
	t0 := time.Now()
	sig, err := s.k.Sign(r, d, o)
	if err == nil {
		scheme, _ := schemeName(o.HashFunc())
		s.id.Signs.Add(1)
		s.rec(signStat{scheme, "inproc", float64(time.Since(t0).Microseconds()) / 1000})
	}
	return sig, err
}
