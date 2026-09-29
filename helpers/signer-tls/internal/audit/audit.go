// Package audit grava uma linha JSON por uso da chave (requisição autenticada ou assinatura de documento), sem
// segredo e sem corpo: hora, identidade, titular, host ou referência, serviço, resultado e assinaturas.
package audit

import (
	"encoding/json"
	"io"
	"sync"
	"time"
)

// Event é uma linha da auditoria.
type Event struct {
	Time       string `json:"t"`
	Event      string `json:"event"` // http | dfe
	Identity   string `json:"identity"`
	Subject    string `json:"subject"`
	Host       string `json:"host,omitempty"`
	Service    string `json:"service,omitempty"`
	Reference  string `json:"reference,omitempty"`
	Status     int    `json:"status,omitempty"`
	Error      string `json:"error,omitempty"`
	Signatures int    `json:"signatures"`
}

// Log escreve eventos num io.Writer (arquivo com 0600, ou o stderr prefixado).
type Log struct {
	mu     sync.Mutex
	w      io.Writer
	prefix string
}

// New cria o log. prefix vai no começo de cada linha (no stderr, "audit ").
func New(w io.Writer, prefix string) *Log { return &Log{w: w, prefix: prefix} }

// Write grava o evento. Falha de escrita não derruba a requisição.
func (l *Log) Write(e Event) {
	if l == nil || l.w == nil {
		return
	}
	e.Time = time.Now().UTC().Format(time.RFC3339Nano)
	if len(e.Error) > 300 {
		e.Error = e.Error[:300]
	}
	b, err := json.Marshal(e)
	if err != nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	_, _ = l.w.Write(append(append([]byte(l.prefix), b...), '\n'))
}
