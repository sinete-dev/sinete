// Spike S4: guarda dura do helper, com a mesma semântica de spikes/s2-tls/real/guard.ts,
// mais estreita: só NF-e e MDF-e HOMOLOGAÇÃO (sem NFS-e) e só NfeStatusServico/MDFeStatusServico.
// Tudo é checado ANTES de abrir socket. Em --lab, só loopback é permitido (e nada da SEFAZ).
package main

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Lista fechada, escrita à mão e compilada no binário (conferida contra s2-tls/endpoints.json de 25/09/2026).
var allowedHosts = map[string]string{
	"homnfe.sefaz.am.gov.br":            "nfe-hom:AM",
	"hnfe.sefaz.ba.gov.br":              "nfe-hom:BA",
	"homolog.sefaz.go.gov.br":           "nfe-hom:GO",
	"hnfe.fazenda.mg.gov.br":            "nfe-hom:MG",
	"hom.nfe.sefaz.ms.gov.br":           "nfe-hom:MS",
	"homologacao.sefaz.mt.gov.br":       "nfe-hom:MT",
	"nfehomolog.sefaz.pe.gov.br":        "nfe-hom:PE",
	"homologacao.nfe.sefa.pr.gov.br":    "nfe-hom:PR",
	"nfe-homologacao.sefazrs.rs.gov.br": "nfe-hom:RS",
	"homologacao.nfe.fazenda.sp.gov.br": "nfe-hom:SP",
	"hom.sefazvirtual.fazenda.gov.br":   "nfe-hom:SVAN/SVC-AN",
	"nfe-homologacao.svrs.rs.gov.br":    "nfe-hom:SVRS/SVC-RS",
	"hom1.nfe.fazenda.gov.br":           "nfe-hom:AN",
	"mdfe-homologacao.svrs.rs.gov.br":   "mdfe-hom:SVRS",
}

// Operações permitidas nesta rodada: só consulta de status.
var allowedActions = regexp.MustCompile(`action="http://www\.portalfiscal\.inf\.br/(nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF|mdfe/wsdl/MDFeStatusServico/mdfeStatusServicoMDF)"`)
var tpAmbRe = regexp.MustCompile(`<tpAmb>\s*([^<\s]*)\s*</tpAmb>`)

type guard struct {
	lab bool
}

type target struct {
	Host string
	Addr string
	Kind string
}

func (g *guard) check(rawURL, method string, headers map[string]string, body []byte) (target, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return target{}, errCode("guard", "URL inválida")
	}
	if u.Scheme != "https" {
		return target{}, errCode("guard", "só https: %s", u.Scheme)
	}
	if u.User != nil {
		return target{}, errCode("guard", "credencial na URL")
	}
	host := strings.ToLower(u.Hostname())
	port := u.Port()
	if g.lab {
		ip := net.ParseIP(host)
		if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return target{}, errCode("guard", "modo lab: só loopback (%s recusado)", host)
		}
		if port == "" {
			port = "443"
		}
		return target{Host: host, Addr: net.JoinHostPort(host, port), Kind: "lab"}, nil
	}
	if port != "" && port != "443" {
		return target{}, errCode("guard", "porta não permitida: %s", port)
	}
	kind, ok := allowedHosts[host]
	if !ok {
		return target{}, errCode("guard", "host fora da allowlist (produção ou desconhecido): %s", host)
	}
	if method != "POST" {
		return target{}, errCode("guard", "só POST SOAP nesta rodada")
	}
	ct := ""
	for k, v := range headers {
		if strings.EqualFold(k, "content-type") {
			ct = v
		}
	}
	if !allowedActions.MatchString(ct) {
		return target{}, errCode("guard", "operação não permitida nesta rodada (só StatusServico): %q", ct)
	}
	amb := tpAmbRe.FindAllSubmatch(body, -1)
	if len(amb) == 0 {
		return target{}, errCode("guard", "corpo sem tpAmb")
	}
	for _, m := range amb {
		if string(m[1]) != "2" {
			return target{}, errCode("guard", "tpAmb diferente de 2: %s", m[1])
		}
	}
	return target{Host: host, Addr: net.JoinHostPort(host, "443"), Kind: kind}, nil
}

var ledgerMu sync.Mutex

// logUse grava uma linha por uso da identidade fora do lab. Nunca segredo: hora, runtime, host, serviço, resultado.
func logUse(identityCN, host, service, outcome string) {
	home, _ := os.UserHomeDir()
	path := filepath.Join(home, ".local/state/sinete/cert-usage.log")
	_ = os.MkdirAll(filepath.Dir(path), 0o700)
	clean := func(s string) string {
		s = strings.NewReplacer("\r", " ", "\n", " ", "\t", " ").Replace(s)
		if len(s) > 300 {
			s = s[:300]
		}
		return s
	}
	ledgerMu.Lock()
	defer ledgerMu.Unlock()
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s\t%s\t%s\t%s\t%s\n", time.Now().UTC().Format(time.RFC3339Nano), clean("go-helper s4 ("+identityCN+")"), clean(host), clean(service), clean(outcome))
}
