// Package testpki gera a PKI descartável dos testes do helper: uma AC, o certificado de servidor para 127.0.0.1 e
// localhost e certificados de titular com o CNPJ ou o CPF no SubjectAltName, como a ICP-Brasil faz. Nada aqui é
// certificado real; tudo nasce na memória a cada execução.
package testpki

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"
	"math/big"
	"net"
	"time"
)

// CA é uma AC de teste.
type CA struct {
	Cert *x509.Certificate
	Key  *rsa.PrivateKey
	PEM  string
}

// Leaf é um certificado emitido pela AC.
type Leaf struct {
	Cert *x509.Certificate
	Key  *rsa.PrivateKey
	DER  []byte
	PEM  string
}

var serial int64

func next() *big.Int { serial++; return big.NewInt(time.Now().UnixNano() + serial) }

func mustKey() *rsa.PrivateKey {
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	return k
}

// NewCA cria a AC.
func NewCA(cn string) *CA {
	k := mustKey()
	tpl := &x509.Certificate{
		SerialNumber: next(), Subject: pkix.Name{CommonName: cn},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &k.PublicKey, k)
	if err != nil {
		panic(err)
	}
	c, _ := x509.ParseCertificate(der)
	return &CA{Cert: c, Key: k, PEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))}
}

func (ca *CA) issue(tpl *x509.Certificate, pub *rsa.PublicKey, k *rsa.PrivateKey) *Leaf {
	der, err := x509.CreateCertificate(rand.Reader, tpl, ca.Cert, pub, ca.Key)
	if err != nil {
		panic(err)
	}
	c, _ := x509.ParseCertificate(der)
	return &Leaf{Cert: c, Key: k, DER: der, PEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))}
}

// Server emite o certificado do servidor local.
func (ca *CA) Server() *Leaf {
	k := mustKey()
	return ca.issue(&x509.Certificate{
		SerialNumber: next(), Subject: pkix.Name{CommonName: "localhost"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
	}, &k.PublicKey, k)
}

// OtherNameSAN monta a extensão SubjectAltName com otherName ICP-Brasil (2.16.76.1.3.3 CNPJ, 2.16.76.1.3.1 CPF).
func OtherNameSAN(cnpj, cpf string) []byte {
	on := func(oid asn1.ObjectIdentifier, v string) asn1.RawValue {
		octet, _ := asn1.Marshal([]byte(v))
		explicit, _ := asn1.Marshal(asn1.RawValue{Class: asn1.ClassContextSpecific, Tag: 0, IsCompound: true, Bytes: octet})
		o, _ := asn1.Marshal(oid)
		return asn1.RawValue{Class: asn1.ClassContextSpecific, Tag: 0, IsCompound: true, Bytes: append(o, explicit...)}
	}
	var names []asn1.RawValue
	if cnpj != "" {
		names = append(names, on(asn1.ObjectIdentifier{2, 16, 76, 1, 3, 3}, cnpj))
	}
	if cpf != "" {
		names = append(names, on(asn1.ObjectIdentifier{2, 16, 76, 1, 3, 1}, "01011980"+cpf+"000000000000000000000000000000000000"))
	}
	b, err := asn1.Marshal(names)
	if err != nil {
		panic(err)
	}
	return b
}

// Titular emite um certificado de cliente com o documento no SAN. pub nil gera um par novo.
func (ca *CA) Titular(cn, cnpj, cpf string, pub *rsa.PublicKey) *Leaf {
	var k *rsa.PrivateKey
	if pub == nil {
		k = mustKey()
		pub = &k.PublicKey
	}
	tpl := &x509.Certificate{
		SerialNumber: next(), Subject: pkix.Name{CommonName: cn},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}
	if cnpj != "" || cpf != "" {
		tpl.ExtraExtensions = []pkix.Extension{{Id: asn1.ObjectIdentifier{2, 5, 29, 17}, Value: OtherNameSAN(cnpj, cpf)}}
	}
	return ca.issue(tpl, pub, k)
}
