// Package policy é a guarda do helper: decide, antes de abrir qualquer socket, se uma requisição pode sair. Tem a
// mesma semântica da allowlistPolicy do @sinete/transport (hosts, porta 443, tpAmb no corpo), mais as travas fixas
// (só https, sem credencial na URL, Host igual ao da URL), com a lista de hosts compilada no binário a partir dos
// dados de endpoints (data_gen.go). As duas implementações rodam os mesmos casos de
// docs/signer-contract/fixtures/guard.json.
package policy

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

// Error é uma recusa da guarda. Sempre acontece antes de qualquer socket.
type Error struct{ Msg string }

func (e *Error) Error() string { return e.Msg }

func refuse(format string, a ...any) error { return &Error{fmt.Sprintf(format, a...)} }

// Ambientes aceitos por New.
var Ambientes = []string{"homologacao", "producao"}

// Guard aplica a política de hosts.
type Guard struct {
	// Lab aceita só loopback (127.0.0.0/8, ::1, localhost), em qualquer porta, e nada da lista de hosts. Existe para
	// os testes e o laboratório; um helper em --lab nunca fala com a SEFAZ.
	Lab   bool
	hosts map[string]bool
	// TpAmb, quando não vazio, exige que todo <tpAmb> do corpo tenha este valor.
	TpAmb string
	// RequireTpAmb recusa POST sem nenhum <tpAmb> no corpo (só com TpAmb).
	RequireTpAmb bool
}

// New monta a guarda com os hosts compilados dos ambientes pedidos.
func New(ambientes []string) (*Guard, error) {
	g := &Guard{hosts: map[string]bool{}}
	for _, a := range ambientes {
		hs, ok := hostsByAmbiente[a]
		if !ok {
			return nil, fmt.Errorf("ambiente desconhecido: %q (use %s)", a, strings.Join(Ambientes, ", "))
		}
		for _, h := range hs {
			g.hosts[h] = true
		}
	}
	return g, nil
}

// NewLab monta a guarda do laboratório: só loopback.
func NewLab() *Guard { return &Guard{Lab: true, hosts: map[string]bool{}} }

// Hosts devolve a lista de hosts aceitos, em ordem.
func (g *Guard) Hosts() []string {
	out := make([]string, 0, len(g.hosts))
	for h := range g.hosts {
		out = append(out, h)
	}
	slices.Sort(out)
	return out
}

// Target é o destino aprovado.
type Target struct {
	Host string // minúsculo, sem porta
	Addr string // host:porta para o dial
}

// Elemento tpAmb com qualquer prefixo e atributos, ou vazio; o valor é o texto até o próximo '<' (mesma expressão da
// allowlistPolicy do @sinete/transport).
var tpAmbRe = regexp.MustCompile(`<(?:[\w.-]+:)?tpAmb(?:\s[^>]*?)?(?:/>|>([^<]*)<)`)
var (
	commentRe = regexp.MustCompile(`(?s)<!--.*?-->`)
	cdataRe   = regexp.MustCompile(`(?s)<!\[CDATA\[.*?\]\]>`)
	piRe      = regexp.MustCompile(`(?s)<\?.*?\?>`)
)

// Check confere a requisição. headers tem os nomes como vieram; a comparação é sem diferenciar maiúsculas.
func (g *Guard) Check(rawURL, method string, headers map[string]string, body []byte) (Target, error) {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return Target{}, refuse("URL inválida")
	}
	if u.Scheme != "https" {
		return Target{}, refuse("só https: %s", u.Scheme)
	}
	if u.User != nil {
		return Target{}, refuse("credencial na URL")
	}
	if method != "GET" && method != "POST" {
		return Target{}, refuse("método não permitido: %s", method)
	}
	host := strings.ToLower(u.Hostname())
	port := u.Port()
	for k, v := range headers {
		// Um Host diferente mudaria o virtual host atendido pelo mesmo IP depois de a guarda aprovar outro.
		if strings.EqualFold(k, "host") && !strings.EqualFold(strings.TrimSpace(v), u.Host) {
			return Target{}, refuse("cabeçalho Host diferente do host da URL: %q", v)
		}
	}
	if g.Lab {
		ip := net.ParseIP(host)
		if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return Target{}, refuse("modo laboratório: só loopback (%s recusado)", host)
		}
		if port == "" {
			port = "443"
		}
	} else {
		if port != "" && port != "443" {
			return Target{}, refuse("porta não permitida: %s", port)
		}
		port = "443"
		if !g.hosts[host] {
			return Target{}, refuse("host fora da allowlist: %s", host)
		}
	}
	if g.TpAmb != "" {
		text := piRe.ReplaceAllString(cdataRe.ReplaceAllString(commentRe.ReplaceAllString(string(body), ""), ""), "")
		var wrong []string
		found := 0
		for _, m := range tpAmbRe.FindAllStringSubmatch(text, -1) {
			found++
			if v := strings.TrimSpace(m[1]); v != g.TpAmb {
				wrong = append(wrong, v)
			}
		}
		if len(wrong) > 0 {
			return Target{}, refuse("tpAmb diferente de %s no corpo: %s", g.TpAmb, strings.Join(wrong, ","))
		}
		if g.RequireTpAmb && method == "POST" && found == 0 {
			return Target{}, refuse("corpo sem tpAmb e a política exige")
		}
	}
	return Target{Host: host, Addr: net.JoinHostPort(host, port)}, nil
}

// RSAKex diz se o host precisa da troca de chave RSA (perfil só com DHE). No laboratório, vale para 127.0.0.1, para
// que o teste prove a troca RSA com certificado de cliente.
func (g *Guard) RSAKex(host string) bool {
	// O nome chega do dial como está na URL; a guarda aceitou em minúsculas, e o perfil tem de valer do mesmo jeito.
	host = strings.ToLower(host)
	if g.Lab {
		return host == "127.0.0.1"
	}
	return rsaKexHosts[host]
}

// Roots monta a confiança TLS: loja do sistema mais as ACs ICP-Brasil compiladas. No laboratório, só as ACs extras,
// para provar que a validação do servidor está ligada.
func (g *Guard) Roots(extraPEM []string) (*x509.CertPool, error) {
	var pool *x509.CertPool
	if g.Lab {
		pool = x509.NewCertPool()
	} else {
		sys, err := x509.SystemCertPool()
		if err != nil || sys == nil {
			sys = x509.NewCertPool()
		}
		pool = sys
		if !pool.AppendCertsFromPEM([]byte(icpBrasilTLS)) {
			return nil, fmt.Errorf("bundle ICP-Brasil compilado inválido")
		}
	}
	for i, p := range extraPEM {
		if !pool.AppendCertsFromPEM([]byte(p)) {
			return nil, refuse("additionalCa[%d] não é PEM de certificado", i)
		}
	}
	return pool, nil
}

// Perfil TLS do helper (ADR 0005, decisão 4): só TLS 1.2; ECDHE com GCM, ChaCha20 e CBC sempre; troca RSA só para o
// host cujo perfil pede.
var (
	suitesModern = []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256}
	// BA produção, AN (www e hom1) e PR só aceitam CBC com ECDHE; 0xc027, 0xc013 e 0xc014 existem no Go.
	suitesCBC = []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA, tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA}
	// GO produção: só DHE-RSA-AES128-GCM ou troca RSA. O Go não tem DHE.
	suitesRSAKex = []uint16{tls.TLS_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_RSA_WITH_AES_256_GCM_SHA384}
)

// Suites devolve as suítes oferecidas ao host.
func (g *Guard) Suites(host string) []uint16 {
	s := slices.Concat(suitesModern, suitesCBC)
	if g.RSAKex(host) {
		s = append(s, suitesRSAKex...)
	}
	return s
}
