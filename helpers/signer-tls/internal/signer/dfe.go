package signer

import (
	"bytes"
	"crypto"
	"crypto/sha1" //nolint:gosec // o leiaute dos DF-e atuais é RSA-SHA1 (ADR 0003)
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
)

// Holder é o titular do certificado, lido do SubjectAltName ICP-Brasil (DOC-ICP-04, item 7.1.2.3: otherName
// 2.16.76.1.3.3 com o CNPJ; 2.16.76.1.3.1 com nascimento, CPF, NIS, RG e órgão, o CPF nas posições 9 a 19). Sem
// essas extensões, cai para o sufixo `:<documento>` do CN, que as ACs da ICP-Brasil também usam.
type Holder struct {
	CNPJ string
	CPF  string
}

// Inscricao é o documento na forma em que aparece nos Ids dos DF-e: CNPJ (14) ou CPF com três zeros à esquerda.
func (h Holder) Inscricao() string {
	if h.CNPJ != "" {
		return h.CNPJ
	}
	if h.CPF != "" {
		return "000" + h.CPF
	}
	return ""
}

// cobre diz se o titular pode assinar pelo documento doc (na forma dos Ids). CPF só por igualdade. CNPJ por igualdade
// ou, nos documentos da SEFAZ (NF-e, NFC-e, MDF-e, CT-e, evento e inutilização), pelo CNPJ-base: o certificado da
// matriz assina o documento da filial (NF-e F03, rejeição 213, a mesma regra do conferirEmitenteDoCertificado do
// @sinete/nfe). Na forma dos Ids, o CPF vira 000 + CPF, que tem o mesmo tamanho de um CNPJ: um documento que começa
// com 000 só passa por igualdade, para uma base 000xxxxx não cobrir um CPF.
func (h Holder) cobre(doc, kind string) bool {
	insc := h.Inscricao()
	if doc == insc {
		return true
	}
	if h.CNPJ == "" || len(doc) != 14 || strings.HasPrefix(doc, "000") {
		return false
	}
	switch kind {
	case "nfe", "mdfe", "cte", "evento", "inutilizacao":
		return doc[:8] == h.CNPJ[:8]
	}
	return false
}

var (
	oidSAN  = asn1.ObjectIdentifier{2, 5, 29, 17}
	oidCNPJ = asn1.ObjectIdentifier{2, 16, 76, 1, 3, 3}
	oidCPF  = asn1.ObjectIdentifier{2, 16, 76, 1, 3, 1}
	cnRe    = regexp.MustCompile(`:([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$`)
	cnpjRe  = regexp.MustCompile(`^[0-9A-Z]{12}[0-9]{2}$`)
	cpfRe   = regexp.MustCompile(`^[0-9]{11}$`)
)

// HolderOf lê o titular da folha.
func HolderOf(leaf *x509.Certificate) Holder {
	var h Holder
	for _, ext := range leaf.Extensions {
		if !ext.Id.Equal(oidSAN) {
			continue
		}
		var seq asn1.RawValue
		if _, err := asn1.Unmarshal(ext.Value, &seq); err != nil {
			break
		}
		rest := seq.Bytes
		for len(rest) > 0 {
			var gn asn1.RawValue
			var err error
			if rest, err = asn1.Unmarshal(rest, &gn); err != nil {
				break
			}
			if gn.Class != asn1.ClassContextSpecific || gn.Tag != 0 {
				continue
			}
			var oid asn1.ObjectIdentifier
			inner, err := asn1.Unmarshal(gn.Bytes, &oid)
			if err != nil {
				continue
			}
			var explicit, value asn1.RawValue
			if _, err := asn1.Unmarshal(inner, &explicit); err != nil {
				continue
			}
			if _, err := asn1.Unmarshal(explicit.Bytes, &value); err != nil {
				continue
			}
			s := strings.TrimSpace(string(value.Bytes))
			switch {
			case oid.Equal(oidCNPJ) && cnpjRe.MatchString(s):
				h.CNPJ = s
			case oid.Equal(oidCPF) && len(s) >= 19 && cpfRe.MatchString(s[8:19]):
				h.CPF = s[8:19]
			}
		}
	}
	if h.CNPJ == "" && h.CPF == "" {
		if m := cnRe.FindStringSubmatch(leaf.Subject.CommonName); m != nil {
			if len(m[1]) == 11 {
				h.CPF = m[1]
			} else {
				h.CNPJ = m[1]
			}
		}
	}
	return h
}

// Algoritmos da XMLDSig aceitos no SignedInfo (ADR 0003; SHA-256 para leiautes futuros).
const (
	algC14N      = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
	algEnveloped = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
	dsigNS       = "http://www.w3.org/2000/09/xmldsig#"
)

var (
	sigMethods    = map[string]crypto.Hash{"http://www.w3.org/2000/09/xmldsig#rsa-sha1": crypto.SHA1, "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256": crypto.SHA256}
	digestMethods = map[string]crypto.Hash{"http://www.w3.org/2000/09/xmldsig#sha1": crypto.SHA1, "http://www.w3.org/2001/04/xmlenc#sha256": crypto.SHA256}
)

// Formação dos Ids que referenciam documento fiscal. A chave de acesso tem cUF (2) + AAMM (4) + CNPJ ou CPF do
// emitente (14; CNPJ alfanumérico pela NT 2025.001) + modelo, série, número, tpEmis, cNF e DV (24) (MOC 7.0, item
// 5.4). Os demais: evento da NF-e e do MDF-e (`ID` + tpEvento + chave + nSeqEvento, MOC 7.0 Anexo II e MOC do MDF-e),
// inutilização (`ID` + cUF + ano + CNPJ + modelo + série + números, leiaute infInut), DPS e pedido de registro de
// evento da NFS-e Nacional (leiaute 1.01, Anexos I e II; ver packages/nfse/src/codigos.ts).
const chave = `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`

var (
	idDocumento = regexp.MustCompile(`^(NFe|MDFe|CTe)(` + chave + `)$`)
	idEvento    = regexp.MustCompile(`^ID[0-9]{6}(` + chave + `)[0-9]{2,3}$`)
	idInut      = regexp.MustCompile(`^ID[0-9]{4}([0-9A-Z]{12}[0-9]{2})[0-9]{23}$`)
	idDPS       = regexp.MustCompile(`^DPS[0-9]{7}[12]([0-9A-Z]{14})[0-9]{20}$`)
	idPRE       = regexp.MustCompile(`^PRE[0-9]{8}[12]([0-9A-Z]{14})[0-9]{27}[0-9]{6}$`)
)

// Namespaces e elementos que podem ser a raiz do elemento referenciado, quando ele vem junto.
var elementoAutor = map[string]map[string][]string{
	"http://www.portalfiscal.inf.br/nfe":  {"infEvento": {"CNPJ", "CPF"}},
	"http://www.portalfiscal.inf.br/mdfe": {"infEvento": {"CNPJ", "CPF"}},
	"http://www.portalfiscal.inf.br/cte":  {"infEvento": {"CNPJ", "CPF"}},
	"http://www.sped.fazenda.gov.br/nfse": {"infPedReg": {"CNPJAutor", "CPFAutor"}},
}

// DfeRequest é o pedido de assinatura de um documento fiscal com a chave que o helper controla.
type DfeRequest struct {
	// SignedInfo canonicalizado (C14N 1.0), exatamente os bytes que a assinatura cobre.
	SignedInfo []byte
	// Hash da assinatura, "SHA-1" ou "SHA-256"; tem de bater com o SignatureMethod.
	Hash string
	// Element é o elemento referenciado, canonicalizado. Opcional; obrigatório para evento cujo autor não é o
	// emitente da chave (manifestação do destinatário, por exemplo), em que o Id não diz quem é o autor.
	Element []byte
}

// DfeApproved diz o que foi aprovado, para a auditoria.
type DfeApproved struct {
	Reference string
	Kind      string
	Hash      crypto.Hash
}

func dfeRefuse(format string, a ...any) error {
	return protocol.Errorf(protocol.CodeDfeRefused, format, a...)
}

// ValidateDfe confere um pedido de dfe.sign. Não existe hash cego: o helper calcula o hash do SignedInfo, confere
// que o SignedInfo tem o perfil dos DF-e, que a referência é um Id de documento fiscal e que o titular do certificado
// é o emitente ou o autor. A C14N é do cliente; o helper valida os bytes canônicos, que são o que a assinatura cobre.
func ValidateDfe(req DfeRequest, holder Holder) (DfeApproved, error) {
	var none DfeApproved
	insc := holder.Inscricao()
	if insc == "" {
		return none, dfeRefuse("o certificado não tem CNPJ nem CPF da ICP-Brasil: o helper não sabe de quem é a chave")
	}
	si, err := parseSignedInfo(req.SignedInfo)
	if err != nil {
		return none, err
	}
	want := map[string]crypto.Hash{"SHA-1": crypto.SHA1, "SHA-256": crypto.SHA256}[req.Hash]
	if want == 0 || want != si.sigHash {
		return none, dfeRefuse("hash %q não bate com o SignatureMethod do SignedInfo", req.Hash)
	}
	id := si.ref
	out := DfeApproved{Reference: id, Hash: si.sigHash}
	var embedded, kind string
	switch {
	case idDocumento.MatchString(id):
		m := idDocumento.FindStringSubmatch(id)
		embedded, kind = m[2][6:20], strings.ToLower(m[1])
	case idEvento.MatchString(id):
		embedded, kind = idEvento.FindStringSubmatch(id)[1][6:20], "evento"
	case idInut.MatchString(id):
		embedded, kind = idInut.FindStringSubmatch(id)[1], "inutilizacao"
	case idDPS.MatchString(id):
		embedded, kind = idDPS.FindStringSubmatch(id)[1], "dps"
	case idPRE.MatchString(id):
		embedded, kind = idPRE.FindStringSubmatch(id)[1], "evento-nfse"
	default:
		return none, dfeRefuse("a referência #%s não é Id de documento fiscal", id)
	}
	out.Kind = kind
	if req.Element != nil {
		author, err := checkElement(req.Element, id, si)
		if err != nil {
			return none, err
		}
		if author != "" {
			if !holder.cobre(author, kind) && "000"+author != insc {
				return none, dfeRefuse("o autor do evento (%s) não é o titular do certificado", mask(author))
			}
			return out, nil
		}
	}
	if !holder.cobre(embedded, kind) {
		if kind == "evento" || kind == "evento-nfse" {
			return none, dfeRefuse("o documento do Id (%s) não é o titular do certificado; para evento como destinatário ou terceiro, mande o elemento canonicalizado (element)", mask(embedded))
		}
		return none, dfeRefuse("o emitente do Id (%s) não é o titular do certificado", mask(embedded))
	}
	return out, nil
}

// mask mostra só o começo do documento no erro: o suficiente para diagnóstico, sem expor o número inteiro no log.
func mask(doc string) string {
	if len(doc) <= 8 {
		return doc
	}
	return doc[:8] + strings.Repeat("*", len(doc)-8)
}

type signedInfo struct {
	sigHash    crypto.Hash
	digestHash crypto.Hash
	ref        string
	digest     []byte
}

// parseSignedInfo exige exatamente a forma que o @sinete/core/xml produz: SignedInfo com C14N 1.0, um só Reference
// com as transformações enveloped e C14N 1.0, sem comentário, texto solto ou elemento a mais.
func parseSignedInfo(b []byte) (signedInfo, error) {
	var out signedInfo
	dec := xml.NewDecoder(bytes.NewReader(b))
	dec.Strict = true
	type step struct {
		name string
		attr string // atributo exigido ("" = nenhum além de xmlns)
	}
	expect := []step{
		{"SignedInfo", ""}, {"CanonicalizationMethod", "Algorithm"}, {"/CanonicalizationMethod", ""},
		{"SignatureMethod", "Algorithm"}, {"/SignatureMethod", ""}, {"Reference", "URI"}, {"Transforms", ""},
		{"Transform", "Algorithm"}, {"/Transform", ""}, {"Transform", "Algorithm"}, {"/Transform", ""},
		{"/Transforms", ""}, {"DigestMethod", "Algorithm"}, {"/DigestMethod", ""}, {"DigestValue", ""},
		{"#text", ""}, {"/DigestValue", ""}, {"/Reference", ""}, {"/SignedInfo", ""},
	}
	var transforms []string
	for i := 0; ; i++ {
		tok, err := dec.RawToken()
		if err == io.EOF {
			if i != len(expect) {
				return out, dfeRefuse("SignedInfo incompleto")
			}
			break
		}
		if err != nil {
			return out, dfeRefuse("SignedInfo não é XML bem formado: %v", err)
		}
		if i >= len(expect) {
			return out, dfeRefuse("conteúdo depois do SignedInfo")
		}
		st := expect[i]
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local != st.name || t.Name.Space != "" {
				return out, dfeRefuse("SignedInfo fora do perfil dos DF-e: esperado %s, veio <%s>", st.name, t.Name.Local)
			}
			var val string
			hasDsigNS := false
			for _, a := range t.Attr {
				switch {
				case a.Name.Space == "" && a.Name.Local == "xmlns":
					hasDsigNS = a.Value == dsigNS
					if i > 0 {
						return out, dfeRefuse("declaração de namespace fora do SignedInfo")
					}
				case a.Name.Space == "xmlns" && i == 0:
					// namespaces herdados dos ancestrais, que a C14N inclusiva escreve no SignedInfo
				case a.Name.Space == "" && a.Name.Local == st.attr:
					val = a.Value
				default:
					return out, dfeRefuse("atributo inesperado em %s: %s", st.name, a.Name.Local)
				}
			}
			if i == 0 && !hasDsigNS {
				return out, dfeRefuse("SignedInfo sem o namespace da XMLDSig")
			}
			if st.attr != "" && val == "" {
				return out, dfeRefuse("%s sem %s", st.name, st.attr)
			}
			switch st.name {
			case "CanonicalizationMethod":
				if val != algC14N {
					return out, dfeRefuse("CanonicalizationMethod não é C14N 1.0")
				}
			case "SignatureMethod":
				out.sigHash = sigMethods[val]
				if out.sigHash == 0 {
					return out, dfeRefuse("SignatureMethod não permitido: %s", val)
				}
			case "Reference":
				if !strings.HasPrefix(val, "#") || len(val) < 2 {
					return out, dfeRefuse("Reference sem URI local (#Id)")
				}
				out.ref = val[1:]
			case "Transform":
				transforms = append(transforms, val)
			case "DigestMethod":
				out.digestHash = digestMethods[val]
				if out.digestHash == 0 {
					return out, dfeRefuse("DigestMethod não permitido: %s", val)
				}
			}
		case xml.EndElement:
			if "/"+t.Name.Local != st.name {
				return out, dfeRefuse("SignedInfo fora do perfil dos DF-e: esperado %s, veio </%s>", st.name, t.Name.Local)
			}
		case xml.CharData:
			if st.name != "#text" {
				return out, dfeRefuse("texto inesperado no SignedInfo")
			}
			d, err := base64.StdEncoding.DecodeString(string(t))
			if err != nil || len(d) != out.digestHash.Size() {
				return out, dfeRefuse("DigestValue inválido")
			}
			out.digest = d
		default:
			return out, dfeRefuse("comentário, instrução ou declaração no SignedInfo")
		}
	}
	if len(transforms) != 2 || transforms[0] != algEnveloped || transforms[1] != algC14N {
		return out, dfeRefuse("Transforms fora do perfil dos DF-e (enveloped-signature e C14N 1.0)")
	}
	return out, nil
}

// checkElement confere que o elemento canonicalizado é o referenciado (Id e digest) e devolve o autor, quando o
// elemento é um evento. Para os outros elementos devolve "", e vale a regra do Id.
func checkElement(el []byte, id string, si signedInfo) (string, error) {
	var sum []byte
	switch si.digestHash {
	case crypto.SHA1:
		s := sha1.Sum(el) //nolint:gosec
		sum = s[:]
	case crypto.SHA256:
		s := sha256.Sum256(el)
		sum = s[:]
	}
	if !bytes.Equal(sum, si.digest) {
		return "", dfeRefuse("o digest do elemento não é o DigestValue do SignedInfo")
	}
	dec := xml.NewDecoder(bytes.NewReader(el))
	dec.Strict = true
	depth := 0
	var root xml.StartElement
	var authorFields []string
	current := ""
	author := ""
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", dfeRefuse("elemento não é XML bem formado: %v", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			depth++
			if depth == 1 {
				root = t
				fields, ok := elementoAutor[t.Name.Space][t.Name.Local]
				if !ok {
					return "", nil
				}
				authorFields = fields
				gotID := ""
				for _, a := range t.Attr {
					if a.Name.Local == "Id" && a.Name.Space == "" {
						gotID = a.Value
					}
				}
				if gotID != id {
					return "", dfeRefuse("o Id do elemento não é o da referência")
				}
			} else if depth == 2 && t.Name.Space == root.Name.Space {
				current = t.Name.Local
			}
		case xml.EndElement:
			depth--
			current = ""
		case xml.CharData:
			if depth == 2 {
				for _, f := range authorFields {
					if current == f {
						if author != "" {
							return "", dfeRefuse("evento com mais de um autor")
						}
						author = strings.TrimSpace(string(t))
					}
				}
			}
		case xml.Directive, xml.ProcInst:
			return "", dfeRefuse("declaração ou instrução no elemento")
		}
	}
	if author == "" {
		return "", dfeRefuse("evento sem CNPJ ou CPF do autor")
	}
	return author, nil
}

// SignDfe assina o SignedInfo aprovado com a chave do token: o hash é calculado aqui.
func SignDfe(key DigestSigner, approved DfeApproved, signedInfo []byte) ([]byte, error) {
	var digest []byte
	switch approved.Hash {
	case crypto.SHA1:
		s := sha1.Sum(signedInfo) //nolint:gosec
		digest = s[:]
	case crypto.SHA256:
		s := sha256.Sum256(signedInfo)
		digest = s[:]
	default:
		return nil, fmt.Errorf("hash não suportado")
	}
	di, err := DigestInfo(approved.Hash, digest)
	if err != nil {
		return nil, err
	}
	sig, err := key.SignDigestInfo(di)
	if err != nil {
		return nil, protocol.Errorf(protocol.CodePKCS11, "%v", err)
	}
	return sig, nil
}
