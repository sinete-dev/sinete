// p11setup (spike S4): gera um par RSA 2048 DENTRO do SoftHSM (sensível, não exportável),
// emite um certificado de cliente pela CA descartável do lab e grava o certificado no token.
// Pré-requisito: token inicializado com softhsm2-util (ver lab/softhsm-init.sh).
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/miekg/pkcs11"
)

func main() {
	module := flag.String("module", "/opt/homebrew/lib/softhsm/libsofthsm2.so", "")
	token := flag.String("token", "sinete-s4", "")
	label := flag.String("label", "tls-client", "")
	pin := flag.String("pin", "", "")
	caCert := flag.String("ca-cert", ".local/pki/ca.crt", "")
	caKey := flag.String("ca-key", ".local/pki/ca.key", "")
	out := flag.String("out", ".local/softhsm/client.crt", "")
	flag.Parse()

	p := pkcs11.New(*module)
	must(p.Initialize())
	defer p.Finalize()
	slots, err := p.GetSlotList(true)
	must(err)
	var slot uint
	ok := false
	for _, s := range slots {
		if ti, err := p.GetTokenInfo(s); err == nil && ti.Label == *token {
			slot, ok = s, true
		}
	}
	if !ok {
		log.Fatalf("token %s não encontrado", *token)
	}
	sess, err := p.OpenSession(slot, pkcs11.CKF_SERIAL_SESSION|pkcs11.CKF_RW_SESSION)
	must(err)
	must(p.Login(sess, pkcs11.CKU_USER, *pin))

	pubTpl := []*pkcs11.Attribute{
		pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
		pkcs11.NewAttribute(pkcs11.CKA_VERIFY, true),
		pkcs11.NewAttribute(pkcs11.CKA_MODULUS_BITS, 2048),
		pkcs11.NewAttribute(pkcs11.CKA_PUBLIC_EXPONENT, []byte{1, 0, 1}),
		pkcs11.NewAttribute(pkcs11.CKA_LABEL, *label),
	}
	privTpl := []*pkcs11.Attribute{
		pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
		pkcs11.NewAttribute(pkcs11.CKA_PRIVATE, true),
		pkcs11.NewAttribute(pkcs11.CKA_SIGN, true),
		pkcs11.NewAttribute(pkcs11.CKA_SENSITIVE, true),
		pkcs11.NewAttribute(pkcs11.CKA_EXTRACTABLE, false),
		pkcs11.NewAttribute(pkcs11.CKA_LABEL, *label),
	}
	pubH, privH, err := p.GenerateKeyPair(sess, []*pkcs11.Mechanism{pkcs11.NewMechanism(pkcs11.CKM_RSA_PKCS_KEY_PAIR_GEN, nil)}, pubTpl, privTpl)
	must(err)
	attrs, err := p.GetAttributeValue(sess, pubH, []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_MODULUS, nil), pkcs11.NewAttribute(pkcs11.CKA_PUBLIC_EXPONENT, nil)})
	must(err)
	pub := &rsa.PublicKey{N: new(big.Int).SetBytes(attrs[0].Value), E: int(new(big.Int).SetBytes(attrs[1].Value).Int64())}

	// prova de que a chave não sai do token
	_, err = p.GetAttributeValue(sess, privH, []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_PRIVATE_EXPONENT, nil)})
	fmt.Printf("leitura de CKA_PRIVATE_EXPONENT: %v\n", err)

	cab, err := os.ReadFile(*caCert)
	must(err)
	kb, err := os.ReadFile(*caKey)
	must(err)
	cb, _ := pem.Decode(cab)
	ca, err := x509.ParseCertificate(cb.Bytes)
	must(err)
	kbl, _ := pem.Decode(kb)
	caPriv, err := x509.ParsePKCS8PrivateKey(kbl.Bytes)
	must(err)
	tpl := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: "sinete-s4-softhsm-client:00000000000000"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(30 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, ca, pub, caPriv)
	must(err)
	_, err = p.CreateObject(sess, []*pkcs11.Attribute{
		pkcs11.NewAttribute(pkcs11.CKA_CLASS, pkcs11.CKO_CERTIFICATE),
		pkcs11.NewAttribute(pkcs11.CKA_CERTIFICATE_TYPE, pkcs11.CKC_X_509),
		pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
		pkcs11.NewAttribute(pkcs11.CKA_LABEL, *label),
		pkcs11.NewAttribute(pkcs11.CKA_VALUE, der),
		pkcs11.NewAttribute(pkcs11.CKA_SUBJECT, mustParse(der).RawSubject),
	})
	must(err)
	must(os.WriteFile(*out, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o644))
	fmt.Printf("par gerado no token %s (label %s), certificado em %s\n", *token, *label, *out)
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func mustParse(der []byte) *x509.Certificate {
	c, err := x509.ParseCertificate(der)
	must(err)
	return c
}
