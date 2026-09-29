// Spike S4: transporte HTTP/1.1 + mTLS do helper, com pool por identidade, cache de sessão
// e contabilidade por conexão (handshakes, retomada, renegociação, assinaturas pedidas).
package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"regexp"
	"sync"
	"sync/atomic"
	"time"
)

var (
	suitesModern = []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256}
	// BA produção, AN (www e hom1) e PR só aceitam CBC com ECDHE: 0xc027 e 0xc013/0xc014 existem no Go.
	suitesCBC = []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA, tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA}
	// GO produção: só DHE-RSA-AES128-GCM ou troca de chave RSA. O Go não tem DHE; sobra RSA-kx, só para esse host.
	suitesRSAKex = []uint16{tls.TLS_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_RSA_WITH_AES_256_GCM_SHA384}
	rsaKexHosts  = map[string]bool{"nfe.sefaz.go.gov.br": true}
)

func suitesFor(host string) []uint16 {
	s := append(append([]uint16{}, suitesModern...), suitesCBC...)
	if rsaKexHosts[host] {
		s = append(s, suitesRSAKex...)
	}
	return s
}

type connStat struct {
	ID          int64
	Host        string
	mu          sync.Mutex
	Handshakes  int
	Resumed     []bool
	CertReqs    int
	Renegs      int
	initialDone bool
	Signatures  []signStat
	HandshakeMs []float64
}

func (c *connStat) snapshot() (int, int, []signStat, []bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Handshakes, c.CertReqs, append([]signStat{}, c.Signatures...), append([]bool{}, c.Resumed...)
}

type pool struct {
	id       *identity
	tr       *http.Transport
	cache    tls.ClientSessionCache
	roots    *x509.CertPool
	mu       sync.Mutex
	byConn   map[net.Conn]*connStat
	nextCID  *atomic.Int64
	reported map[int64]int
}

func newPool(id *identity, roots *x509.CertPool, nextCID *atomic.Int64, reneg tls.RenegotiationSupport) *pool {
	p := &pool{id: id, roots: roots, cache: tls.NewLRUClientSessionCache(64), byConn: map[net.Conn]*connStat{}, nextCID: nextCID, reported: map[int64]int{}}
	p.tr = &http.Transport{
		ForceAttemptHTTP2:   false,
		TLSNextProto:        map[string]func(string, *tls.Conn) http.RoundTripper{}, // nunca h2: quebra renegociação
		MaxIdleConnsPerHost: 4,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true,
		DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, _, _ := net.SplitHostPort(addr)
			cs := &connStat{ID: p.nextCID.Add(1), Host: host}
			cfg := &tls.Config{
				ServerName:         host,
				RootCAs:            p.roots,
				MinVersion:         tls.VersionTLS12,
				MaxVersion:         tls.VersionTLS12, // RSA em TLS 1.3 exige PSS, que signer remoto não faz
				CipherSuites:       suitesFor(host),
				Renegotiation:      reneg,
				ClientSessionCache: p.cache,
				GetClientCertificate: func(cri *tls.CertificateRequestInfo) (*tls.Certificate, error) {
					cs.mu.Lock()
					cs.CertReqs++
					if cs.initialDone {
						// renegociação: o Go não chama VerifyConnection nela (e exige a mesma folha do servidor, anti-3SHAKE)
						cs.Renegs++
						cs.Handshakes++
						cs.Resumed = append(cs.Resumed, false)
					}
					n := cs.Handshakes
					if n == 0 {
						n = 1
					}
					cs.mu.Unlock()
					ctx := signContext{Purpose: "tls12-client-certificate-verify", Host: host, Conn: cs.ID, Handshake: n}
					return id.certificate(ctx, func(s signStat) { cs.mu.Lock(); cs.Signatures = append(cs.Signatures, s); cs.mu.Unlock() }), nil
				},
				VerifyConnection: func(st tls.ConnectionState) error {
					cs.mu.Lock()
					cs.Handshakes++
					cs.Resumed = append(cs.Resumed, st.DidResume)
					cs.mu.Unlock()
					return nil
				},
			}
			d := &net.Dialer{Timeout: 15 * time.Second}
			raw, err := d.DialContext(ctx, network, addr)
			if err != nil {
				return nil, err
			}
			t0 := time.Now()
			c := tls.Client(raw, cfg)
			if err := c.HandshakeContext(ctx); err != nil {
				raw.Close()
				return nil, fmt.Errorf("handshake com %s: %w", host, err)
			}
			cs.mu.Lock()
			cs.initialDone = true
			cs.HandshakeMs = append(cs.HandshakeMs, float64(time.Since(t0).Microseconds())/1000)
			cs.mu.Unlock()
			p.mu.Lock()
			p.byConn[c] = cs
			p.mu.Unlock()
			return c, nil
		},
	}
	return p
}

type httpParams struct {
	Identity  string            `json:"identity"`
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"` // base64
	TimeoutMs int               `json:"timeoutMs"`
	FreshConn bool              `json:"freshConn"` // fecha conexões ociosas antes (para medir retomada)
	Service   string            `json:"service"`
}

type tlsInfo struct {
	Version        string     `json:"version"`
	Cipher         string     `json:"cipher"`
	Conn           int64      `json:"conn"`
	ConnReused     bool       `json:"connReused"`
	Handshakes     int        `json:"handshakes"`   // no total da conexão (inicial + renegociações)
	Resumed        []bool     `json:"resumed"`      // por handshake da conexão
	CertRequests   int        `json:"certRequests"` // CertificateRequest recebidos na conexão
	Renegotiations int        `json:"renegotiations"`
	Signatures     []signStat `json:"signatures"` // assinaturas pedidas DURANTE esta requisição
	HandshakeMs    []float64  `json:"handshakeMs"`
	PeerChainCNs   []string   `json:"peerChain"`
}

type httpResult struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	TLS     tlsInfo           `json:"tls"`
	Ms      float64           `json:"ms"`
}

var cStatRe = regexp.MustCompile(`<(?:\w+:)?cStat>(\d+)<`)

func (p *pool) do(g *guard, prm httpParams) (*httpResult, error) {
	method := prm.Method
	if method == "" {
		method = "POST"
	}
	body, err := base64.StdEncoding.DecodeString(prm.Body)
	if err != nil {
		return nil, errCode("bad_request", "body não é base64")
	}
	tg, err := g.check(prm.URL, method, prm.Headers, body)
	if err != nil {
		return nil, err
	}
	cn := p.id.Leaf.Subject.CommonName
	outcome := "?"
	if !g.lab {
		defer func() { logUse(cn, tg.Host, prm.Service, outcome) }()
	}
	if prm.FreshConn {
		p.tr.CloseIdleConnections()
	}
	timeout := time.Duration(prm.TimeoutMs) * time.Millisecond
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	var gotConn net.Conn
	var reused bool
	ctx = httptrace.WithClientTrace(ctx, &httptrace.ClientTrace{GotConn: func(i httptrace.GotConnInfo) { gotConn, reused = i.Conn, i.Reused }})
	req, err := http.NewRequestWithContext(ctx, method, prm.URL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for k, v := range prm.Headers {
		req.Header.Set(k, v)
	}
	var before int
	t0 := time.Now()
	// o número de assinaturas antes da requisição só é conhecido depois de GotConn; guardamos o total por conexão
	resp, err := (&http.Client{Transport: p.tr}).Do(req)
	if err != nil {
		outcome = "erro: " + err.Error()
		return nil, errCode("transport", "%v", err)
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(resp.Body)
	if err != nil {
		outcome = "erro lendo corpo: " + err.Error()
		return nil, errCode("transport", "%v", err)
	}
	ms := float64(time.Since(t0).Microseconds()) / 1000
	res := &httpResult{Status: resp.StatusCode, Headers: map[string]string{}, Body: base64.StdEncoding.EncodeToString(rb), Ms: ms}
	for k := range resp.Header {
		res.Headers[k] = resp.Header.Get(k)
	}
	if tc, ok := gotConn.(*tls.Conn); ok {
		st := tc.ConnectionState()
		res.TLS.Version = tls.VersionName(st.Version)
		res.TLS.Cipher = tls.CipherSuiteName(st.CipherSuite)
		for _, c := range st.PeerCertificates {
			res.TLS.PeerChainCNs = append(res.TLS.PeerChainCNs, c.Subject.CommonName)
		}
		p.mu.Lock()
		cs := p.byConn[tc]
		p.mu.Unlock()
		if cs != nil {
			hs, creq, sigs, resumed := cs.snapshot()
			res.TLS.Conn, res.TLS.Handshakes, res.TLS.CertRequests, res.TLS.Resumed = cs.ID, hs, creq, resumed
			cs.mu.Lock()
			res.TLS.Renegotiations = cs.Renegs
			cs.mu.Unlock()
			cs.mu.Lock()
			res.TLS.HandshakeMs = append([]float64{}, cs.HandshakeMs...)
			cs.mu.Unlock()
			// assinaturas desta requisição = as que ainda não foram reportadas nesta conexão
			p.mu.Lock()
			before = p.reported[cs.ID]
			p.reported[cs.ID] = len(sigs)
			p.mu.Unlock()
			res.TLS.Signatures = sigs[before:]
		}
	}
	res.TLS.ConnReused = reused
	cst := ""
	if m := cStatRe.FindSubmatch(rb); m != nil {
		cst = string(m[1])
	}
	outcome = fmt.Sprintf("HTTP %d cStat=%s conn=%d reused=%v resumed=%v sigs=%d %s %s", res.Status, cst, res.TLS.Conn, reused, res.TLS.Resumed, len(res.TLS.Signatures), res.TLS.Version, res.TLS.Cipher)
	return res, nil
}
