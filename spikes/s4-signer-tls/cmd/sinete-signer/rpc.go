// Spike S4: canal JSON-RPC bidirecional em NDJSON sobre stdio.
// O processo JS (dono da chave ou só cliente) chama o helper (http.request, identity.open);
// o helper chama o JS de volta (sign) no meio do handshake TLS. Um objeto JSON por linha.
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

const ProtocolVersion = 1

type rpcError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type frame struct {
	V      int             `json:"v"`
	ID     string          `json:"id"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *rpcError       `json:"error,omitempty"`
}

type handler func(params json.RawMessage) (any, error)

type peer struct {
	out      io.Writer
	wmu      sync.Mutex
	next     atomic.Int64
	pmu      sync.Mutex
	pending  map[string]chan frame
	handlers map[string]handler
	logf     func(string, ...any)
}

func newPeer(out io.Writer, logf func(string, ...any)) *peer {
	return &peer{out: out, pending: map[string]chan frame{}, handlers: map[string]handler{}, logf: logf}
}

func (p *peer) handle(method string, h handler) { p.handlers[method] = h }

func (p *peer) write(f frame) error {
	f.V = ProtocolVersion
	b, err := json.Marshal(f)
	if err != nil {
		return err
	}
	p.wmu.Lock()
	defer p.wmu.Unlock()
	_, err = p.out.Write(append(b, '\n'))
	return err
}

// call envia uma requisição do helper para o JS e espera a resposta (usado por sign).
func (p *peer) call(method string, params any, timeout time.Duration) (json.RawMessage, error) {
	id := "h" + strconv.FormatInt(p.next.Add(1), 10)
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	ch := make(chan frame, 1)
	p.pmu.Lock()
	p.pending[id] = ch
	p.pmu.Unlock()
	defer func() { p.pmu.Lock(); delete(p.pending, id); p.pmu.Unlock() }()
	if err := p.write(frame{ID: id, Method: method, Params: raw}); err != nil {
		return nil, err
	}
	select {
	case f := <-ch:
		if f.Error != nil {
			return nil, fmt.Errorf("%s: %s", f.Error.Code, f.Error.Message)
		}
		return f.Result, nil
	case <-time.After(timeout):
		return nil, errors.New("timeout esperando o signer externo")
	}
}

// serve lê frames até EOF. Requisições rodam em goroutines (um sign pode chegar no meio de um http.request).
func (p *peer) serve(in io.Reader) error {
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 1<<20), 64<<20)
	var inflight sync.WaitGroup
	defer inflight.Wait() // EOF no stdin: termina o que já foi pedido antes de sair
	for sc.Scan() {
		var f frame
		if err := json.Unmarshal(sc.Bytes(), &f); err != nil {
			p.logf("frame inválido: %v", err)
			continue
		}
		if f.V != ProtocolVersion {
			_ = p.write(frame{ID: f.ID, Error: &rpcError{"protocol_version", fmt.Sprintf("helper fala v%d, frame v%d", ProtocolVersion, f.V)}})
			continue
		}
		if f.Method == "" { // resposta a uma chamada nossa
			p.pmu.Lock()
			ch := p.pending[f.ID]
			p.pmu.Unlock()
			if ch != nil {
				ch <- f
			}
			continue
		}
		h := p.handlers[f.Method]
		inflight.Add(1)
		go func(f frame) {
			defer inflight.Done()
			if h == nil {
				_ = p.write(frame{ID: f.ID, Error: &rpcError{"unknown_method", f.Method}})
				return
			}
			res, err := h(f.Params)
			if err != nil {
				code := "error"
				var ce *codedError
				if errors.As(err, &ce) {
					code = ce.code
				}
				_ = p.write(frame{ID: f.ID, Error: &rpcError{code, err.Error()}})
				return
			}
			raw, _ := json.Marshal(res)
			_ = p.write(frame{ID: f.ID, Result: raw})
		}(f)
	}
	return sc.Err()
}

type codedError struct {
	code string
	msg  string
}

func (e *codedError) Error() string { return e.msg }
func errCode(code, format string, a ...any) error {
	return &codedError{code, fmt.Sprintf(format, a...)}
}
