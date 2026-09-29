//go:build cgo

package server

import (
	"crypto"
	"crypto/sha1" //nolint:gosec
	"encoding/base64"
	"encoding/hex"
	"testing"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/p11lab"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"

	"crypto/rsa"
)

// Token SoftHSM de verdade: par gerado dentro do token, certificado com rótulo diferente do da chave (ligados pelo
// CKA_ID), handshake com o servidor local e dfe.sign. Sem SoftHSM, o teste é pulado.
func TestPKCS11SoftHSM(t *testing.T) {
	module := p11lab.FindModule()
	if module == "" {
		t.Skip("SoftHSM não encontrado (SOFTHSM2_MODULE)")
	}
	tok, err := p11lab.Init(t.TempDir(), module, "sinete-teste", "1234")
	if err != nil {
		t.Skip(err)
	}
	id := []byte{0xa3}
	pub, err := tok.GenerateKey("chave", id)
	if err != nil {
		t.Fatal(err)
	}
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA A3:"+cnpj, cnpj, "", pub)
	if err := tok.StoreCertificate("certificado", id, leaf.DER); err != nil {
		t.Fatal(err)
	}

	c := newClient(t, policy.NewLab())
	if _, err := c.call("identity.open", map[string]any{"id": "a3", "backend": "pkcs11", "module": module, "token": "sinete-teste", "label": "certificado", "pin": "errado"}); err == nil || err.Code != "pkcs11" {
		t.Fatalf("PIN errado: %v", err)
	}
	res := c.mustCall("identity.open", map[string]any{"id": "a3", "backend": "pkcs11", "module": module, "token": "sinete-teste", "label": "certificado", "pin": "1234", "chain": []string{b64(ca.Cert.Raw)}, "additionalCa": []string{ca.PEM}})
	if res["dfeSign"] != true || res["cnpj"] != cnpj || len(res["chain"].([]any)) != 2 {
		t.Fatalf("identity.open pkcs11: %v", res)
	}
	// Pelo CKA_ID, sem rótulo.
	c.mustCall("identity.open", map[string]any{"id": "a3-id", "backend": "pkcs11", "module": module, "token": "sinete-teste", "keyId": hex.EncodeToString(id), "pin": "1234", "additionalCa": []string{ca.PEM}})

	srv := startServer(t, ca, nil, nil)
	r, perr := c.call("http.request", map[string]any{"identity": "a3", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": ""})
	if perr != nil {
		t.Fatal(perr)
	}
	body, _ := base64.StdEncoding.DecodeString(r["body"].(string))
	sigs := tlsBlock(r)["signatures"].([]any)
	if string(body) != "cn=EMPRESA A3:"+cnpj || len(sigs) != 1 || sigs[0].(map[string]any)["mode"] != "pkcs11" {
		t.Fatalf("mTLS pelo token: %s %v", body, tlsBlock(r))
	}
	if _, perr := c.call("http.request", map[string]any{"identity": "a3-id", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": ""}); perr != nil {
		t.Fatal(perr)
	}

	chave := "352609" + cnpj + "550010000000011000000011"
	si := []byte(`<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#NFe` + chave + `"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</DigestValue></Reference></SignedInfo>`)
	d := c.mustCall("dfe.sign", map[string]any{"identity": "a3", "signedInfo": b64(si), "hash": "SHA-1"})
	sig, _ := base64.StdEncoding.DecodeString(d["signature"].(string))
	sum := sha1.Sum(si) //nolint:gosec
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA1, sum[:], sig); err != nil || d["kind"] != "nfe" {
		t.Fatalf("dfe.sign: %v %v", err, d)
	}
	outro := []byte(string(si[:0]) + string(si))
	outro = []byte(replaceOnce(string(outro), cnpj, "44555666000181"))
	if _, perr := c.call("dfe.sign", map[string]any{"identity": "a3", "signedInfo": b64(outro), "hash": "SHA-1"}); perr == nil || perr.Code != "dfe_refused" {
		t.Fatalf("dfe.sign de outro emitente: %v", perr)
	}
	st := c.mustCall("stats", map[string]any{})
	if st["identities"].(map[string]any)["a3"].(map[string]any)["signatures"].(float64) != 2 {
		t.Fatalf("stats: %v", st)
	}
	c.mustCall("identity.close", map[string]any{"identity": "a3"})
	// A outra identidade do mesmo token continua de pé depois do close (módulo compartilhado, sem C_Logout).
	if _, perr := c.call("pool.reset", map[string]any{"identity": "a3-id", "dropSessions": true}); perr != nil {
		t.Fatal(perr)
	}
	if _, perr := c.call("http.request", map[string]any{"identity": "a3-id", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": ""}); perr != nil {
		t.Fatalf("segunda identidade depois do close da primeira: %v", perr)
	}
}

func replaceOnce(s, old, new string) string {
	for i := 0; i+len(old) <= len(s); i++ {
		if s[i:i+len(old)] == old {
			return s[:i] + new + s[i+len(old):]
		}
	}
	return s
}
