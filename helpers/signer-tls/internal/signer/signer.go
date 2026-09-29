// Package signer tem as identidades do helper: a cadeia pública e um jeito de assinar que não guarda a chave.
//
// O crypto/tls chama Sign (hash pronto) ou, desde o Go 1.25, SignMessage (transcript inteiro do handshake TLS 1.2)
// quando a chave implementa crypto.MessageSigner. Os backends:
//
//	remote digest:  o cliente assina o hash (PSC em RAW, OpenBao Transit prehashed, KeyObject no Node e no Bun)
//	remote message: o cliente assina o transcript (CryptoKey WebCrypto não exportável) e confere SNI e servidor nele
//	pkcs11:         o helper pede C_Sign com CKM_RSA_PKCS ao token (só no sabor com cgo)
package signer

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync/atomic"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
)

// PurposeTLS é o único propósito de assinatura de handshake.
const PurposeTLS = "tls12-client-certificate-verify"

// Só PKCS#1 v1.5: assinadores remotos e tokens não fazem PSS. O Go 1.25+ ainda descarta SHA-1 em TLS 1.2 sem
// GODEBUG=tlssha1=1, então na prática o CertificateVerify sai sempre rsa_pkcs1_sha256.
var pkcs1Only = []tls.SignatureScheme{tls.PKCS1WithSHA256}

// SchemeName devolve o nome do esquema no contrato.
func SchemeName(h crypto.Hash) (string, error) {
	switch h {
	case crypto.SHA256:
		return "rsa_pkcs1_sha256", nil
	case crypto.SHA1:
		return "rsa_pkcs1_sha1", nil
	}
	return "", fmt.Errorf("hash %v não permitido (só PKCS#1 v1.5 com SHA-256)", h)
}

// Context amarra cada assinatura ao handshake que o próprio helper iniciou.
type Context struct {
	Purpose   string `json:"purpose"`
	Host      string `json:"host"`
	Conn      int64  `json:"conn"`
	Handshake int    `json:"handshake"` // 1 = inicial, 2 = renegociação pedida pelo servidor
}

// Stat é uma assinatura feita, para a contabilidade por requisição.
type Stat struct {
	Scheme string  `json:"scheme"`
	Mode   string  `json:"mode"`
	Ms     float64 `json:"ms"`
}

// Hooks recebe o que aconteceu com cada assinatura da conexão.
type Hooks struct {
	OnSign  func(Stat)
	OnError func(error)
}

// Caller é o canal até o dono da chave (o Peer do protocolo).
type Caller interface {
	Call(ctx context.Context, method string, params any, timeout time.Duration, timeoutCode string) (json.RawMessage, error)
}

// Identity é o que o transporte usa: a cadeia pública e uma fábrica de chaves por handshake.
type Identity struct {
	ID      string
	Backend string // remote | pkcs11
	Mode    string // digest | message | pkcs11
	Chain   [][]byte
	Leaf    *x509.Certificate
	Signs   atomic.Int64
	// SignTimeout é o prazo de uma assinatura pedida ao dono da chave (zero no token, que assina localmente); o prazo
	// do handshake inicial soma este valor.
	SignTimeout time.Duration
	newKey      func(ctx Context, h Hooks) crypto.Signer
	// Key é a chave do token, para o dfe.sign; nil nos backends remotos, em que a chave nem passa pelo helper.
	Key    DigestSigner
	closer func() error
}

// DigestSigner assina um DigestInfo DER com RSA PKCS#1 v1.5 (C_Sign com CKM_RSA_PKCS).
type DigestSigner interface {
	SignDigestInfo(digestInfo []byte) ([]byte, error)
}

// Certificate monta o tls.Certificate de um handshake. A chave nasce aqui, dentro do GetClientCertificate de uma
// conexão que passou pela guarda: não existe outro caminho até o signer.
func (id *Identity) Certificate(ctx Context, h Hooks) *tls.Certificate {
	return &tls.Certificate{
		Certificate:                  id.Chain,
		Leaf:                         id.Leaf,
		PrivateKey:                   id.newKey(ctx, h),
		SupportedSignatureAlgorithms: pkcs1Only,
	}
}

// Close libera o que a identidade abriu (sessão PKCS#11).
func (id *Identity) Close() error {
	if id.closer == nil {
		return nil
	}
	return id.closer()
}

func parseChain(chain [][]byte) (*x509.Certificate, error) {
	if len(chain) == 0 {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "cadeia vazia")
	}
	leaf, err := x509.ParseCertificate(chain[0])
	if err != nil {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "folha da cadeia inválida: %v", err)
	}
	if _, ok := leaf.PublicKey.(*rsa.PublicKey); !ok {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "só chave RSA (os DF-e e a SEFAZ usam RSA com PKCS#1 v1.5)")
	}
	return leaf, nil
}

// NewRemote cria a identidade cuja chave fica com o cliente. mode é digest ou message.
func NewRemote(id string, chain [][]byte, mode string, caller Caller, signTimeout time.Duration) (*Identity, error) {
	if mode != "digest" && mode != "message" {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "mode inválido: %q (digest ou message)", mode)
	}
	leaf, err := parseChain(chain)
	if err != nil {
		return nil, err
	}
	ident := &Identity{ID: id, Backend: "remote", Mode: mode, Chain: chain, Leaf: leaf, SignTimeout: signTimeout}
	ident.newKey = func(ctx Context, h Hooks) crypto.Signer {
		base := remoteSigner{pub: leaf.PublicKey, caller: caller, ident: ident, ctx: ctx, hooks: h, timeout: signTimeout}
		if mode == "message" {
			return &remoteMessageSigner{base}
		}
		return &base
	}
	return ident, nil
}

type remoteSigner struct {
	pub     crypto.PublicKey
	caller  Caller
	ident   *Identity
	ctx     Context
	hooks   Hooks
	timeout time.Duration
}

func (s *remoteSigner) Public() crypto.PublicKey { return s.pub }

func (s *remoteSigner) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, s.fail(errors.New("RSA-PSS recusado: o signer só faz PKCS#1 v1.5"))
	}
	scheme, err := SchemeName(opts.HashFunc())
	if err != nil {
		return nil, s.fail(err)
	}
	return s.remote(scheme, opts.HashFunc(), digest, map[string]any{"digest": base64.StdEncoding.EncodeToString(digest)})
}

func (s *remoteSigner) fail(err error) error {
	if s.hooks.OnError != nil {
		s.hooks.OnError(err)
	}
	return err
}

func (s *remoteSigner) remote(scheme string, h crypto.Hash, digest []byte, payload map[string]any) ([]byte, error) {
	t0 := time.Now()
	payload["identity"] = s.ident.ID
	payload["scheme"] = scheme
	payload["mode"] = s.ident.Mode
	payload["context"] = s.ctx
	raw, err := s.caller.Call(context.Background(), "sign", payload, s.timeout, protocol.CodeSignTimeout)
	if err != nil {
		var pe *protocol.Error
		if errors.As(err, &pe) && pe.Code != protocol.CodeSignTimeout && pe.Code != protocol.CodeClosed {
			// Qualquer recusa do dono da chave vira sign_refused: o handshake aborta e o helper não tenta de novo.
			err = &protocol.Error{Code: protocol.CodeSignRefused, Message: pe.Message}
		}
		return nil, s.fail(err)
	}
	var r struct {
		Signature string `json:"signature"`
	}
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, s.fail(protocol.Errorf(protocol.CodeSignRefused, "resposta de sign inválida"))
	}
	sig, err := base64.StdEncoding.DecodeString(r.Signature)
	if err != nil || len(sig) == 0 {
		return nil, s.fail(protocol.Errorf(protocol.CodeSignRefused, "assinatura vazia ou fora de base64"))
	}
	// Confere antes de mandar ao servidor: uma assinatura errada vira alerta decrypt_error, que parece recusa do
	// certificado; aqui ela vira erro claro de quem assinou.
	if pub, ok := s.pub.(*rsa.PublicKey); ok {
		if err := rsa.VerifyPKCS1v15(pub, h, digest, sig); err != nil {
			return nil, s.fail(protocol.Errorf(protocol.CodeSignRefused, "a assinatura devolvida não confere com a chave pública da folha"))
		}
	}
	s.ident.Signs.Add(1)
	if s.hooks.OnSign != nil {
		s.hooks.OnSign(Stat{Scheme: scheme, Mode: s.ident.Mode, Ms: float64(time.Since(t0).Microseconds()) / 1000})
	}
	return sig, nil
}

// remoteMessageSigner manda o transcript inteiro (modo message), para quem só assina mensagem.
type remoteMessageSigner struct{ remoteSigner }

func (s *remoteMessageSigner) SignMessage(_ io.Reader, msg []byte, opts crypto.SignerOpts) ([]byte, error) {
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, s.fail(errors.New("RSA-PSS recusado"))
	}
	scheme, err := SchemeName(opts.HashFunc())
	if err != nil {
		return nil, s.fail(err)
	}
	if opts.HashFunc() != crypto.SHA256 {
		return nil, s.fail(fmt.Errorf("modo message só com SHA-256"))
	}
	sum := sha256.Sum256(msg)
	return s.remote(scheme, crypto.SHA256, sum[:], map[string]any{
		"message":       base64.StdEncoding.EncodeToString(msg),
		"messageSha256": base64.StdEncoding.EncodeToString(sum[:]),
	})
}

// Prefixos DER do DigestInfo (RFC 8017, seção 9.2, nota 1).
var digestInfoPrefix = map[crypto.Hash][]byte{
	crypto.SHA1:   {0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14},
	crypto.SHA256: {0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20},
}

// DigestInfo monta o DigestInfo DER de um hash pronto.
func DigestInfo(h crypto.Hash, digest []byte) ([]byte, error) {
	prefix, ok := digestInfoPrefix[h]
	if !ok || len(digest) != h.Size() {
		return nil, fmt.Errorf("hash %v com %d bytes", h, len(digest))
	}
	return append(append([]byte{}, prefix...), digest...), nil
}

// newTokenIdentity liga uma chave de token (ou qualquer DigestSigner local) à identidade.
func newTokenIdentity(id string, chain [][]byte, key DigestSigner, closer func() error) (*Identity, error) {
	leaf, err := parseChain(chain)
	if err != nil {
		return nil, err
	}
	ident := &Identity{ID: id, Backend: "pkcs11", Mode: "pkcs11", Chain: chain, Leaf: leaf, Key: key, closer: closer}
	ident.newKey = func(_ Context, h Hooks) crypto.Signer {
		return &tokenSigner{pub: leaf.PublicKey, key: key, ident: ident, hooks: h}
	}
	return ident, nil
}

type tokenSigner struct {
	pub   crypto.PublicKey
	key   DigestSigner
	ident *Identity
	hooks Hooks
}

func (s *tokenSigner) Public() crypto.PublicKey { return s.pub }

func (s *tokenSigner) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	fail := func(err error) error {
		if s.hooks.OnError != nil {
			s.hooks.OnError(err)
		}
		return err
	}
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, fail(errors.New("RSA-PSS recusado"))
	}
	scheme, err := SchemeName(opts.HashFunc())
	if err != nil {
		return nil, fail(err)
	}
	di, err := DigestInfo(opts.HashFunc(), digest)
	if err != nil {
		return nil, fail(err)
	}
	t0 := time.Now()
	sig, err := s.key.SignDigestInfo(di)
	if err != nil {
		return nil, fail(protocol.Errorf(protocol.CodePKCS11, "%v", err))
	}
	s.ident.Signs.Add(1)
	if s.hooks.OnSign != nil {
		s.hooks.OnSign(Stat{Scheme: scheme, Mode: "pkcs11", Ms: float64(time.Since(t0).Microseconds()) / 1000})
	}
	return sig, nil
}

// NewLocalForTest cria uma identidade com um DigestSigner local. Só para testes do pacote e do pool: o binário não
// expõe chave em memória no helper.
func NewLocalForTest(id string, chain [][]byte, key DigestSigner) (*Identity, error) {
	return newTokenIdentity(id, chain, key, nil)
}
