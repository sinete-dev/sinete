package policy

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

// Os casos de docs/signer-contract/fixtures/guard.json valem para o helper e para a allowlistPolicy do
// @sinete/transport (packages/transport/test/signer-contract.test.ts).
func TestGuardFixtures(t *testing.T) {
	raw, err := os.ReadFile("../../../../docs/signer-contract/fixtures/guard.json")
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Cases []struct {
			Name         string            `json:"name"`
			Ambientes    []string          `json:"ambientes"`
			TpAmb        string            `json:"tpAmb"`
			RequireTpAmb bool              `json:"requireTpAmb"`
			URL          string            `json:"url"`
			Method       string            `json:"method"`
			Headers      map[string]string `json:"headers"`
			Body         string            `json:"body"`
			Allow        bool              `json:"allow"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.Cases) < 10 {
		t.Fatalf("poucos casos: %d", len(fx.Cases))
	}
	for _, c := range fx.Cases {
		t.Run(c.Name, func(t *testing.T) {
			var g *Guard
			if len(c.Ambientes) == 0 {
				g = NewLab()
			} else {
				var err error
				if g, err = New(c.Ambientes); err != nil {
					t.Fatal(err)
				}
			}
			g.TpAmb, g.RequireTpAmb = c.TpAmb, c.RequireTpAmb
			_, err := g.Check(c.URL, c.Method, c.Headers, []byte(c.Body))
			if (err == nil) != c.Allow {
				t.Fatalf("esperado allow=%v, veio erro %v", c.Allow, err)
			}
		})
	}
}

func TestAmbienteDesconhecido(t *testing.T) {
	if _, err := New([]string{"prod"}); err == nil {
		t.Fatal("ambiente desconhecido passou")
	}
}

func TestDadosCompilados(t *testing.T) {
	g, _ := New([]string{"homologacao"})
	hs := g.Hosts()
	for _, h := range []string{"homologacao.nfe.fazenda.sp.gov.br", "nfe-homologacao.svrs.rs.gov.br", "mdfe-homologacao.svrs.rs.gov.br"} {
		if !slices.Contains(hs, h) {
			t.Errorf("%s fora da lista de homologação", h)
		}
	}
	if slices.Contains(hs, "nfe.fazenda.sp.gov.br") {
		t.Error("host de produção na lista de homologação")
	}
	p, _ := New([]string{"producao"})
	if !p.RSAKex("nfe.sefaz.go.gov.br") || p.RSAKex("nfe.fazenda.sp.gov.br") {
		t.Error("troca RSA fora do perfil medido")
	}
	if slices.Contains(p.Suites("nfe.fazenda.sp.gov.br"), suitesRSAKex[0]) {
		t.Error("suíte de troca RSA oferecida a host que não pede")
	}
	if !slices.Contains(p.Suites("nfe.sefaz.go.gov.br"), suitesRSAKex[0]) {
		t.Error("GO produção sem troca RSA")
	}
	if _, err := p.Roots(nil); err != nil {
		t.Fatal(err)
	}
	if _, err := p.Roots([]string{"lixo"}); err == nil {
		t.Error("additionalCa inválido passou")
	}
}

// O perfil de suítes vale para o host em qualquer caixa, como a guarda (a URL pode vir em maiúsculas).
func TestRSAKexIgnoraCaixa(t *testing.T) {
	g, err := New([]string{"producao"})
	if err != nil {
		t.Fatal(err)
	}
	if !g.RSAKex("NFE.SEFAZ.GO.GOV.BR") || !g.RSAKex("nfe.sefaz.go.gov.br") {
		t.Fatal("RSAKex depende da caixa do host")
	}
	if len(g.Suites("NFE.SEFAZ.GO.GOV.BR")) != len(g.Suites("nfe.sefaz.go.gov.br")) {
		t.Fatal("Suites depende da caixa do host")
	}
	if g.RSAKex("nfe.fazenda.sp.gov.br") {
		t.Fatal("troca RSA fora do perfil")
	}
}
