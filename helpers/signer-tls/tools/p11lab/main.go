//go:build cgo

// p11lab prepara um token SoftHSM descartável para os testes de integração do cliente TS: inicializa o token em
// --dir, gera o par dentro dele, emite o certificado pela AC de teste (PEMs em --ca-cert e --ca-key) com o CNPJ no
// SubjectAltName e grava o certificado no token. Escreve o certificado em PEM no stdout. Nada aqui é certificado real.
package main

import (
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/p11lab"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

func main() {
	dir := flag.String("dir", "", "diretório do token")
	module := flag.String("module", p11lab.FindModule(), "módulo do SoftHSM")
	token := flag.String("token", "sinete-lab", "rótulo do token")
	pin := flag.String("pin", "", "PIN de laboratório")
	caCert := flag.String("ca-cert", "", "PEM da AC de teste")
	caKey := flag.String("ca-key", "", "PEM PKCS#8 da chave da AC de teste")
	cnpj := flag.String("cnpj", "", "CNPJ de teste do titular (e-CNPJ)")
	cpf := flag.String("cpf", "", "CPF de teste do titular (e-CPF), no lugar do CNPJ")
	notBefore := flag.String("not-before", "", "início da validade (RFC 3339); padrão: uma hora atrás")
	days := flag.Int("days", 2, "dias de validade")
	flag.Parse()
	nb := time.Now().Add(-time.Hour)
	if *notBefore != "" {
		t, err := time.Parse(time.RFC3339, *notBefore)
		if err != nil {
			log.Fatalf("--not-before: %v", err)
		}
		nb = t
	}
	if *dir == "" || *pin == "" || *caCert == "" || *caKey == "" || (*cnpj == "") == (*cpf == "") || *module == "" {
		log.Fatal("uso: p11lab --dir d --pin p --ca-cert ac.pem --ca-key ac.key --cnpj 11222333000181")
	}
	tok, err := p11lab.Init(*dir, *module, *token, *pin)
	if err != nil {
		log.Fatal(err)
	}
	id := []byte{0x01, 0x02}
	pub, err := tok.GenerateKey("chave-a3", id)
	if err != nil {
		log.Fatal(err)
	}
	cb, err := os.ReadFile(*caCert)
	if err != nil {
		log.Fatal(err)
	}
	kb, err := os.ReadFile(*caKey)
	if err != nil {
		log.Fatal(err)
	}
	cblk, _ := pem.Decode(cb)
	kblk, _ := pem.Decode(kb)
	if cblk == nil || kblk == nil {
		log.Fatal("PEM da AC inválido")
	}
	ca, err := x509.ParseCertificate(cblk.Bytes)
	if err != nil {
		log.Fatal(err)
	}
	caPriv, err := x509.ParsePKCS8PrivateKey(kblk.Bytes)
	if err != nil {
		log.Fatal(err)
	}
	tpl := &x509.Certificate{
		SerialNumber:    big.NewInt(time.Now().UnixNano()),
		Subject:         pkix.Name{CommonName: "SINETE LAB A3:" + *cnpj + *cpf},
		NotBefore:       nb,
		NotAfter:        nb.Add(time.Duration(*days) * 24 * time.Hour),
		KeyUsage:        x509.KeyUsageDigitalSignature | x509.KeyUsageContentCommitment,
		ExtKeyUsage:     []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageEmailProtection},
		ExtraExtensions: []pkix.Extension{{Id: asn1.ObjectIdentifier{2, 5, 29, 17}, Value: testpki.OtherNameSAN(*cnpj, *cpf)}},
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, ca, pub, caPriv)
	if err != nil {
		log.Fatal(err)
	}
	if err := tok.StoreCertificate("certificado-a3", id, der); err != nil {
		log.Fatal(err)
	}
	fmt.Print(string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})))
}
