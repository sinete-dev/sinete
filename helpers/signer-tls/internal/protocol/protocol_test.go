package protocol

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestPeerFramesInvalidos(t *testing.T) {
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	p := NewPeer(outW, t.Logf)
	p.Handle("eco", func(_ context.Context, raw json.RawMessage) (any, error) { return raw, nil })
	p.Handle("falha", func(context.Context, json.RawMessage) (any, error) { return nil, errors.New("x") })
	go func() { _ = p.Serve(inR); _ = outW.Close() }()
	lines := bufio.NewScanner(outR)
	send := func(s string) { _, _ = io.WriteString(inW, s+"\n") }
	read := func() Frame {
		if !lines.Scan() {
			t.Fatal("sem saída")
		}
		var f Frame
		if err := json.Unmarshal(lines.Bytes(), &f); err != nil {
			t.Fatal(err)
		}
		if f.V != Version {
			t.Fatalf("saída sem v: %s", lines.Text())
		}
		return f
	}
	send(`isto não é json`)
	send(`{"v":1,"method":"eco","params":{}}`) // sem id: ignorado
	send(`{"v":1,"id":"c1","method":"eco","params":{"a":1}}`)
	if f := read(); f.ID != "c1" || string(f.Result) != `{"a":1}` {
		t.Fatalf("eco: %+v", f)
	}
	send(`{"v":1,"id":"c2","method":"eco","result":{}}`)
	if f := read(); f.Error == nil || f.Error.Code != CodeBadRequest {
		t.Fatalf("method com result: %+v", f)
	}
	send(`{"v":1,"id":"c3","method":"falha","params":{}}`)
	if f := read(); f.Error == nil || f.Error.Code != CodeError {
		t.Fatalf("erro sem código: %+v", f)
	}
	send(`{"v":1,"id":"c4","method":"nada","params":{}}`)
	if f := read(); f.Error == nil || f.Error.Code != CodeUnknownMethod {
		t.Fatalf("método desconhecido: %+v", f)
	}
	send(`{"v":3,"id":"c5","method":"eco","params":{}}`)
	if f := read(); f.Error == nil || f.Error.Code != CodeProtocolVersion {
		t.Fatalf("versão: %+v", f)
	}

	// Call do helper para o cliente: resposta, resposta repetida (ignorada) e prazo.
	done := make(chan json.RawMessage, 1)
	go func() {
		r, err := p.Call(context.Background(), "sign", map[string]int{"x": 1}, 5*time.Second, "")
		if err != nil {
			t.Error(err)
		}
		done <- r
	}()
	f := read()
	if f.Method != "sign" || !strings.HasPrefix(f.ID, "h") {
		t.Fatalf("chamada do helper: %+v", f)
	}
	send(`{"v":1,"id":"` + f.ID + `","result":{"ok":true}}`)
	send(`{"v":1,"id":"` + f.ID + `","result":{"ok":false}}`)
	if r := <-done; string(r) != `{"ok":true}` {
		t.Fatalf("resultado: %s", r)
	}
	go func() { _ = read() }()
	_, err := p.Call(context.Background(), "sign", nil, 50*time.Millisecond, "")
	var pe *Error
	if !errors.As(err, &pe) || pe.Code != CodeSignTimeout {
		t.Fatalf("prazo: %v", err)
	}
	_ = inW.Close()
}

// Requisição e cancel colados na mesma escrita: o cancel acha a requisição mesmo que a goroutine dela ainda não tenha
// rodado, porque o registro acontece no laço de leitura. Repetido para pegar a ordem ruim do escalonador.
func TestCancelLogoDepoisDaRequisicao(t *testing.T) {
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	p := NewPeer(outW, t.Logf)
	p.Handle("lenta", func(ctx context.Context, _ json.RawMessage) (any, error) {
		select {
		case <-ctx.Done():
			return nil, Errorf(CodeTransport, "cancelada")
		case <-time.After(10 * time.Second):
			return map[string]bool{"enviou": true}, nil
		}
	})
	go func() { _ = p.Serve(inR); _ = outW.Close() }()
	defer inW.Close()
	lines := bufio.NewScanner(outR)
	for i := range 200 {
		req := `{"v":1,"id":"r` + strconv.Itoa(i) + `","method":"lenta","params":{}}`
		can := `{"v":1,"id":"k` + strconv.Itoa(i) + `","method":"cancel","params":{"id":"r` + strconv.Itoa(i) + `"}}`
		if _, err := io.WriteString(inW, req+"\n"+can+"\n"); err != nil {
			t.Fatal(err)
		}
		got := map[string]Frame{}
		for len(got) < 2 {
			if !lines.Scan() {
				t.Fatal("sem saída")
			}
			var f Frame
			if err := json.Unmarshal(lines.Bytes(), &f); err != nil {
				t.Fatal(err)
			}
			got[f.ID[:1]] = f
		}
		if string(got["k"].Result) != `{"cancelled":true}` {
			t.Fatalf("rodada %d: cancel não achou a requisição: %s", i, got["k"].Result)
		}
		if got["r"].Error == nil {
			t.Fatalf("rodada %d: requisição cancelada terminou com sucesso", i)
		}
	}
}
