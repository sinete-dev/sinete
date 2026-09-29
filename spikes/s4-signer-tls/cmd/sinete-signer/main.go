// sinete-signer (spike S4): helper nativo que termina mTLS com a SEFAZ sem guardar a chave.
// Fala o protocolo v1 (contract/PROTOCOL.md) em NDJSON sobre stdin/stdout. Logs vão para stderr.
//
//	sinete-signer [--lab] [--roots arquivo.pem ...]
package main

import (
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type multiFlag []string

func (m *multiFlag) String() string     { return strings.Join(*m, ",") }
func (m *multiFlag) Set(v string) error { *m = append(*m, v); return nil }

func main() {
	lab := flag.Bool("lab", false, "modo laboratório: só loopback, sem ledger, permite backend inproc")
	renegFreely := flag.Bool("reneg-freely", false, "RenegotiateFreelyAsClient em vez de OnceAsClient")
	var rootFiles multiFlag
	flag.Var(&rootFiles, "roots", "PEM com raízes extras (ICP-Brasil, CA de teste); somadas à loja do sistema")
	flag.Parse()
	logger := log.New(os.Stderr, "[sinete-signer] ", log.Lmicroseconds)

	roots, err := x509.SystemCertPool()
	if err != nil || *lab {
		roots = x509.NewCertPool() // no lab, só a CA de teste: prova que a validação do servidor está ligada
	}
	for _, f := range rootFiles {
		b, err := os.ReadFile(f)
		if err != nil || !roots.AppendCertsFromPEM(b) {
			logger.Fatalf("raízes inválidas em %s: %v", f, err)
		}
	}
	reneg := tls.RenegotiateOnceAsClient
	if *renegFreely {
		reneg = tls.RenegotiateFreelyAsClient
	}

	g := &guard{lab: *lab}
	if *lab {
		rsaKexHosts["127.0.0.1"] = true // lab: prova RSA-kx + cert de cliente sem SNI
	}
	p := newPeer(os.Stdout, logger.Printf)
	var (
		mu    sync.Mutex
		ids   = map[string]*identity{}
		pools = map[string]*pool{}
		cid   atomic.Int64
	)

	p.handle("hello", func(json.RawMessage) (any, error) {
		return map[string]any{
			"protocol": ProtocolVersion, "helper": "sinete-signer/0.0.0-spike", "go": runtime.Version(),
			"lab": *lab, "backends": backends(),
			"signModes": []string{"digest", "message"}, "schemes": []string{"rsa_pkcs1_sha256", "rsa_pkcs1_sha1"},
		}, nil
	})

	p.handle("identity.open", func(raw json.RawMessage) (any, error) {
		var prm struct {
			ID      string   `json:"id"`
			Backend string   `json:"backend"`
			Chain   []string `json:"chain"` // DER base64, folha primeiro (remote)
			Mode    string   `json:"mode"`  // remote: digest | message
			Module  string   `json:"module"`
			Token   string   `json:"token"`
			Label   string   `json:"label"`
			Pin     string   `json:"pin"`
			KeyFile string   `json:"keyFile"` // inproc (lab)
		}
		if err := json.Unmarshal(raw, &prm); err != nil {
			return nil, err
		}
		if prm.ID == "" {
			return nil, errCode("bad_request", "id obrigatório")
		}
		id := &identity{ID: prm.ID, Backend: prm.Backend}
		switch prm.Backend {
		case "remote":
			for _, c := range prm.Chain {
				der, err := base64.StdEncoding.DecodeString(c)
				if err != nil {
					return nil, errCode("bad_request", "cadeia inválida")
				}
				id.Chain = append(id.Chain, der)
			}
			if len(id.Chain) == 0 {
				return nil, errCode("bad_request", "cadeia vazia")
			}
			leaf, err := x509.ParseCertificate(id.Chain[0])
			if err != nil {
				return nil, err
			}
			id.Leaf = leaf
			mode := prm.Mode
			if mode == "" {
				mode = "digest"
			}
			if mode != "digest" && mode != "message" {
				return nil, errCode("bad_request", "mode inválido")
			}
			id.newKey = func(ctx signContext, rec func(signStat)) crypto.Signer {
				base := remoteDigestSigner{pub: leaf.PublicKey, p: p, id: id, ctx: ctx, rec: rec, mode: mode}
				if mode == "message" {
					return &remoteMessageSigner{base}
				}
				return &base
			}
		case "pkcs11":
			if err := openP11Identity(id, prm.Module, prm.Token, prm.Label, prm.Pin, decodeChain(prm.Chain)); err != nil {
				return nil, errCode("pkcs11", "%v", err)
			}
		case "inproc":
			if !*lab {
				return nil, errCode("forbidden", "inproc só no lab")
			}
			kb, err := os.ReadFile(prm.KeyFile)
			if err != nil {
				return nil, err
			}
			blk, _ := pem.Decode(kb)
			key, err := x509.ParsePKCS8PrivateKey(blk.Bytes)
			if err != nil {
				return nil, err
			}
			id.Chain = decodeChain(prm.Chain)
			id.Leaf, _ = x509.ParseCertificate(id.Chain[0])
			id.newKey = func(ctx signContext, rec func(signStat)) crypto.Signer {
				return &timedSigner{k: key.(crypto.Signer), id: id, rec: rec}
			}
		default:
			return nil, errCode("bad_request", "backend desconhecido: %s", prm.Backend)
		}
		mu.Lock()
		ids[id.ID] = id
		pools[id.ID] = newPool(id, roots, &cid, reneg)
		mu.Unlock()
		return map[string]any{"id": id.ID, "subject": id.Leaf.Subject.String(), "notAfter": id.Leaf.NotAfter.Format(time.RFC3339), "chainLen": len(id.Chain), "backend": id.Backend}, nil
	})

	p.handle("http.request", func(raw json.RawMessage) (any, error) {
		var prm httpParams
		if err := json.Unmarshal(raw, &prm); err != nil {
			return nil, err
		}
		mu.Lock()
		pl := pools[prm.Identity]
		mu.Unlock()
		if pl == nil {
			return nil, errCode("unknown_identity", "identidade %q não aberta", prm.Identity)
		}
		return pl.do(g, prm)
	})

	p.handle("pool.reset", func(raw json.RawMessage) (any, error) {
		var prm struct {
			Identity     string `json:"identity"`
			DropSessions bool   `json:"dropSessions"`
		}
		_ = json.Unmarshal(raw, &prm)
		mu.Lock()
		defer mu.Unlock()
		pl := pools[prm.Identity]
		if pl == nil {
			return nil, errCode("unknown_identity", "%s", prm.Identity)
		}
		pl.tr.CloseIdleConnections()
		if prm.DropSessions {
			pools[prm.Identity] = newPool(ids[prm.Identity], roots, &cid, reneg)
		}
		return map[string]any{"ok": true}, nil
	})

	p.handle("stats", func(json.RawMessage) (any, error) {
		mu.Lock()
		defer mu.Unlock()
		out := map[string]any{}
		for k, id := range ids {
			out[k] = map[string]any{"signatures": id.Signs.Load()}
		}
		return out, nil
	})

	if err := p.serve(os.Stdin); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func decodeChain(in []string) [][]byte {
	var out [][]byte
	for _, c := range in {
		if der, err := base64.StdEncoding.DecodeString(c); err == nil {
			out = append(out, der)
		}
	}
	return out
}

func backends() []string {
	b := []string{"remote"}
	if hasPKCS11 {
		b = append(b, "pkcs11")
	}
	return append(b, "inproc(lab)")
}
