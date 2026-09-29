// Package server liga os métodos do protocolo v1 a um canal. Cada canal (o stdio, ou cada conexão do socket Unix)
// tem as próprias identidades: uma conexão não enxerga nem usa a identidade aberta por outra.
package server

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/audit"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/pool"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/signer"
)

// Config é o que vale para o processo inteiro.
type Config struct {
	Version   string
	Guard     *policy.Guard
	Ambientes []string
	Audit     *audit.Log
	Logf      func(string, ...any)
	// ExtraRoots são PEMs de AC passados na linha de comando, somados à confiança de toda identidade.
	ExtraRoots []string
}

const (
	defaultSignTimeout = 30 * time.Second
	maxSignTimeout     = 5 * time.Minute
)

type entry struct {
	ident *signer.Identity
	pool  *pool.Pool
}

// Session é o estado de um canal.
type Session struct {
	cfg  Config
	peer *protocol.Peer
	mu   sync.Mutex
	ids  map[string]*entry
}

// Serve atende um canal até EOF e fecha as identidades abertas nele.
func Serve(cfg Config, in io.Reader, out io.Writer) error {
	s := &Session{cfg: cfg, peer: protocol.NewPeer(out, cfg.Logf), ids: map[string]*entry{}}
	s.peer.Handle("hello", s.hello)
	s.peer.Handle("identity.open", s.identityOpen)
	s.peer.Handle("identity.close", s.identityClose)
	s.peer.Handle("http.request", s.httpRequest)
	s.peer.Handle("pool.reset", s.poolReset)
	s.peer.Handle("stats", s.stats)
	s.peer.Handle("dfe.sign", s.dfeSign)
	err := s.peer.Serve(in)
	s.mu.Lock()
	for id, e := range s.ids {
		e.pool.Close()
		_ = e.ident.Close()
		delete(s.ids, id)
	}
	s.mu.Unlock()
	return err
}

func decode(raw json.RawMessage, v any) error {
	if err := json.Unmarshal(raw, v); err != nil {
		return protocol.Errorf(protocol.CodeBadRequest, "parâmetros inválidos: %v", err)
	}
	return nil
}

func (s *Session) hello(_ context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		Protocol int    `json:"protocol"`
		Client   string `json:"client"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	if p.Protocol != 0 && p.Protocol != protocol.Version {
		return nil, protocol.Errorf(protocol.CodeProtocolVersion, "helper fala v%d, cliente pediu v%d", protocol.Version, p.Protocol)
	}
	backends := []string{"remote"}
	if signer.HasPKCS11 {
		backends = append(backends, "pkcs11")
	}
	amb := s.cfg.Ambientes
	if s.cfg.Guard.Lab {
		amb = []string{"laboratorio"}
	}
	return map[string]any{
		"protocol":    protocol.Version,
		"helper":      "sinete-signer/" + s.cfg.Version,
		"go":          runtime.Version(),
		"lab":         s.cfg.Guard.Lab,
		"ambientes":   amb,
		"backends":    backends,
		"signModes":   []string{"digest", "message"},
		"schemes":     []string{"rsa_pkcs1_sha256"},
		"methods":     []string{"hello", "identity.open", "identity.close", "http.request", "pool.reset", "stats", "dfe.sign", "cancel"},
		"dataVersion": policy.DataVersion,
	}, nil
}

func decodeChain(in []string) ([][]byte, error) {
	out := make([][]byte, 0, len(in))
	for i, c := range in {
		der, err := base64.StdEncoding.DecodeString(c)
		if err != nil || len(der) == 0 {
			return nil, protocol.Errorf(protocol.CodeBadRequest, "chain[%d] não é DER em base64", i)
		}
		out = append(out, der)
	}
	return out, nil
}

func (s *Session) identityOpen(_ context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		ID            string   `json:"id"`
		Backend       string   `json:"backend"`
		Chain         []string `json:"chain"`
		Mode          string   `json:"mode"`
		SignTimeoutMs int      `json:"signTimeoutMs"`
		Module        string   `json:"module"`
		Token         string   `json:"token"`
		Serial        string   `json:"serial"`
		Label         string   `json:"label"`
		KeyID         string   `json:"keyId"` // CKA_ID em hexadecimal
		Pin           string   `json:"pin"`
		AdditionalCa  []string `json:"additionalCa"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	if p.ID == "" || len(p.ID) > 128 {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "id obrigatório, até 128 caracteres")
	}
	s.mu.Lock()
	_, exists := s.ids[p.ID]
	s.mu.Unlock()
	if exists {
		return nil, protocol.Errorf(protocol.CodeIdentityExists, "identidade %q já aberta; feche antes com identity.close", p.ID)
	}
	chain, err := decodeChain(p.Chain)
	if err != nil {
		return nil, err
	}
	var ident *signer.Identity
	switch p.Backend {
	case "remote":
		timeout := defaultSignTimeout
		if p.SignTimeoutMs > 0 {
			timeout = min(time.Duration(p.SignTimeoutMs)*time.Millisecond, maxSignTimeout)
		}
		mode := p.Mode
		if mode == "" {
			mode = "digest"
		}
		ident, err = signer.NewRemote(p.ID, chain, mode, s.peer, timeout)
	case "pkcs11":
		var keyID []byte
		if p.KeyID != "" {
			if keyID, err = hex.DecodeString(p.KeyID); err != nil {
				return nil, protocol.Errorf(protocol.CodeBadRequest, "keyId não é hexadecimal")
			}
		}
		ident, err = signer.OpenPKCS11(p.ID, signer.P11Params{Module: p.Module, Token: p.Token, Serial: p.Serial, Label: p.Label, KeyID: keyID, Pin: p.Pin, Extra: chain})
	default:
		return nil, protocol.Errorf(protocol.CodeBadRequest, "backend desconhecido: %q (remote ou pkcs11)", p.Backend)
	}
	if err != nil {
		return nil, err
	}
	roots, err := s.cfg.Guard.Roots(append(append([]string{}, s.cfg.ExtraRoots...), p.AdditionalCa...))
	if err != nil {
		_ = ident.Close()
		return nil, protocol.Errorf(protocol.CodeBadRequest, "%v", err)
	}
	e := &entry{ident: ident, pool: pool.New(ident, s.cfg.Guard, roots, tls.RenegotiateOnceAsClient)}
	s.mu.Lock()
	if _, exists := s.ids[p.ID]; exists {
		s.mu.Unlock()
		e.pool.Close()
		_ = ident.Close()
		return nil, protocol.Errorf(protocol.CodeIdentityExists, "identidade %q já aberta", p.ID)
	}
	s.ids[p.ID] = e
	s.mu.Unlock()
	holder := signer.HolderOf(ident.Leaf)
	res := map[string]any{
		"id":        ident.ID,
		"backend":   ident.Backend,
		"mode":      ident.Mode,
		"subject":   ident.Leaf.Subject.String(),
		"notBefore": ident.Leaf.NotBefore.UTC().Format(time.RFC3339),
		"notAfter":  ident.Leaf.NotAfter.UTC().Format(time.RFC3339),
		"chain":     encodeChain(ident.Chain),
		"dfeSign":   ident.Key != nil,
	}
	if holder.CNPJ != "" {
		res["cnpj"] = holder.CNPJ
	}
	if holder.CPF != "" {
		res["cpf"] = holder.CPF
	}
	return res, nil
}

func encodeChain(chain [][]byte) []string {
	out := make([]string, len(chain))
	for i, c := range chain {
		out[i] = base64.StdEncoding.EncodeToString(c)
	}
	return out
}

func (s *Session) get(id string) (*entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.ids[id]
	if e == nil {
		return nil, protocol.Errorf(protocol.CodeUnknownIdentity, "identidade %q não aberta", id)
	}
	return e, nil
}

func (s *Session) identityClose(_ context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		Identity string `json:"identity"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	s.mu.Lock()
	e := s.ids[p.Identity]
	delete(s.ids, p.Identity)
	s.mu.Unlock()
	if e == nil {
		return nil, protocol.Errorf(protocol.CodeUnknownIdentity, "identidade %q não aberta", p.Identity)
	}
	e.pool.Close()
	if err := e.ident.Close(); err != nil {
		return nil, protocol.Errorf(protocol.CodePKCS11, "fechar a sessão: %v", err)
	}
	return map[string]any{"closed": true}, nil
}

func (s *Session) httpRequest(ctx context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		Identity  string            `json:"identity"`
		URL       string            `json:"url"`
		Method    string            `json:"method"`
		Headers   map[string]string `json:"headers"`
		Body      string            `json:"body"`
		TimeoutMs int               `json:"timeoutMs"`
		FreshConn bool              `json:"freshConn"`
		Service   string            `json:"service"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	e, err := s.get(p.Identity)
	if err != nil {
		return nil, err
	}
	body, err := base64.StdEncoding.DecodeString(p.Body)
	if err != nil {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "body não é base64")
	}
	ev := audit.Event{Event: "http", Identity: p.Identity, Subject: e.ident.Leaf.Subject.CommonName, Service: p.Service}
	res, signed, err := e.pool.Do(ctx, pool.Request{URL: p.URL, Method: p.Method, Headers: p.Headers, Body: body, Timeout: time.Duration(p.TimeoutMs) * time.Millisecond, FreshConn: p.FreshConn})
	ev.Signatures = signed
	var pe *protocol.Error
	if err != nil {
		if errors.As(err, &pe) && pe.Code == protocol.CodeGuard {
			// Recusa antes do socket: registra sem host, que pode ser qualquer coisa.
			ev.Error = "guard"
		} else {
			ev.Host = hostOf(p.URL)
			ev.Error = err.Error()
		}
		s.cfg.Audit.Write(ev)
		return nil, err
	}
	ev.Host = hostOf(p.URL)
	ev.Status = res.Status
	s.cfg.Audit.Write(ev)
	return map[string]any{
		"status":  res.Status,
		"headers": res.Headers,
		"body":    base64.StdEncoding.EncodeToString(res.Body),
		"ms":      res.Ms,
		"tls":     res.TLS,
	}, nil
}

func hostOf(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

func (s *Session) poolReset(_ context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		Identity     string `json:"identity"`
		DropSessions bool   `json:"dropSessions"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	e, err := s.get(p.Identity)
	if err != nil {
		return nil, err
	}
	e.pool.Reset(p.DropSessions)
	return map[string]any{"ok": true}, nil
}

func (s *Session) stats(context.Context, json.RawMessage) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	keys := make([]string, 0, len(s.ids))
	for k := range s.ids {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := map[string]any{}
	for _, k := range keys {
		out[k] = map[string]any{"signatures": s.ids[k].ident.Signs.Load(), "backend": s.ids[k].ident.Backend}
	}
	return map[string]any{"identities": out}, nil
}

func (s *Session) dfeSign(_ context.Context, raw json.RawMessage) (any, error) {
	var p struct {
		Identity   string `json:"identity"`
		SignedInfo string `json:"signedInfo"`
		Hash       string `json:"hash"`
		Element    string `json:"element"`
	}
	if err := decode(raw, &p); err != nil {
		return nil, err
	}
	e, err := s.get(p.Identity)
	if err != nil {
		return nil, err
	}
	if e.ident.Key == nil {
		return nil, protocol.Errorf(protocol.CodeForbidden, "dfe.sign só vale para chave que o helper controla (pkcs11); no backend remote, o cliente já tem a chave")
	}
	si, err := base64.StdEncoding.DecodeString(p.SignedInfo)
	if err != nil || len(si) == 0 {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "signedInfo não é base64")
	}
	var el []byte
	if p.Element != "" {
		if el, err = base64.StdEncoding.DecodeString(p.Element); err != nil {
			return nil, protocol.Errorf(protocol.CodeBadRequest, "element não é base64")
		}
	}
	ev := audit.Event{Event: "dfe", Identity: p.Identity, Subject: e.ident.Leaf.Subject.CommonName}
	approved, err := signer.ValidateDfe(signer.DfeRequest{SignedInfo: si, Hash: p.Hash, Element: el}, signer.HolderOf(e.ident.Leaf))
	if err != nil {
		ev.Error = err.Error()
		s.cfg.Audit.Write(ev)
		return nil, err
	}
	ev.Reference = approved.Reference
	ev.Service = approved.Kind
	sig, err := signer.SignDfe(e.ident.Key, approved, si)
	if err != nil {
		ev.Error = err.Error()
		s.cfg.Audit.Write(ev)
		return nil, err
	}
	e.ident.Signs.Add(1)
	ev.Signatures = 1
	s.cfg.Audit.Write(ev)
	return map[string]any{"signature": base64.StdEncoding.EncodeToString(sig), "reference": approved.Reference, "kind": approved.Kind}, nil
}
