// Package pool é o transporte HTTP/1.1 com mTLS do helper: um pool keep-alive por identidade, cache de sessão TLS e
// a contabilidade de cada conexão (handshakes, renegociações, retomada, assinaturas pedidas), que o cliente usa para
// medir a cota de um PSC. Perfil TLS do ADR 0005, decisão 4: só TLS 1.2, só PKCS#1 no CertificateVerify, renegociação
// uma vez por conexão e só a pedido do servidor, nunca h2, nunca redirecionamento.
package pool

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/signer"
)

// Limites do helper. O corpo vai em base64 num frame de até 64 MiB.
const (
	MaxRequestBody  = 32 << 20
	MaxResponseBody = 32 << 20
	DefaultTimeout  = 60 * time.Second
	dialTimeout     = 15 * time.Second
)

// handshakeTimeout limita o handshake inicial, somado ao prazo de assinatura da identidade. O http.Transport desliga o
// contexto do dial do prazo da requisição, e o Dialer.Timeout só cobre o TCP: sem isto, um servidor que aceita e
// para de responder no meio do handshake prende o socket e a goroutine até o pool fechar. Variável para os testes.
var handshakeTimeout = 15 * time.Second

var connIDs atomic.Int64

// connStat acompanha uma conexão TLS.
type connStat struct {
	id          int64
	host        string
	mu          sync.Mutex
	handshakes  int
	resumed     []bool
	certReqs    int
	renegs      int
	initialDone bool
	// sigs guarda as assinaturas feitas sem requisição dona (as do handshake do dial); cur é a requisição que está
	// com a conexão, e as assinaturas feitas enquanto ela a tem (renegociação) vão direto para ela.
	sigs        []signer.Stat
	cur         *reqAcct
	handshakeMs []float64
	signErr     error
}

// trackedConn é a conexão que o http.Transport usa, com as estatísticas junto.
type trackedConn struct {
	*tls.Conn
	st *connStat
}

// Pool é o transporte de uma identidade.
type Pool struct {
	ident *signer.Identity
	guard *policy.Guard
	roots *x509.CertPool
	reneg tls.RenegotiationSupport
	mu    sync.Mutex
	tr    *http.Transport
	cache tls.ClientSessionCache
}

// New cria o pool.
func New(ident *signer.Identity, guard *policy.Guard, roots *x509.CertPool, reneg tls.RenegotiationSupport) *Pool {
	p := &Pool{ident: ident, guard: guard, roots: roots, reneg: reneg}
	p.reset(true)
	return p
}

func (p *Pool) reset(dropSessions bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.tr != nil {
		p.tr.CloseIdleConnections()
	}
	if dropSessions || p.cache == nil {
		p.cache = tls.NewLRUClientSessionCache(64)
	}
	p.tr = &http.Transport{
		ForceAttemptHTTP2:     false,
		TLSNextProto:          map[string]func(string, *tls.Conn) http.RoundTripper{}, // nunca h2: quebra renegociação
		MaxIdleConnsPerHost:   4,
		IdleConnTimeout:       90 * time.Second,
		DisableCompression:    true,
		ResponseHeaderTimeout: 0,
		Proxy:                 nil, // proxy HTTP não entra: o helper fala direto com o host aprovado pela guarda
		DialTLSContext:        p.dial(p.cache),
	}
}

// Reset fecha as conexões ociosas; com dropSessions, descarta também o cache de sessão TLS.
func (p *Pool) Reset(dropSessions bool) { p.reset(dropSessions) }

// Close fecha o pool.
func (p *Pool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.tr.CloseIdleConnections()
}

type dialError struct {
	host string
	err  error
	st   *connStat
}

func (e *dialError) Error() string { return fmt.Sprintf("%s: %v", e.host, e.err) }
func (e *dialError) Unwrap() error { return e.err }

func (p *Pool) dial(cache tls.ClientSessionCache) func(ctx context.Context, network, addr string) (net.Conn, error) {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}
		st := &connStat{id: connIDs.Add(1), host: host}
		hooks := signer.Hooks{
			OnSign: func(s signer.Stat) {
				st.mu.Lock()
				if st.cur != nil {
					st.cur.sigs = append(st.cur.sigs, s)
				} else {
					st.sigs = append(st.sigs, s)
				}
				st.mu.Unlock()
			},
			OnError: func(err error) {
				st.mu.Lock()
				if st.signErr == nil {
					st.signErr = err
				}
				st.mu.Unlock()
			},
		}
		cfg := &tls.Config{
			// Com IP, o Go não manda SNI (RFC 6066, seção 3) e valida o IP contra o SAN do servidor.
			ServerName:         host,
			RootCAs:            p.roots,
			MinVersion:         tls.VersionTLS12,
			MaxVersion:         tls.VersionTLS12, // RSA em TLS 1.3 exige PSS, que token e signer remoto não fazem
			CipherSuites:       p.guard.Suites(host),
			Renegotiation:      p.reneg,
			ClientSessionCache: cache,
			GetClientCertificate: func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
				st.mu.Lock()
				st.certReqs++
				if st.initialDone {
					// Renegociação: o Go não chama VerifyConnection nela (e exige a mesma folha do servidor, anti-3SHAKE).
					st.renegs++
					st.handshakes++
					st.resumed = append(st.resumed, false)
				}
				n := max(st.handshakes, 1)
				st.mu.Unlock()
				ctx := signer.Context{Purpose: signer.PurposeTLS, Host: host, Conn: st.id, Handshake: n}
				return p.ident.Certificate(ctx, hooks), nil
			},
			VerifyConnection: func(cs tls.ConnectionState) error {
				st.mu.Lock()
				st.handshakes++
				st.resumed = append(st.resumed, cs.DidResume)
				st.mu.Unlock()
				return nil
			},
		}
		d := &net.Dialer{Timeout: dialTimeout}
		raw, err := d.DialContext(ctx, network, addr)
		if err != nil {
			return nil, &dialError{host: host, err: err, st: st}
		}
		t0 := time.Now()
		_ = raw.SetDeadline(t0.Add(handshakeTimeout + p.ident.SignTimeout))
		c := tls.Client(raw, cfg)
		if err := c.HandshakeContext(ctx); err != nil {
			_ = raw.Close()
			return nil, &dialError{host: host, err: err, st: st}
		}
		// Depois do handshake, quem limita é o prazo da requisição (e a renegociação acontece dentro dela).
		_ = raw.SetDeadline(time.Time{})
		st.mu.Lock()
		st.initialDone = true
		st.handshakeMs = append(st.handshakeMs, float64(time.Since(t0).Microseconds())/1000)
		st.mu.Unlock()
		return &trackedConn{Conn: c, st: st}, nil
	}
}

// reqAcct acumula as assinaturas atribuídas a uma requisição.
type reqAcct struct{ sigs []signer.Stat }

// Request é o http.request já decodificado.
type Request struct {
	URL       string
	Method    string
	Headers   map[string]string
	Body      []byte
	Timeout   time.Duration
	FreshConn bool
}

// TLSInfo é o bloco `tls` da resposta.
type TLSInfo struct {
	Version        string        `json:"version"`
	Cipher         string        `json:"cipher"`
	Conn           int64         `json:"conn"`
	ConnReused     bool          `json:"connReused"`
	Handshakes     int           `json:"handshakes"`
	Resumed        []bool        `json:"resumed"`
	CertRequests   int           `json:"certRequests"`
	Renegotiations int           `json:"renegotiations"`
	Signatures     []signer.Stat `json:"signatures"`
	HandshakeMs    []float64     `json:"handshakeMs"`
	PeerChain      []string      `json:"peerChain"`
}

// Response é o resultado do http.request, sem o corpo codificado.
type Response struct {
	Status  int
	Headers map[string]string
	Body    []byte
	TLS     TLSInfo
	Ms      float64
}

// Do aplica a guarda e faz a requisição. O int é o número de assinaturas que a requisição gastou, com ou sem sucesso:
// um handshake que assinou e depois falhou (certificado recusado, conexão derrubada, prazo) também gastou o uso do
// token, e a auditoria conta.
func (p *Pool) Do(ctx context.Context, r Request) (*Response, int, error) {
	method := r.Method
	if method == "" {
		method = http.MethodPost
	}
	if len(r.Body) > MaxRequestBody {
		return nil, 0, protocol.Errorf(protocol.CodeBadRequest, "corpo acima de %d bytes", MaxRequestBody)
	}
	if _, err := p.guard.Check(r.URL, method, r.Headers, r.Body); err != nil {
		return nil, 0, &protocol.Error{Code: protocol.CodeGuard, Message: err.Error()}
	}
	p.mu.Lock()
	tr := p.tr
	p.mu.Unlock()
	if r.FreshConn {
		tr.CloseIdleConnections()
	}
	timeout := r.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	// Os ganchos do httptrace podem rodar na goroutine de escrita do transporte depois de client.Do voltar (requisição
	// cancelada no meio da escrita): o estado deles fica sob tmu e é lido por snapshot.
	var (
		tmu           sync.Mutex
		got           *trackedConn
		reused, wrote bool
	)
	snapshot := func() (*trackedConn, bool, bool) { tmu.Lock(); defer tmu.Unlock(); return got, reused, wrote }
	// A conta de assinaturas é desta requisição, tomada no GotConn: o transporte pode devolver a conexão ao pool antes
	// de o corpo acabar de ser lido aqui, e a próxima requisição nela já passa a ser a dona.
	acct := &reqAcct{}
	ctx = httptrace.WithClientTrace(ctx, &httptrace.ClientTrace{
		GotConn: func(i httptrace.GotConnInfo) {
			tc, _ := i.Conn.(*trackedConn)
			tmu.Lock()
			got, reused = tc, i.Reused
			tmu.Unlock()
			if tc != nil {
				st := tc.st
				st.mu.Lock()
				st.cur = acct
				acct.sigs = append(acct.sigs, st.sigs...)
				st.sigs = nil
				st.mu.Unlock()
			}
		},
		WroteRequest: func(httptrace.WroteRequestInfo) { tmu.Lock(); wrote = true; tmu.Unlock() },
	})
	// Assinaturas de uma requisição que falhou: as do dial que não chegou a entregar a conexão ficam no connStat do
	// dialError; as de uma conexão obtida, na conta da requisição.
	signed := func(err error) int {
		var de *dialError
		if errors.As(err, &de) && de.st != nil {
			de.st.mu.Lock()
			defer de.st.mu.Unlock()
			return len(de.st.sigs)
		}
		g, _, _ := snapshot()
		if g == nil {
			return 0
		}
		g.st.mu.Lock()
		defer g.st.mu.Unlock()
		return len(acct.sigs)
	}
	var body io.Reader
	if len(r.Body) > 0 || method == http.MethodPost {
		body = bytes.NewReader(r.Body)
	}
	req, err := http.NewRequestWithContext(ctx, method, r.URL, body)
	if err != nil {
		return nil, 0, protocol.Errorf(protocol.CodeBadRequest, "requisição inválida: %v", err)
	}
	for k, v := range r.Headers {
		if strings.EqualFold(k, "host") {
			continue // a guarda já conferiu que é o mesmo host da URL
		}
		req.Header.Set(k, v)
	}
	client := &http.Client{
		Transport: tr,
		// Redirecionamento nunca é seguido: a guarda só aprovou a URL original, e um 307/308 reenviaria o documento.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	t0 := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		g, _, w := snapshot()
		return nil, signed(err), classify(err, g, w, ctx)
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(resp.Body, MaxResponseBody+1))
	if err != nil {
		g, _, _ := snapshot()
		return nil, signed(err), classify(err, g, true, ctx)
	}
	if len(rb) > MaxResponseBody {
		return nil, signed(nil), protocol.Errorf(protocol.CodeTransport, "resposta acima de %d bytes", MaxResponseBody)
	}
	out := &Response{Status: resp.StatusCode, Headers: map[string]string{}, Body: rb, Ms: float64(time.Since(t0).Microseconds()) / 1000}
	for k, vs := range resp.Header {
		out.Headers[strings.ToLower(k)] = strings.Join(vs, ", ")
	}
	g, reusedConn, _ := snapshot()
	out.TLS.ConnReused = reusedConn
	out.TLS.Resumed, out.TLS.HandshakeMs, out.TLS.PeerChain = []bool{}, []float64{}, []string{}
	if g != nil {
		cs := g.ConnectionState()
		out.TLS.Version = tls.VersionName(cs.Version)
		out.TLS.Cipher = tls.CipherSuiteName(cs.CipherSuite)
		for _, c := range cs.PeerCertificates {
			out.TLS.PeerChain = append(out.TLS.PeerChain, c.Subject.CommonName)
		}
		st := g.st
		st.mu.Lock()
		out.TLS.Conn = st.id
		out.TLS.Handshakes = st.handshakes
		out.TLS.Resumed = append([]bool{}, st.resumed...)
		out.TLS.CertRequests = st.certReqs
		out.TLS.Renegotiations = st.renegs
		out.TLS.HandshakeMs = append([]float64{}, st.handshakeMs...)
		out.TLS.Signatures = append([]signer.Stat{}, acct.sigs...)
		st.mu.Unlock()
	}
	if out.TLS.Signatures == nil {
		out.TLS.Signatures = []signer.Stat{}
	}
	return out, len(out.TLS.Signatures), nil
}

// classify transforma a falha em erro do contrato, com `data` para o cliente mapear no código tipado dele.
func classify(err error, got *trackedConn, wrote bool, ctx context.Context) error {
	var st *connStat
	var de *dialError
	stage := "response"
	if errors.As(err, &de) {
		st = de.st
		stage = "handshake"
		var op *net.OpError
		if errors.As(de.err, &op) && op.Op == "dial" {
			stage = "dial"
		}
	} else if got != nil {
		st = got.st
		if !wrote {
			stage = "request"
		}
	}
	if st != nil {
		st.mu.Lock()
		signErr := st.signErr
		st.mu.Unlock()
		if signErr != nil {
			var pe *protocol.Error
			if errors.As(signErr, &pe) {
				return &protocol.Error{Code: pe.Code, Message: pe.Message, Data: map[string]any{"stage": stage}}
			}
			return &protocol.Error{Code: protocol.CodeSignRefused, Message: signErr.Error(), Data: map[string]any{"stage": stage}}
		}
	}
	data := map[string]any{"stage": stage}
	var unknownCA x509.UnknownAuthorityError
	var hostErr x509.HostnameError
	var invalid x509.CertificateInvalidError
	var cverr *tls.CertificateVerificationError
	var rh tls.RecordHeaderError
	var ne net.Error
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()):
		data["timeout"] = true
	case receivedAlert(err) >= 0:
		data["alert"] = receivedAlert(err)
	case errors.As(err, &unknownCA):
		data["x509"] = "unknown_authority"
	case errors.As(err, &hostErr):
		data["x509"] = "hostname"
	case errors.As(err, &invalid):
		data["x509"] = "invalid"
	case errors.As(err, &cverr):
		data["x509"] = "invalid"
	case errors.As(err, &rh):
		data["notTls"] = true
	case errors.Is(err, syscall.ECONNRESET) || errors.Is(err, syscall.EPIPE) || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF):
		data["reset"] = true
	case errors.Is(err, syscall.ECONNREFUSED):
		data["refused"] = true
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		data["dns"] = true
	}
	return &protocol.Error{Code: protocol.CodeTransport, Message: err.Error(), Data: data}
}

// receivedAlert devolve o alerta TLS recebido do servidor, ou -1. O crypto/tls entrega o alerta recebido como
// *net.OpError com Op "remote error" e um tipo de alerta não exportado (uint8); o tls.AlertError só aparece no QUIC.
func receivedAlert(err error) int {
	var qa tls.AlertError
	if errors.As(err, &qa) {
		return int(qa)
	}
	var op *net.OpError
	if errors.As(err, &op) && op.Op == "remote error" && op.Err != nil {
		v := reflect.ValueOf(op.Err)
		if v.Kind() == reflect.Uint8 {
			return int(v.Uint())
		}
	}
	return -1
}
