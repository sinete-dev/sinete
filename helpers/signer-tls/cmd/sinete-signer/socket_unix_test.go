//go:build !windows

package main

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClaimSocketPath(t *testing.T) {
	dir, err := os.MkdirTemp("", "sock") // curto: sun_path tem ~104 bytes no macOS
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	// Nada no caminho.
	if err := claimSocketPath(filepath.Join(dir, "livre")); err != nil {
		t.Fatal(err)
	}

	// Socket de um helper vivo: recusa e não apaga.
	vivo := filepath.Join(dir, "vivo")
	ln, err := net.Listen("unix", vivo)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	if err := claimSocketPath(vivo); err == nil || !strings.Contains(err.Error(), "já tem") {
		t.Fatalf("socket vivo: %v", err)
	}
	if _, err := os.Lstat(vivo); err != nil {
		t.Fatalf("apagou o socket vivo: %v", err)
	}

	// Socket morto (o processo caiu sem apagar): removido.
	morto := filepath.Join(dir, "morto")
	ln2, err := net.Listen("unix", morto)
	if err != nil {
		t.Fatal(err)
	}
	ln2.(*net.UnixListener).SetUnlinkOnClose(false)
	_ = ln2.Close()
	if err := claimSocketPath(morto); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(morto); !os.IsNotExist(err) {
		t.Fatalf("socket morto ficou: %v", err)
	}

	// Arquivo comum: não é nosso.
	comum := filepath.Join(dir, "comum")
	if err := os.WriteFile(comum, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := claimSocketPath(comum); err == nil {
		t.Fatal("aceitou arquivo que não é socket")
	}
}
