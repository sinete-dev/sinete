package pool

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"net"
	"testing"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/signer"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

// Servidor que aceita o TCP e nunca responde ao ClientHello: o handshake tem prazo próprio, mais curto que o da
// requisição, e o socket é fechado quando ele vence (antes, ficava preso até o pool fechar).
func TestHandshakeParadoTemPrazoProprio(t *testing.T) {
	old := handshakeTimeout
	handshakeTimeout = 200 * time.Millisecond
	t.Cleanup(func() { handshakeTimeout = old })

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	fechou := make(chan struct{})
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		_, _ = c.Read(make([]byte, 1<<16)) // o ClientHello
		_ = c.SetReadDeadline(time.Now().Add(10 * time.Second))
		for {
			if _, err := c.Read(make([]byte, 1)); err != nil {
				close(fechou)
				return
			}
		}
	}()

	leaf := testpki.NewCA("ac").Titular("EMPRESA:11222333000181", "11222333000181", "", nil)
	ident, err := signer.NewLocalForTest("t", [][]byte{leaf.DER}, nil)
	if err != nil {
		t.Fatal(err)
	}
	p := New(ident, policy.NewLab(), x509.NewCertPool(), tls.RenegotiateOnceAsClient)
	defer p.Close()
	t0 := time.Now()
	_, _, err = p.Do(context.Background(), Request{URL: "https://" + ln.Addr().String() + "/", Method: "GET", Timeout: 10 * time.Second})
	if err == nil {
		t.Fatal("handshake parado não falhou")
	}
	if d := time.Since(t0); d > 5*time.Second {
		t.Fatalf("o handshake esperou %v, o prazo era 200 ms", d)
	}
	select {
	case <-fechou:
	case <-time.After(3 * time.Second):
		t.Fatal("o socket do handshake parado não foi fechado")
	}
}
