// Package protocol implementa o canal do protocolo sinete-signer v1 (docs/signer-contract/PROTOCOL.md): NDJSON
// bidirecional, `v` em todo frame, requisições concorrentes correlacionadas por `id`. O cliente pede (`http.request`,
// `identity.open`...) e o helper também pede (`sign`, no meio de um handshake). Um Peer serve um canal: o stdio do
// processo ou uma conexão do socket Unix.
package protocol

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

// Version é a versão do protocolo, igual a docs/signer-contract/PROTOCOL_VERSION.
const Version = 1

// MaxFrameBytes limita uma linha. Corpo de requisição e resposta vão em base64 dentro do frame.
const MaxFrameBytes = 64 << 20

// Códigos de erro do contrato.
const (
	CodeProtocolVersion = "protocol_version"
	CodeUnknownMethod   = "unknown_method"
	CodeBadRequest      = "bad_request"
	CodeGuard           = "guard"
	CodeForbidden       = "forbidden"
	CodeUnknownIdentity = "unknown_identity"
	CodeIdentityExists  = "identity_exists"
	CodePKCS11          = "pkcs11"
	CodeTransport       = "transport"
	CodeSignRefused     = "sign_refused"
	CodeSignTimeout     = "sign_timeout"
	CodeDfeRefused      = "dfe_refused"
	CodeClosed          = "closed"
	CodeError           = "error"
)

// Error é o erro de um frame. Data leva detalhes estruturados (estágio, alerta TLS), nunca segredo.
type Error struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// Errorf cria um erro com código.
func Errorf(code, format string, a ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, a...)}
}

// ErrClosed é devolvido às chamadas pendentes quando o canal fecha.
var ErrClosed = &Error{Code: CodeClosed, Message: "canal fechado"}

// Frame é uma linha decodificada.
type Frame struct {
	V      int             `json:"v"`
	ID     string          `json:"id"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *Error          `json:"error,omitempty"`
}

// Handler atende um método. Um erro que não seja *Error sai com o código "error".
type Handler func(ctx context.Context, params json.RawMessage) (any, error)

// Peer é um lado do canal.
type Peer struct {
	out      io.Writer
	wmu      sync.Mutex
	next     atomic.Int64
	pmu      sync.Mutex
	pending  map[string]chan Frame
	closed   bool
	handlers map[string]Handler
	logf     func(string, ...any)
	ctx      context.Context
	cancel   context.CancelFunc
	// running guarda o cancelamento de cada requisição do cliente em andamento, pelo id, para o método `cancel`.
	rmu     sync.Mutex
	running map[string]context.CancelFunc
}

// NewPeer cria o lado do helper sobre `out`. logf recebe o log humano (stderr).
func NewPeer(out io.Writer, logf func(string, ...any)) *Peer {
	ctx, cancel := context.WithCancel(context.Background())
	p := &Peer{out: out, pending: map[string]chan Frame{}, handlers: map[string]Handler{}, logf: logf, ctx: ctx, cancel: cancel, running: map[string]context.CancelFunc{}}
	p.handlers["cancel"] = p.cancelRequest
	return p
}

// cancelRequest atende o `cancel`: cancela o contexto da requisição `id` do cliente, se ela ainda estiver em andamento.
// A requisição cancelada responde com o erro que o cancelamento provocar, e o cliente, que já desistiu, ignora.
func (p *Peer) cancelRequest(_ context.Context, params json.RawMessage) (any, error) {
	var in struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(params, &in); err != nil || in.ID == "" {
		return nil, Errorf(CodeBadRequest, "cancel: informe o id da requisição")
	}
	p.rmu.Lock()
	cancel := p.running[in.ID]
	p.rmu.Unlock()
	if cancel != nil {
		cancel()
	}
	return map[string]bool{"cancelled": cancel != nil}, nil
}

// Handle registra um método. Chamar antes de Serve.
func (p *Peer) Handle(method string, h Handler) { p.handlers[method] = h }

func (p *Peer) write(f Frame) error {
	f.V = Version
	b, err := json.Marshal(f)
	if err != nil {
		return err
	}
	p.wmu.Lock()
	defer p.wmu.Unlock()
	_, err = p.out.Write(append(b, '\n'))
	return err
}

// Call faz uma requisição do helper para o cliente e espera a resposta. O erro remoto volta como *Error; o prazo
// estourado volta como *Error com o código CodeSignTimeout se timeoutCode estiver vazio.
func (p *Peer) Call(ctx context.Context, method string, params any, timeout time.Duration, timeoutCode string) (json.RawMessage, error) {
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	id := "h" + strconv.FormatInt(p.next.Add(1), 10)
	ch := make(chan Frame, 1)
	p.pmu.Lock()
	if p.closed {
		p.pmu.Unlock()
		return nil, ErrClosed
	}
	p.pending[id] = ch
	p.pmu.Unlock()
	defer func() { p.pmu.Lock(); delete(p.pending, id); p.pmu.Unlock() }()
	if err := p.write(Frame{ID: id, Method: method, Params: raw}); err != nil {
		return nil, ErrClosed
	}
	t := time.NewTimer(timeout)
	defer t.Stop()
	select {
	case f, ok := <-ch:
		if !ok {
			return nil, ErrClosed
		}
		if f.Error != nil {
			return nil, f.Error
		}
		return f.Result, nil
	case <-t.C:
		if timeoutCode == "" {
			timeoutCode = CodeSignTimeout
		}
		return nil, Errorf(timeoutCode, "%s sem resposta em %s", method, timeout)
	case <-ctx.Done():
		return nil, Errorf(CodeTransport, "%s cancelado: %v", method, ctx.Err())
	}
}

// Context é cancelado quando o canal fecha.
func (p *Peer) Context() context.Context { return p.ctx }

// Serve lê frames até EOF. Requisições rodam em goroutines (um `sign` chega no meio de um `http.request`). No EOF,
// as chamadas pendentes do helper falham na hora com `closed` e Serve espera as requisições em andamento terminarem.
func (p *Peer) Serve(in io.Reader) error {
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 64<<10), MaxFrameBytes)
	var inflight sync.WaitGroup
	defer func() {
		p.closePending()
		inflight.Wait()
		p.cancel()
	}()
	for sc.Scan() {
		var f Frame
		if err := json.Unmarshal(sc.Bytes(), &f); err != nil {
			p.logf("frame inválido ignorado: %v", err)
			continue
		}
		if f.V != Version {
			_ = p.write(Frame{ID: f.ID, Error: Errorf(CodeProtocolVersion, "helper fala v%d, frame v%d", Version, f.V)})
			continue
		}
		if f.ID == "" {
			p.logf("frame sem id ignorado")
			continue
		}
		if f.Method == "" {
			p.pmu.Lock()
			ch := p.pending[f.ID]
			p.pmu.Unlock()
			if ch != nil {
				select {
				case ch <- f:
				default:
					p.logf("resposta repetida ignorada: %s", f.ID)
				}
			} else {
				p.logf("resposta sem chamada pendente: %s", f.ID)
			}
			continue
		}
		if f.Result != nil || f.Error != nil {
			_ = p.write(Frame{ID: f.ID, Error: Errorf(CodeBadRequest, "frame com method e result ou error")})
			continue
		}
		h := p.handlers[f.Method]
		// Registrado aqui, antes da goroutine: um cancel logo em seguida (lido na próxima volta do laço) já acha a
		// requisição, mesmo que a goroutine dela ainda não tenha rodado.
		ctx, cancel := context.WithCancel(p.ctx)
		p.rmu.Lock()
		p.running[f.ID] = cancel
		p.rmu.Unlock()
		inflight.Add(1)
		go func(f Frame) {
			defer inflight.Done()
			// Sai do registro antes de responder: depois da resposta, um cancel com este id devolve cancelled false.
			unregister := func() {
				p.rmu.Lock()
				delete(p.running, f.ID)
				p.rmu.Unlock()
				cancel()
			}
			defer unregister()
			if h == nil {
				_ = p.write(Frame{ID: f.ID, Error: Errorf(CodeUnknownMethod, "método desconhecido: %s", f.Method)})
				return
			}
			params := f.Params
			if len(params) == 0 {
				params = json.RawMessage("{}")
			}
			res, err := h(ctx, params)
			unregister()
			if err != nil {
				var pe *Error
				if !errors.As(err, &pe) {
					pe = &Error{Code: CodeError, Message: err.Error()}
				}
				_ = p.write(Frame{ID: f.ID, Error: pe})
				return
			}
			raw, err := json.Marshal(res)
			if err != nil {
				_ = p.write(Frame{ID: f.ID, Error: Errorf(CodeError, "resultado não serializável: %v", err)})
				return
			}
			_ = p.write(Frame{ID: f.ID, Result: raw})
		}(f)
	}
	if err := sc.Err(); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func (p *Peer) closePending() {
	p.pmu.Lock()
	defer p.pmu.Unlock()
	p.closed = true
	for id, ch := range p.pending {
		close(ch)
		delete(p.pending, id)
	}
}
