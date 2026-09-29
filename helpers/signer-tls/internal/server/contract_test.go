package server

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/signer"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

const contractDir = "../../../../docs/signer-contract"

type fxFrame struct {
	From   string          `json:"from"`
	Of     string          `json:"of"`
	Flavor string          `json:"flavor"`
	Frame  json.RawMessage `json:"frame"`
}

type fxFile struct {
	Description string    `json:"description"`
	Frames      []fxFrame `json:"frames"`
}

func loadFixture(t *testing.T, name string) fxFile {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(contractDir, "fixtures", name))
	if err != nil {
		t.Fatal(err)
	}
	var f fxFile
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

func decodeFrame(t *testing.T, raw json.RawMessage) protocol.Frame {
	t.Helper()
	var f protocol.Frame
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

func keys(raw json.RawMessage) []string {
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}

func TestContratoVersao(t *testing.T) {
	b, err := os.ReadFile(filepath.Join(contractDir, "PROTOCOL_VERSION"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(b)) != "1" || protocol.Version != 1 {
		t.Fatalf("PROTOCOL_VERSION %q, helper %d", b, protocol.Version)
	}
}

// Toda fixture decodifica no Frame do helper com v=1 (exceto o frame que testa a versão).
func TestContratoFixturesDecodificam(t *testing.T) {
	files, _ := filepath.Glob(filepath.Join(contractDir, "fixtures", "*.json"))
	n := 0
	for _, path := range files {
		if filepath.Base(path) == "guard.json" {
			continue
		}
		f := loadFixture(t, filepath.Base(path))
		for _, fr := range f.Frames {
			got := decodeFrame(t, fr.Frame)
			if got.ID == "" || (got.Method == "" && got.Result == nil && got.Error == nil) {
				t.Errorf("%s: frame incompleto: %s", path, fr.Frame)
			}
			if got.Error != nil && !slices.Contains(allCodes, got.Error.Code) {
				t.Errorf("%s: código fora do contrato: %s", path, got.Error.Code)
			}
			n++
		}
	}
	if n < 20 {
		t.Fatalf("poucos frames nas fixtures: %d", n)
	}
}

var allCodes = []string{protocol.CodeProtocolVersion, protocol.CodeUnknownMethod, protocol.CodeBadRequest, protocol.CodeGuard, protocol.CodeForbidden, protocol.CodeUnknownIdentity, protocol.CodeIdentityExists, protocol.CodePKCS11, protocol.CodeTransport, protocol.CodeSignRefused, protocol.CodeSignTimeout, protocol.CodeDfeRefused, protocol.CodeClosed, protocol.CodeError}

func TestContratoHello(t *testing.T) {
	fx := loadFixture(t, "hello.json")
	g, _ := policy.New([]string{"homologacao"})
	c := newClient(t, g)
	req := decodeFrame(t, fx.Frames[0].Frame)
	got := c.raw(req)
	want := decodeFrame(t, fx.Frames[1].Frame)
	if got.Error != nil || !slices.Equal(keys(got.Result), keys(want.Result)) {
		t.Fatalf("hello: chaves %v, fixture %v (%v)", keys(got.Result), keys(want.Result), got.Error)
	}
	var r struct {
		Protocol  int      `json:"protocol"`
		Backends  []string `json:"backends"`
		Ambientes []string `json:"ambientes"`
	}
	_ = json.Unmarshal(got.Result, &r)
	if r.Protocol != 1 || slices.Contains(r.Backends, "pkcs11") != signer.HasPKCS11 || !slices.Equal(r.Ambientes, []string{"homologacao"}) {
		t.Fatalf("hello: %s", got.Result)
	}
	bad := c.raw(protocol.Frame{V: 1, ID: "c2", Method: "hello", Params: []byte(`{"protocol":2}`)})
	if bad.Error == nil || bad.Error.Code != protocol.CodeProtocolVersion {
		t.Fatalf("hello v2: %v", bad.Error)
	}
}

// Reproduz as trocas determinísticas das fixtures: o helper tem de devolver o mesmo código e a mesma mensagem, ou,
// no resultado, as mesmas chaves.
func replay(t *testing.T, c *client, fx fxFile, skip map[string]bool) {
	t.Helper()
	for i := 0; i < len(fx.Frames); i++ {
		fr := fx.Frames[i]
		if fr.From != "client" {
			continue
		}
		req := decodeFrame(t, fr.Frame)
		if req.Method == "" || skip[req.ID] {
			continue
		}
		var want *fxFrame
		for j := i + 1; j < len(fx.Frames); j++ {
			w := decodeFrame(t, fx.Frames[j].Frame)
			flavorOK := fx.Frames[j].Flavor == "" || (fx.Frames[j].Flavor == "p11") == signer.HasPKCS11
			if fx.Frames[j].From == "helper" && w.ID == req.ID && flavorOK {
				want = &fx.Frames[j]
				break
			}
		}
		if want == nil {
			continue
		}
		got := c.raw(req)
		w := decodeFrame(t, want.Frame)
		switch {
		case w.Error != nil:
			if got.Error == nil || got.Error.Code != w.Error.Code || got.Error.Message != w.Error.Message {
				t.Errorf("%s: esperado %v, veio %v %s", req.ID, w.Error, got.Error, got.Result)
			}
		default:
			if got.Error != nil || !slices.Equal(keys(got.Result), keys(w.Result)) {
				t.Errorf("%s: chaves %v, fixture %v (%v)", req.ID, keys(got.Result), keys(w.Result), got.Error)
			}
		}
	}
}

func openFixtureIdentity(t *testing.T, c *client) {
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA DE TESTE:11222333000181", "11222333000181", "", nil)
	c.mustCall("identity.open", map[string]any{"id": "emitente-11222333000181", "backend": "remote", "mode": "digest", "chain": []string{base64.StdEncoding.EncodeToString(leaf.DER), base64.StdEncoding.EncodeToString(ca.Cert.Raw)}})
}

func TestContratoErros(t *testing.T) {
	g, _ := policy.New([]string{"homologacao"})
	c := newClient(t, g)
	openFixtureIdentity(t, c)
	replay(t, c, loadFixture(t, "errors.json"), nil)
}

func TestContratoCicloDeVida(t *testing.T) {
	c := newClient(t, policy.NewLab())
	openFixtureIdentity(t, c)
	replay(t, c, loadFixture(t, "lifecycle.json"), nil)
}

func TestContratoDfeNoRemote(t *testing.T) {
	c := newClient(t, policy.NewLab())
	openFixtureIdentity(t, c)
	// c8 e c9 precisam de token; c10 é o forbidden do backend remote.
	replay(t, c, loadFixture(t, "dfe_sign.json"), map[string]bool{"c8": true, "c9": true})
}

func TestContratoPKCS11NoSaborEstatico(t *testing.T) {
	if signer.HasPKCS11 {
		t.Skip("sabor com cgo: o módulo da fixture não existe; coberto pelo teste com SoftHSM")
	}
	c := newClient(t, policy.NewLab())
	replay(t, c, loadFixture(t, "identity_open_pkcs11.json"), nil)
}

func TestContratoIdentityOpenRemote(t *testing.T) {
	fx := loadFixture(t, "identity_open_remote.json")
	c := newClient(t, policy.NewLab())
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA DE TESTE:11222333000181", "11222333000181", "", nil)
	req := decodeFrame(t, fx.Frames[0].Frame)
	var p map[string]any
	_ = json.Unmarshal(req.Params, &p)
	p["chain"] = []string{base64.StdEncoding.EncodeToString(leaf.DER)}
	req.Params, _ = json.Marshal(p)
	got := c.raw(req)
	want := decodeFrame(t, fx.Frames[1].Frame)
	if got.Error != nil || !slices.Equal(keys(got.Result), keys(want.Result)) {
		t.Fatalf("chaves %v, fixture %v (%v)", keys(got.Result), keys(want.Result), got.Error)
	}
}
