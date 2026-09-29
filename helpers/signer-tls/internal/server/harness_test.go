package server

import (
	"bufio"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/audit"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

// client é o lado do cliente do protocolo, escrito à parte do helper para o teste não depender do código testado.
type client struct {
	t       *testing.T
	in      *io.PipeWriter
	mu      sync.Mutex
	next    atomic.Int64
	pending map[string]chan protocol.Frame
	onSign  func(params map[string]any) (any, *protocol.Error)
	done    chan error
	audit   *syncBuf
}

type syncBuf struct {
	mu sync.Mutex
	b  []byte
}

func (s *syncBuf) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.b = append(s.b, p...)
	return len(p), nil
}

func (s *syncBuf) String() string { s.mu.Lock(); defer s.mu.Unlock(); return string(s.b) }

func newClient(t *testing.T, guard *policy.Guard) *client {
	t.Helper()
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	c := &client{t: t, in: inW, pending: map[string]chan protocol.Frame{}, done: make(chan error, 1), audit: &syncBuf{}}
	cfg := Config{Version: "test", Guard: guard, Ambientes: []string{"homologacao"}, Audit: audit.New(c.audit, ""), Logf: t.Logf}
	go func() {
		err := Serve(cfg, inR, outW)
		_ = outW.Close()
		c.done <- err
	}()
	go func() {
		sc := bufio.NewScanner(outR)
		sc.Buffer(make([]byte, 1<<16), protocol.MaxFrameBytes)
		for sc.Scan() {
			var f protocol.Frame
			if err := json.Unmarshal(sc.Bytes(), &f); err != nil {
				t.Errorf("frame inválido do helper: %v", err)
				continue
			}
			if f.V != protocol.Version {
				t.Errorf("frame sem v=1: %s", sc.Text())
			}
			if f.Method == "sign" {
				go c.answerSign(f)
				continue
			}
			c.mu.Lock()
			ch := c.pending[f.ID]
			c.mu.Unlock()
			if ch != nil {
				ch <- f
			}
		}
	}()
	t.Cleanup(func() { _ = inW.Close() })
	return c
}

func (c *client) answerSign(f protocol.Frame) {
	var p map[string]any
	_ = json.Unmarshal(f.Params, &p)
	if c.onSign == nil {
		return // sem resposta: o helper estoura o prazo
	}
	res, perr := c.onSign(p)
	out := protocol.Frame{V: 1, ID: f.ID, Error: perr}
	if perr == nil {
		out.Result, _ = json.Marshal(res)
	}
	c.write(out)
}

func (c *client) write(f protocol.Frame) {
	b, _ := json.Marshal(f)
	c.mu.Lock()
	defer c.mu.Unlock()
	_, _ = c.in.Write(append(b, '\n'))
}

// raw manda um frame pronto e espera a resposta com o mesmo id.
func (c *client) raw(f protocol.Frame) protocol.Frame {
	ch := make(chan protocol.Frame, 1)
	c.mu.Lock()
	c.pending[f.ID] = ch
	c.mu.Unlock()
	c.write(f)
	select {
	case r := <-ch:
		return r
	case <-time.After(30 * time.Second):
		c.t.Fatalf("sem resposta para %s", f.ID)
		return protocol.Frame{}
	}
}

func (c *client) call(method string, params any) (map[string]any, *protocol.Error) {
	raw, _ := json.Marshal(params)
	r := c.raw(protocol.Frame{V: 1, ID: fmt.Sprintf("c%d", c.next.Add(1)), Method: method, Params: raw})
	if r.Error != nil {
		return nil, r.Error
	}
	var out map[string]any
	_ = json.Unmarshal(r.Result, &out)
	return out, nil
}

func (c *client) mustCall(method string, params any) map[string]any {
	c.t.Helper()
	r, err := c.call(method, params)
	if err != nil {
		c.t.Fatalf("%s: %v", method, err)
	}
	return r
}

// keySigner responde aos sign com uma chave RSA em memória, nos dois modos.
func keySigner(k *rsa.PrivateKey, seen *[]map[string]any, mu *sync.Mutex) func(map[string]any) (any, *protocol.Error) {
	return func(p map[string]any) (any, *protocol.Error) {
		if mu != nil {
			mu.Lock()
			*seen = append(*seen, p)
			mu.Unlock()
		}
		var digest []byte
		switch p["mode"] {
		case "digest":
			digest, _ = base64.StdEncoding.DecodeString(p["digest"].(string))
		case "message":
			msg, _ := base64.StdEncoding.DecodeString(p["message"].(string))
			sum := sha256.Sum256(msg)
			digest = sum[:]
		}
		sig, err := rsa.SignPKCS1v15(rand.Reader, k, crypto.SHA256, digest)
		if err != nil {
			return nil, &protocol.Error{Code: "error", Message: err.Error()}
		}
		return map[string]string{"signature": base64.StdEncoding.EncodeToString(sig)}, nil
	}
}

// lab é o servidor TLS local: exige certificado de cliente da AC de teste e devolve o CN recebido.
type lab struct {
	ca     *testpki.CA
	url    string
	ipURL  string
	closer func()
}

func startServer(t *testing.T, ca *testpki.CA, mutate func(*tls.Config), handler http.HandlerFunc) *lab {
	t.Helper()
	srv := ca.Server()
	pool := x509.NewCertPool()
	pool.AddCert(ca.Cert)
	cfg := &tls.Config{
		Certificates: []tls.Certificate{{Certificate: [][]byte{srv.DER}, PrivateKey: srv.Key}},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    pool,
		MinVersion:   tls.VersionTLS12,
	}
	if mutate != nil {
		mutate(cfg)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	if handler == nil {
		handler = func(w http.ResponseWriter, r *http.Request) {
			cn := ""
			if r.TLS != nil && len(r.TLS.PeerCertificates) > 0 {
				cn = r.TLS.PeerCertificates[0].Subject.CommonName
			}
			w.Header().Set("content-type", "text/plain")
			w.Header().Add("x-multi", "a")
			w.Header().Add("x-multi", "b")
			_, _ = io.WriteString(w, "cn="+cn)
		}
	}
	// Sem h2: com só a suíte de troca RSA o ServeTLS recusaria configurar o HTTP/2 e não aceitaria conexão.
	hs := &http.Server{Handler: handler, TLSConfig: cfg, ReadHeaderTimeout: 5 * time.Second, ErrorLog: log.New(io.Discard, "", 0), TLSNextProto: map[string]func(*http.Server, *tls.Conn, http.Handler){}}
	go func() { _ = hs.ServeTLS(ln, "", "") }()
	port := ln.Addr().(*net.TCPAddr).Port
	l := &lab{ca: ca, url: fmt.Sprintf("https://localhost:%d/", port), ipURL: fmt.Sprintf("https://127.0.0.1:%d/", port), closer: func() { _ = hs.Close() }}
	t.Cleanup(l.closer)
	return l
}

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }
