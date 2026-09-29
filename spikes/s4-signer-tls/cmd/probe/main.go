// probe (spike S4): handshake do crypto/tls do Go SEM certificado de cliente, só para ver se a suíte
// negocia com os hosts que só têm CBC ou DHE (inclusive produção: é só ClientHello, sem requisição HTTP).
// Duas configurações por host: padrão do Go e o perfil do helper (CBC + RSA-kx onde precisa).
// Uso: go run ./cmd/probe host...
package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"time"
)

var helperProfile = []uint16{
	tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
	tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA, tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
}
var rsaKex = []uint16{tls.TLS_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_RSA_WITH_AES_256_GCM_SHA384}

type result struct {
	Host    string `json:"host"`
	Profile string `json:"profile"`
	Outcome string `json:"outcome"`
	Suite   string `json:"suite,omitempty"`
	Detail  string `json:"detail,omitempty"`
}

func try(host, name string, suites []uint16, roots *x509.CertPool) result {
	var negotiated string
	cfg := &tls.Config{ServerName: host, RootCAs: roots, MinVersion: tls.VersionTLS12, MaxVersion: tls.VersionTLS12, CipherSuites: suites,
		Renegotiation:    tls.RenegotiateOnceAsClient,
		VerifyConnection: func(st tls.ConnectionState) error { negotiated = tls.CipherSuiteName(st.CipherSuite); return nil },
		GetClientCertificate: func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			return &tls.Certificate{}, nil // sem certificado: só queremos saber até onde vai
		}}
	d := &net.Dialer{Timeout: 15 * time.Second}
	c, err := tls.DialWithDialer(d, "tcp", net.JoinHostPort(host, "443"), cfg)
	r := result{Host: host, Profile: name, Suite: negotiated}
	if err == nil {
		r.Suite = tls.CipherSuiteName(c.ConnectionState().CipherSuite)
		r.Outcome = "handshake completo (cert pedido depois, por renegociação, ou opcional)"
		c.Close()
		return r
	}
	var ae tls.AlertError
	r.Detail = err.Error()
	switch {
	case negotiated != "":
		r.Outcome = "suíte negociada; servidor recusou por falta de certificado"
	case errors.As(err, &ae) || err != nil:
		r.Outcome = "falhou antes de negociar"
	}
	return r
}

func main() {
	roots, _ := x509.SystemCertPool()
	if b, err := os.ReadFile("../s2-tls/icp/icp-brasil-roots.pem"); err == nil {
		roots.AppendCertsFromPEM(b)
	}
	var out []result
	for _, h := range os.Args[1:] {
		out = append(out, try(h, "go-default", nil, roots))
		time.Sleep(700 * time.Millisecond)
		out = append(out, try(h, "helper(+cbc)", helperProfile, roots))
		time.Sleep(700 * time.Millisecond)
		out = append(out, try(h, "helper(+cbc+rsakex)", append(append([]uint16{}, helperProfile...), rsaKex...), roots))
		time.Sleep(700 * time.Millisecond)
	}
	b, _ := json.MarshalIndent(out, "", "  ")
	fmt.Println(string(b))
}
