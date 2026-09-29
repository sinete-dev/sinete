// sinete-signer: helper nativo que termina o mTLS com a SEFAZ usando uma chave que ele não guarda (ADR 0005). Fala o
// protocolo v1 de docs/signer-contract/ em NDJSON pelo stdin e stdout (padrão) ou por um socket Unix. O stderr é só
// log humano e auditoria.
//
//	sinete-signer --ambiente homologacao [--ambiente producao] [--tpamb 2] [--audit-file caminho] [--socket caminho]
//	sinete-signer --lab [--roots ac.pem]     (só loopback: laboratório e testes)
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/audit"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/policy"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/server"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/signer"
)

// version vem do build (-ldflags "-X main.version=...").
var version = "dev"

type multi []string

func (m *multi) String() string     { return strings.Join(*m, ",") }
func (m *multi) Set(v string) error { *m = append(*m, v); return nil }

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("sinete-signer", flag.ContinueOnError)
	fs.SetOutput(stderr)
	var ambientes, roots multi
	fs.Var(&ambientes, "ambiente", "ambiente liberado: homologacao ou producao (repita para os dois); obrigatório fora do --lab")
	fs.Var(&roots, "roots", "arquivo PEM com ACs somadas à confiança do servidor (repita para mais de um)")
	lab := fs.Bool("lab", false, "laboratório: só loopback, confiança só nas ACs de --roots e de additionalCa")
	tpamb := fs.String("tpamb", "", "exige este tpAmb (1 ou 2) em todo <tpAmb> do corpo")
	requireTpamb := fs.Bool("require-tpamb", false, "com --tpamb, recusa POST sem nenhum <tpAmb>")
	auditFile := fs.String("audit-file", "", "grava a auditoria (JSON por linha) neste arquivo, em vez do stderr")
	socket := fs.String("socket", "", "atende num socket Unix (permissão 0600) em vez do stdio")
	showVersion := fs.Bool("version", false, "mostra a versão e sai")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	logger := log.New(stderr, "[sinete-signer] ", log.LstdFlags|log.Lmicroseconds)
	if *showVersion {
		fmt.Fprintf(stdout, "sinete-signer %s protocolo %d pkcs11=%v dados: %s\n", version, protocol.Version, signer.HasPKCS11, policy.DataVersion)
		return 0
	}

	var guard *policy.Guard
	if *lab {
		if len(ambientes) > 0 {
			logger.Print("--lab e --ambiente são exclusivos")
			return 2
		}
		guard = policy.NewLab()
	} else {
		if len(ambientes) == 0 {
			logger.Print("informe --ambiente homologacao e/ou --ambiente producao")
			return 2
		}
		var err error
		if guard, err = policy.New(ambientes); err != nil {
			logger.Print(err)
			return 2
		}
	}
	if *tpamb != "" && *tpamb != "1" && *tpamb != "2" {
		logger.Print("--tpamb aceita 1 ou 2")
		return 2
	}
	guard.TpAmb = *tpamb
	guard.RequireTpAmb = *requireTpamb

	var extra []string
	for _, f := range roots {
		b, err := os.ReadFile(f)
		if err != nil {
			logger.Printf("--roots %s: %v", f, err)
			return 2
		}
		extra = append(extra, string(b))
	}
	if _, err := guard.Roots(extra); err != nil {
		logger.Printf("--roots: %v", err)
		return 2
	}

	auditLog := audit.New(stderr, "audit ")
	if *auditFile != "" {
		f, err := os.OpenFile(*auditFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
		if err != nil {
			logger.Printf("--audit-file: %v", err)
			return 2
		}
		defer f.Close()
		auditLog = audit.New(f, "")
	}
	cfg := server.Config{Version: version, Guard: guard, Ambientes: ambientes, Audit: auditLog, Logf: logger.Printf, ExtraRoots: extra}

	if *socket == "" {
		if err := server.Serve(cfg, stdin, stdout); err != nil {
			logger.Print(err)
			return 1
		}
		return 0
	}
	return serveSocket(cfg, *socket, logger)
}
