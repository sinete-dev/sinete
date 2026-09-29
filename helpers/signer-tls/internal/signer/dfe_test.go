package signer

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1" //nolint:gosec
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

const (
	cnpjTitular = "11222333000181"
	cnpjOutro   = "44555666000181"
	cpfTitular  = "52998224725"
)

// chaveDe monta uma chave de acesso de 44 posições com o documento do emitente nas posições 7 a 20.
func chaveDe(doc string) string { return "352609" + doc + "550010000000011000000011" }

func mkSignedInfo(id, digestB64 string) []byte {
	return []byte(`<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
		`<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
		`<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
		`<Reference URI="#` + id + `"><Transforms>` +
		`<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
		`<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms>` +
		`<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
		`<DigestValue>` + digestB64 + `</DigestValue></Reference></SignedInfo>`)
}

var zeroDigest = base64.StdEncoding.EncodeToString(make([]byte, 20))

func holderCNPJ() Holder { return Holder{CNPJ: cnpjTitular} }

func refused(t *testing.T, err error, contains string) {
	t.Helper()
	var pe *protocol.Error
	if !errors.As(err, &pe) || pe.Code != protocol.CodeDfeRefused {
		t.Fatalf("esperado dfe_refused, veio %v", err)
	}
	if !strings.Contains(pe.Message, contains) {
		t.Fatalf("mensagem %q sem %q", pe.Message, contains)
	}
}

func TestDfeAceitaDocumentosDoTitular(t *testing.T) {
	cases := map[string]string{
		"nfe":          "NFe" + chaveDe(cnpjTitular),
		"mdfe":         "MDFe" + chaveDe(cnpjTitular),
		"evento":       "ID110111" + chaveDe(cnpjTitular) + "01",
		"inutilizacao": "ID3526" + cnpjTitular + "55001000000001000000009",
		"dps":          "DPS35503082" + cnpjTitular + "00001000000000000001",
		"evento-nfse":  "PRE355030822" + cnpjTitular + "000000000000126090000000011" + "101101",
	}
	for kind, id := range cases {
		a, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, zeroDigest), Hash: "SHA-1"}, holderCNPJ())
		if err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
		if a.Kind != kind || a.Reference != id || a.Hash != crypto.SHA1 {
			t.Fatalf("%s: aprovado errado %+v", kind, a)
		}
	}
}

func TestDfeCPF(t *testing.T) {
	id := "NFe" + chaveDe("000"+cpfTitular)
	if _, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, zeroDigest), Hash: "SHA-1"}, Holder{CPF: cpfTitular}); err != nil {
		t.Fatal(err)
	}
}

func TestDfeRecusaOutroEmitente(t *testing.T) {
	_, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo("NFe"+chaveDe(cnpjOutro), zeroDigest), Hash: "SHA-1"}, holderCNPJ())
	refused(t, err, "não é o titular")
	_, err = ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo("ID210210"+chaveDe(cnpjOutro)+"01", zeroDigest), Hash: "SHA-1"}, holderCNPJ())
	refused(t, err, "element")
}

func TestDfeRecusaReferenciaQueNaoEDocumento(t *testing.T) {
	for _, id := range []string{"login", "NFe123", "NFe" + chaveDe(cnpjTitular) + "0", ""} {
		_, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, zeroDigest), Hash: "SHA-1"}, holderCNPJ())
		if err == nil {
			t.Fatalf("%q passou", id)
		}
	}
}

func TestDfeSemTitular(t *testing.T) {
	_, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo("NFe"+chaveDe(cnpjTitular), zeroDigest), Hash: "SHA-1"}, Holder{})
	refused(t, err, "CNPJ nem CPF")
}

func TestDfePerfilDoSignedInfo(t *testing.T) {
	good := string(mkSignedInfo("NFe"+chaveDe(cnpjTitular), zeroDigest))
	mut := map[string]string{
		"hash errado":          strings.Replace(good, "xmldsig#rsa-sha1", "xmldsig-more#rsa-sha256", 1),
		"c14n com comentários": strings.Replace(good, "c14n-20010315\"></Canon", "c14n-20010315#WithComments\"></Canon", 1),
		"sem enveloped":        strings.Replace(good, "enveloped-signature", "base64", 1),
		"comentário":           strings.Replace(good, "<Transforms>", "<!-- x --><Transforms>", 1),
		"espaço solto":         strings.Replace(good, "<Transforms>", " <Transforms>", 1),
		"prefixo":              strings.Replace(strings.Replace(good, "<SignedInfo ", "<ds:SignedInfo ", 1), "</SignedInfo>", "</ds:SignedInfo>", 1),
		"sem namespace":        strings.Replace(good, `xmlns="http://www.w3.org/2000/09/xmldsig#" `, "", 1),
		"segundo Reference":    strings.Replace(good, "</Reference>", "</Reference><Reference URI=\"#x\"></Reference>", 1),
		"digest curto":         strings.Replace(good, zeroDigest, "AAAA", 1),
		"URI externa":          strings.Replace(good, `URI="#NFe`, `URI="http://x/#NFe`, 1),
		"atributo a mais":      strings.Replace(good, "<Reference ", "<Reference Id=\"r\" ", 1),
		"lixo depois":          good + "<x/>",
		"DOCTYPE":              "<!DOCTYPE x>" + good,
	}
	for name, si := range mut {
		hash := "SHA-1"
		if _, err := ValidateDfe(DfeRequest{SignedInfo: []byte(si), Hash: hash}, holderCNPJ()); err == nil {
			t.Errorf("%s: passou", name)
		}
	}
	if _, err := ValidateDfe(DfeRequest{SignedInfo: []byte(good), Hash: "SHA-256"}, holderCNPJ()); err == nil {
		t.Error("hash diferente do SignatureMethod passou")
	}
}

func eventoElemento(ns, id, autorTag, autor string) []byte {
	return []byte(`<infEvento xmlns="` + ns + `" Id="` + id + `"><cOrgao>91</cOrgao><tpAmb>2</tpAmb><` + autorTag + `>` + autor + `</` + autorTag + `><chNFe>x</chNFe></infEvento>`)
}

func TestDfeEventoComoDestinatario(t *testing.T) {
	id := "ID210210" + chaveDe(cnpjOutro) + "01"
	el := eventoElemento("http://www.portalfiscal.inf.br/nfe", id, "CNPJ", cnpjTitular)
	sum := sha1.Sum(el) //nolint:gosec
	d := base64.StdEncoding.EncodeToString(sum[:])
	if _, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, d), Hash: "SHA-1", Element: el}, holderCNPJ()); err != nil {
		t.Fatal(err)
	}
	// Outro autor.
	el2 := eventoElemento("http://www.portalfiscal.inf.br/nfe", id, "CNPJ", cnpjOutro)
	s2 := sha1.Sum(el2) //nolint:gosec
	_, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, base64.StdEncoding.EncodeToString(s2[:])), Hash: "SHA-1", Element: el2}, holderCNPJ())
	refused(t, err, "autor")
	// Elemento que não é o referenciado.
	_, err = ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, zeroDigest), Hash: "SHA-1", Element: el}, holderCNPJ())
	refused(t, err, "digest")
	// Id do elemento diferente da referência.
	el3 := eventoElemento("http://www.portalfiscal.inf.br/nfe", "ID210210"+chaveDe(cnpjOutro)+"02", "CNPJ", cnpjTitular)
	s3 := sha1.Sum(el3) //nolint:gosec
	_, err = ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, base64.StdEncoding.EncodeToString(s3[:])), Hash: "SHA-1", Element: el3}, holderCNPJ())
	refused(t, err, "Id do elemento")
}

func TestHolderOf(t *testing.T) {
	ca := testpki.NewCA("ac teste")
	if h := HolderOf(ca.Titular("EMPRESA:"+cnpjTitular, cnpjTitular, "", nil).Cert); h.CNPJ != cnpjTitular || h.Inscricao() != cnpjTitular {
		t.Fatalf("CNPJ do SAN: %+v", h)
	}
	if h := HolderOf(ca.Titular("PESSOA", "", cpfTitular, nil).Cert); h.CPF != cpfTitular || h.Inscricao() != "000"+cpfTitular {
		t.Fatalf("CPF do SAN: %+v", h)
	}
	if h := HolderOf(ca.Titular("EMPRESA:"+cnpjOutro, "", "", nil).Cert); h.CNPJ != cnpjOutro {
		t.Fatalf("CN: %+v", h)
	}
	if h := HolderOf(ca.Titular("sem documento", "", "", nil).Cert); h.Inscricao() != "" {
		t.Fatalf("sem documento: %+v", h)
	}
}

type rsaKey struct{ k *rsa.PrivateKey }

func (r rsaKey) SignDigestInfo(di []byte) ([]byte, error) {
	return rsa.SignPKCS1v15(rand.Reader, r.k, crypto.Hash(0), di)
}

func TestSignDfeConfereComAChavePublica(t *testing.T) {
	ca := testpki.NewCA("ac teste")
	leaf := ca.Titular("EMPRESA:"+cnpjTitular, cnpjTitular, "", nil)
	si := mkSignedInfo("NFe"+chaveDe(cnpjTitular), zeroDigest)
	a, err := ValidateDfe(DfeRequest{SignedInfo: si, Hash: "SHA-1"}, HolderOf(leaf.Cert))
	if err != nil {
		t.Fatal(err)
	}
	sig, err := SignDfe(rsaKey{leaf.Key}, a, si)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha1.Sum(si) //nolint:gosec
	if err := rsa.VerifyPKCS1v15(&leaf.Key.PublicKey, crypto.SHA1, sum[:], sig); err != nil {
		t.Fatal(err)
	}
}

// Certificado da matriz assina o documento da filial (mesmo CNPJ-base) nos documentos da SEFAZ; na NFS-e, e para
// CPF, só o mesmo documento.
func TestDfeFilialPeloCNPJBase(t *testing.T) {
	filial := "11222333000262"
	for kind, id := range map[string]string{
		"nfe":          "NFe" + chaveDe(filial),
		"mdfe":         "MDFe" + chaveDe(filial),
		"evento":       "ID110111" + chaveDe(filial) + "01",
		"inutilizacao": "ID3526" + filial + "55001000000001000000009",
	} {
		if _, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, zeroDigest), Hash: "SHA-1"}, holderCNPJ()); err != nil {
			t.Fatalf("%s da filial: %v", kind, err)
		}
	}
	dps := "DPS35503082" + filial + "00001000000000000001"
	_, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(dps, zeroDigest), Hash: "SHA-1"}, holderCNPJ())
	refused(t, err, "emitente do Id")

	// Evento da filial como autor, sobre NF-e de outro emitente: passa pelo elemento.
	id := "ID210210" + chaveDe(cnpjOutro) + "01"
	el := eventoElemento("http://www.portalfiscal.inf.br/nfe", id, "CNPJ", filial)
	sum := sha1.Sum(el) //nolint:gosec
	if _, err := ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo(id, base64.StdEncoding.EncodeToString(sum[:])), Hash: "SHA-1", Element: el}, holderCNPJ()); err != nil {
		t.Fatalf("manifestação da filial: %v", err)
	}

	// Base 000xxxxx não cobre um emitente CPF (000 + CPF), que tem a mesma forma no Id.
	h := Holder{CNPJ: "00052998000100"}
	_, err = ValidateDfe(DfeRequest{SignedInfo: mkSignedInfo("NFe"+chaveDe("000"+cpfTitular), zeroDigest), Hash: "SHA-1"}, h)
	refused(t, err, "emitente do Id")
}
