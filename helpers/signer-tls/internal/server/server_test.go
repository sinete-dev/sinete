package server

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/testpki"
)

const cnpj = "11222333000181"

type fixture struct {
	ca     *testpki.CA
	leaf   *testpki.Leaf
	c      *client
	seen   []map[string]any
	seenMu sync.Mutex
}

func setup(t *testing.T, mode string) *fixture {
	t.Helper()
	f := &fixture{ca: testpki.NewCA("sinete-signer teste AC")}
	f.leaf = f.ca.Titular("EMPRESA DE TESTE:"+cnpj, cnpj, "", nil)
	f.c = newClient(t, policy.NewLab())
	f.c.onSign = keySigner(f.leaf.Key, &f.seen, &f.seenMu)
	res := f.c.mustCall("identity.open", map[string]any{"id": "k", "backend": "remote", "mode": mode, "chain": []string{b64(f.leaf.DER)}, "additionalCa": []string{f.ca.PEM}})
	if res["cnpj"] != cnpj || res["dfeSign"] != false || res["mode"] != mode {
		t.Fatalf("identity.open: %v", res)
	}
	return f
}

func (f *fixture) get(t *testing.T, url string, extra map[string]any) (map[string]any, *protocol.Error) {
	t.Helper()
	p := map[string]any{"identity": "k", "url": url, "method": "GET", "headers": map[string]string{}, "body": "", "timeoutMs": 10000, "service": "teste"}
	for k, v := range extra {
		p[k] = v
	}
	return f.c.call("http.request", p)
}

func tlsBlock(r map[string]any) map[string]any { return r["tls"].(map[string]any) }
func nsigs(r map[string]any) int               { return len(tlsBlock(r)["signatures"].([]any)) }

func TestRemoteDigestKeepAlive(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, nil)
	r1, err := f.get(t, srv.url, nil)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := base64.StdEncoding.DecodeString(r1["body"].(string))
	if string(body) != "cn=EMPRESA DE TESTE:"+cnpj {
		t.Fatalf("servidor não viu o certificado: %q", body)
	}
	if r1["status"].(float64) != 200 || nsigs(r1) != 1 || tlsBlock(r1)["version"] != "TLS 1.2" {
		t.Fatalf("primeira requisição: %v", r1)
	}
	if h := r1["headers"].(map[string]any); h["x-multi"] != "a, b" || h["content-type"] != "text/plain" {
		t.Fatalf("cabeçalhos: %v", h)
	}
	r2, err := f.get(t, srv.url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if nsigs(r2) != 0 || tlsBlock(r2)["connReused"] != true || tlsBlock(r2)["conn"] != tlsBlock(r1)["conn"] {
		t.Fatalf("keep-alive assinou de novo: %v", tlsBlock(r2))
	}
	s := f.c.mustCall("stats", map[string]any{})
	if s["identities"].(map[string]any)["k"].(map[string]any)["signatures"].(float64) != 1 {
		t.Fatalf("stats: %v", s)
	}
	f.seenMu.Lock()
	ctx := f.seen[0]["context"].(map[string]any)
	f.seenMu.Unlock()
	if ctx["purpose"] != "tls12-client-certificate-verify" || ctx["host"] != "localhost" || ctx["handshake"].(float64) != 1 {
		t.Fatalf("contexto do sign: %v", ctx)
	}
	if !strings.Contains(f.c.audit.String(), `"event":"http"`) || strings.Contains(f.c.audit.String(), "BEGIN") {
		t.Fatalf("auditoria: %s", f.c.audit.String())
	}
}

func TestRemoteMessageTranscript(t *testing.T) {
	f := setup(t, "message")
	srv := startServer(t, f.ca, nil, nil)
	if _, err := f.get(t, srv.url, nil); err != nil {
		t.Fatal(err)
	}
	f.seenMu.Lock()
	p := f.seen[0]
	f.seenMu.Unlock()
	msg, _ := base64.StdEncoding.DecodeString(p["message"].(string))
	// O transcript começa pelo ClientHello (tipo 1) e leva o SNI em claro.
	if msg[0] != 1 || !bytes.Contains(msg, []byte("localhost")) || p["digest"] != nil {
		t.Fatalf("transcript inesperado (%d bytes)", len(msg))
	}
}

func TestFreshConnAssinaDeNovo(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, nil)
	for i := range 3 {
		r, err := f.get(t, srv.url, map[string]any{"freshConn": true})
		if err != nil {
			t.Fatal(err)
		}
		// O servidor Go emite ticket e retoma: a partir da segunda conexão, sem assinatura e com o certificado.
		if i > 0 && tlsBlock(r)["resumed"].([]any)[0] == true && nsigs(r) != 0 {
			t.Fatalf("retomada assinou: %v", tlsBlock(r))
		}
	}
	if _, err := f.c.call("pool.reset", map[string]any{"identity": "k", "dropSessions": true}); err != nil {
		t.Fatal(err)
	}
	r, _ := f.get(t, srv.url, nil)
	if nsigs(r) != 1 || tlsBlock(r)["resumed"].([]any)[0] != false {
		t.Fatalf("depois do pool.reset com dropSessions: %v", tlsBlock(r))
	}
}

func TestSignRecusado(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, nil)
	f.c.onSign = func(map[string]any) (any, *protocol.Error) {
		return nil, &protocol.Error{Code: "sign_refused", Message: "host fora da política do dono da chave"}
	}
	_, err := f.get(t, srv.url, nil)
	if err == nil || err.Code != "sign_refused" || err.Data["stage"] != "handshake" || !strings.Contains(err.Message, "política") {
		t.Fatalf("esperado sign_refused no handshake, veio %v", err)
	}
}

func TestAssinaturaInvalidaViraSignRefused(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, nil)
	f.c.onSign = func(map[string]any) (any, *protocol.Error) {
		junk := make([]byte, 256)
		_, _ = rand.Read(junk)
		return map[string]string{"signature": base64.StdEncoding.EncodeToString(junk)}, nil
	}
	_, err := f.get(t, srv.url, nil)
	if err == nil || err.Code != "sign_refused" || !strings.Contains(err.Message, "não confere") {
		t.Fatalf("esperado sign_refused por assinatura inválida, veio %v", err)
	}
}

func TestSignTimeout(t *testing.T) {
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA:"+cnpj, cnpj, "", nil)
	c := newClient(t, policy.NewLab())
	c.mustCall("identity.open", map[string]any{"id": "k", "backend": "remote", "chain": []string{b64(leaf.DER)}, "additionalCa": []string{ca.PEM}, "signTimeoutMs": 200})
	srv := startServer(t, ca, nil, nil)
	t0 := time.Now()
	_, err := c.call("http.request", map[string]any{"identity": "k", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": ""})
	if err == nil || err.Code != "sign_timeout" || time.Since(t0) > 5*time.Second {
		t.Fatalf("esperado sign_timeout rápido, veio %v em %s", err, time.Since(t0))
	}
}

func TestGuardaAntesDoSocket(t *testing.T) {
	f := setup(t, "digest")
	for _, u := range []string{"https://hnfe.sefaz.ba.gov.br/", "http://localhost/", "https://u:p@localhost/"} {
		_, err := f.get(t, u, nil)
		if err == nil || err.Code != "guard" {
			t.Fatalf("%s: esperado guard, veio %v", u, err)
		}
	}
	f.seenMu.Lock()
	defer f.seenMu.Unlock()
	if len(f.seen) != 0 {
		t.Fatal("a guarda deixou pedir assinatura")
	}
}

func TestRedirecionamentoNaoESeguido(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://outro.invalid/", http.StatusTemporaryRedirect)
	})
	r, err := f.get(t, srv.url, map[string]any{"method": "POST", "body": b64([]byte("<x/>"))})
	if err != nil || r["status"].(float64) != 307 {
		t.Fatalf("esperado 307 devolvido, veio %v %v", r, err)
	}
}

func TestCadeiaDoServidorNaoConfiavel(t *testing.T) {
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA:"+cnpj, cnpj, "", nil)
	c := newClient(t, policy.NewLab())
	c.onSign = keySigner(leaf.Key, nil, nil)
	c.mustCall("identity.open", map[string]any{"id": "k", "backend": "remote", "chain": []string{b64(leaf.DER)}})
	srv := startServer(t, ca, nil, nil)
	_, err := c.call("http.request", map[string]any{"identity": "k", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": ""})
	if err == nil || err.Code != "transport" || err.Data["x509"] != "unknown_authority" || err.Data["stage"] != "handshake" {
		t.Fatalf("esperado x509 unknown_authority, veio %v", err)
	}
}

func TestTrocaRSASoOndeOPerfilPede(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, func(c *tls.Config) {
		c.MaxVersion = tls.VersionTLS12
		c.CipherSuites = []uint16{tls.TLS_RSA_WITH_AES_128_GCM_SHA256}
	}, nil)
	// No laboratório, 127.0.0.1 faz o papel do host cujo perfil só tem DHE (GO produção); localhost não.
	r, err := f.get(t, srv.ipURL, nil)
	if err != nil || tlsBlock(r)["cipher"] != "TLS_RSA_WITH_AES_128_GCM_SHA256" || nsigs(r) != 1 {
		t.Fatalf("troca RSA em 127.0.0.1: %v %v", r, err)
	}
	_, err = f.get(t, srv.url, nil)
	if err == nil || err.Code != "transport" || err.Data["alert"] == nil {
		t.Fatalf("localhost não devia negociar troca RSA: %v", err)
	}
}

func TestSoTLS12(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, func(c *tls.Config) { c.MinVersion = tls.VersionTLS13 }, nil)
	_, err := f.get(t, srv.url, nil)
	if err == nil || err.Code != "transport" || err.Data["alert"] != float64(70) {
		t.Fatalf("esperado alerta 70 (protocol_version), veio %v", err)
	}
}

func TestCicloDeVidaEErros(t *testing.T) {
	f := setup(t, "digest")
	if _, err := f.c.call("identity.open", map[string]any{"id": "k", "backend": "remote", "chain": []string{b64(f.leaf.DER)}}); err == nil || err.Code != "identity_exists" {
		t.Fatalf("id repetido: %v", err)
	}
	if _, err := f.c.call("dfe.sign", map[string]any{"identity": "k", "signedInfo": "PHgvPg==", "hash": "SHA-1"}); err == nil || err.Code != "forbidden" {
		t.Fatalf("dfe.sign no remote: %v", err)
	}
	if _, err := f.c.call("identity.open", map[string]any{"id": "x", "backend": "remote", "chain": []string{"%%%"}}); err == nil || err.Code != "bad_request" {
		t.Fatalf("cadeia inválida: %v", err)
	}
	if _, err := f.c.call("identity.open", map[string]any{"id": "x", "backend": "inproc"}); err == nil || err.Code != "bad_request" {
		t.Fatalf("backend inproc: %v", err)
	}
	f.c.mustCall("identity.close", map[string]any{"identity": "k"})
	if _, err := f.get(t, "https://localhost/", nil); err == nil || err.Code != "unknown_identity" {
		t.Fatalf("depois do close: %v", err)
	}
}

func TestFecharOCanalFalhaOSignPendente(t *testing.T) {
	ca := testpki.NewCA("ac")
	leaf := ca.Titular("EMPRESA:"+cnpj, cnpj, "", nil)
	c := newClient(t, policy.NewLab())
	c.mustCall("identity.open", map[string]any{"id": "k", "backend": "remote", "chain": []string{b64(leaf.DER)}, "additionalCa": []string{ca.PEM}})
	srv := startServer(t, ca, nil, nil)
	signAsked := make(chan struct{})
	c.onSign = func(map[string]any) (any, *protocol.Error) {
		close(signAsked)
		select {} // nunca responde
	}
	go func() {
		<-signAsked
		_ = c.in.Close()
	}()
	raw := `{"identity":"k","url":"` + srv.url + `","method":"GET","headers":{},"body":""}`
	c.write(protocol.Frame{V: 1, ID: "c99", Method: "http.request", Params: []byte(raw)})
	select {
	case err := <-c.done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("o helper não encerrou depois do EOF com sign pendente")
	}
}

// O cliente desistiu (AbortSignal): o `cancel` cancela a requisição em andamento no helper, que para de esperar o
// servidor em vez de seguir até o prazo.
func TestCancelInterrompeARequisicao(t *testing.T) {
	f := setup(t, "digest")
	solta := make(chan struct{})
	defer close(solta)
	srv := startServer(t, f.ca, nil, func(w http.ResponseWriter, r *http.Request) { <-solta })
	params, _ := json.Marshal(map[string]any{"identity": "k", "url": srv.url, "method": "GET", "headers": map[string]string{}, "body": "", "timeoutMs": 20000})
	resp := make(chan protocol.Frame, 1)
	go func() { resp <- f.c.raw(protocol.Frame{V: 1, ID: "c-lenta", Method: "http.request", Params: params}) }()
	time.Sleep(300 * time.Millisecond)
	t0 := time.Now()
	res := f.c.mustCall("cancel", map[string]any{"id": "c-lenta"})
	if res["cancelled"] != true {
		t.Fatalf("cancel: %v", res)
	}
	select {
	case r := <-resp:
		if r.Error == nil {
			t.Fatalf("requisição cancelada respondeu com sucesso: %s", r.Result)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("a requisição cancelada não terminou")
	}
	if d := time.Since(t0); d > 5*time.Second {
		t.Fatalf("o cancel levou %v", d)
	}
	if res := f.c.mustCall("cancel", map[string]any{"id": "c-lenta"}); res["cancelled"] != false {
		t.Fatalf("cancel de requisição já terminada: %v", res)
	}
}

// Requisições concorrentes na mesma identidade: a assinatura do handshake conta uma vez só, para a primeira requisição
// que usa a conexão (o transporte devolve a conexão ao pool antes de a primeira terminar de ler o corpo, e uma conexão
// discada para uma requisição pode acabar servindo outra). Quem abriu a conexão (connReused false) sempre a vê.
func TestAssinaturasPorRequisicaoComReuso(t *testing.T) {
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, nil)
	porConn := map[float64]int{}
	esperado := map[float64]int{} // 1 assinatura por conexão, 0 se o handshake dela retomou sessão
	for rodada := 0; rodada < 5; rodada++ {
		var wg sync.WaitGroup
		type par struct {
			conn    float64
			reused  bool
			resumed bool
			sigs    int
		}
		res := make(chan par, 16)
		for range 16 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r, perr := f.get(t, srv.url, nil)
				if perr != nil {
					t.Error(perr)
					return
				}
				b := tlsBlock(r)
				resumed := b["resumed"].([]any)
				res <- par{conn: b["conn"].(float64), reused: b["connReused"].(bool), resumed: len(resumed) > 0 && resumed[0] == true, sigs: nsigs(r)}
			}()
		}
		wg.Wait()
		close(res)
		for p := range res {
			porConn[p.conn] += p.sigs
			esperado[p.conn] = 1
			if p.resumed {
				esperado[p.conn] = 0
			}
			if !p.reused && p.sigs != esperado[p.conn] {
				t.Fatalf("rodada %d: quem abriu a conexão %v viu %d assinatura(s)", rodada, p.conn, p.sigs)
			}
		}
	}
	for c, n := range porConn {
		if n != esperado[c] {
			t.Fatalf("conexão %v com %d assinatura(s) somadas nas respostas", c, n)
		}
	}
}

// Prazo que vence com a escrita do corpo bloqueada (o servidor não lê): client.Do volta enquanto a goroutine de
// escrita do transporte ainda roda os ganchos do httptrace. Com -race, pega acesso concorrente ao estado deles.
func TestPrazoNaEscritaBloqueada(t *testing.T) {
	f := setup(t, "digest")
	solta := make(chan struct{})
	defer close(solta)
	srv := startServer(t, f.ca, nil, func(w http.ResponseWriter, r *http.Request) { <-solta })
	body := b64(make([]byte, 16<<20))
	_, perr := f.c.call("http.request", map[string]any{"identity": "k", "url": srv.url, "method": "POST", "headers": map[string]string{"content-type": "text/xml"}, "body": body, "timeoutMs": 300})
	if perr == nil || perr.Code != "transport" {
		t.Fatalf("esperado erro de transporte por prazo: %v", perr)
	}
}

func TestAuditoriaContaAssinaturaDeRequisicaoQueFalhou(t *testing.T) {
	// Handshake assinado e conexão derrubada pelo servidor depois dele.
	f := setup(t, "digest")
	srv := startServer(t, f.ca, nil, func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) })
	if _, err := f.get(t, srv.url, nil); err == nil {
		t.Fatal("esperado erro com a conexão derrubada")
	}
	if a := f.c.audit.String(); !strings.Contains(a, `"signatures":1`) {
		t.Fatalf("auditoria da conexão derrubada sem a assinatura: %s", a)
	}

	// Handshake assinado e certificado do cliente recusado pelo servidor: a falha vem do dial.
	g := setup(t, "digest")
	outra := testpki.NewCA("outra AC")
	recusa := startServer(t, g.ca, func(c *tls.Config) { c.ClientCAs = x509.NewCertPool(); c.ClientCAs.AddCert(outra.Cert) }, nil)
	if _, err := g.get(t, recusa.url, nil); err == nil || err.Data["stage"] != "handshake" {
		t.Fatalf("esperado erro no handshake, veio %v", err)
	}
	if a := g.c.audit.String(); !strings.Contains(a, `"signatures":1`) {
		t.Fatalf("auditoria do certificado recusado sem a assinatura: %s", a)
	}
}
