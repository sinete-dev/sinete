//go:build cgo

package signer

import (
	"crypto"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/p11lab"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

// Uma requisição que ainda segura a identidade depois do identity.close não pode chegar ao C_SignInit: a sessão
// está fechada e, se era a última do módulo, o contexto nativo já foi finalizado.
func TestPKCS11AssinarDepoisDeFecharRecusa(t *testing.T) {
	module := p11lab.FindModule()
	if module == "" {
		t.Skip("SoftHSM não encontrado (SOFTHSM2_MODULE)")
	}
	tok, err := p11lab.Init(t.TempDir(), module, "sinete-fechar", "1234")
	if err != nil {
		t.Skip(err)
	}
	id := []byte{0x0c}
	pub, err := tok.GenerateKey("chave", id)
	if err != nil {
		t.Fatal(err)
	}
	leaf := testpki.NewCA("ac").Titular("EMPRESA A3:11222333000181", "11222333000181", "", pub)
	if err := tok.StoreCertificate("certificado", id, leaf.DER); err != nil {
		t.Fatal(err)
	}
	ident, err := OpenPKCS11("a3", P11Params{Module: module, Token: "sinete-fechar", Label: "certificado", Pin: "1234"})
	if err != nil {
		t.Fatal(err)
	}
	di, err := DigestInfo(crypto.SHA256, make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ident.Key.SignDigestInfo(di); err != nil {
		t.Fatalf("assinatura com a identidade aberta: %v", err)
	}
	if err := ident.Close(); err != nil {
		t.Fatal(err)
	}
	if err := ident.Close(); err != nil {
		t.Fatalf("segundo close: %v", err)
	}
	if _, err := ident.Key.SignDigestInfo(di); err == nil {
		t.Fatal("assinou depois do close")
	}
}

// O mesmo módulo por dois caminhos (link simbólico e alvo) divide uma contagem só: fechar a identidade aberta por um
// caminho não pode chamar C_Finalize debaixo da identidade aberta pelo outro.
func TestPKCS11MesmoModuloPorOutroCaminho(t *testing.T) {
	module := p11lab.FindModule()
	if module == "" {
		t.Skip("SoftHSM não encontrado (SOFTHSM2_MODULE)")
	}
	tok, err := p11lab.Init(t.TempDir(), module, "sinete-alias", "1234")
	if err != nil {
		t.Skip(err)
	}
	id := []byte{0x0d}
	pub, err := tok.GenerateKey("chave", id)
	if err != nil {
		t.Fatal(err)
	}
	leaf := testpki.NewCA("ac").Titular("EMPRESA A3:11222333000181", "11222333000181", "", pub)
	if err := tok.StoreCertificate("certificado", id, leaf.DER); err != nil {
		t.Fatal(err)
	}
	alias := filepath.Join(t.TempDir(), "modulo-alias.so")
	if err := os.Symlink(module, alias); err != nil {
		t.Skip(err)
	}
	a, err := OpenPKCS11("a", P11Params{Module: module, Token: "sinete-alias", Label: "certificado", Pin: "1234"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := OpenPKCS11("b", P11Params{Module: alias, Token: "sinete-alias", Label: "certificado", Pin: "1234"})
	if err != nil {
		t.Fatal(err)
	}
	if err := b.Close(); err != nil {
		t.Fatal(err)
	}
	di, err := DigestInfo(crypto.SHA256, make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.Key.SignDigestInfo(di); err != nil {
		t.Fatalf("a identidade do outro caminho caiu com o close: %v", err)
	}
	if err := a.Close(); err != nil {
		t.Fatal(err)
	}
}

// Certificado com CKA_ID sem chave desse CKA_ID não cai para uma chave de mesmo rótulo; e uma chave de mesmo CKA_ID
// que não é a do certificado (módulo diferente) é recusada.
func TestPKCS11ChaveDeOutroPar(t *testing.T) {
	module := p11lab.FindModule()
	if module == "" {
		t.Skip("SoftHSM não encontrado (SOFTHSM2_MODULE)")
	}
	tok, err := p11lab.Init(t.TempDir(), module, "sinete-par", "1234")
	if err != nil {
		t.Skip(err)
	}
	pubA, err := tok.GenerateKey("certificado", []byte{0x01})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tok.GenerateKey("outra", []byte{0x03}); err != nil {
		t.Fatal(err)
	}
	ca := testpki.NewCA("ac")
	// Rótulo igual ao da chave 01, mas CKA_ID 02, sem chave 02 no token.
	if err := tok.StoreCertificate("certificado", []byte{0x02}, ca.Titular("EMPRESA:11222333000181", "11222333000181", "", pubA).DER); err != nil {
		t.Fatal(err)
	}
	// CKA_ID 03, com a chave 03, mas o certificado é do par 01.
	if err := tok.StoreCertificate("trocado", []byte{0x03}, ca.Titular("EMPRESA:11222333000181", "11222333000181", "", pubA).DER); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenPKCS11("a", P11Params{Module: module, Token: "sinete-par", Label: "certificado", Pin: "1234"}); err == nil {
		t.Fatal("abriu com a chave de outro CKA_ID pelo rótulo")
	}
	_, err = OpenPKCS11("b", P11Params{Module: module, Token: "sinete-par", Label: "trocado", Pin: "1234"})
	if err == nil || !strings.Contains(err.Error(), "não é a do certificado") {
		t.Fatalf("chave de outro par: %v", err)
	}
}
