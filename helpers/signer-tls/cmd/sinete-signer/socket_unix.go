//go:build !windows

package main

import (
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/server"
)

// serveSocket atende num socket Unix, para o helper em contêiner próprio. Quem conecta é autenticado pela permissão
// do arquivo (0600, dono do processo); o protocolo não tem login. Cada conexão tem as próprias identidades.
func serveSocket(cfg server.Config, path string, logger *log.Logger) int {
	if err := claimSocketPath(path); err != nil {
		logger.Print(err)
		return 2
	}
	old := syscall.Umask(0o177)
	ln, err := net.Listen("unix", path)
	syscall.Umask(old)
	if err != nil {
		logger.Print(err)
		return 1
	}
	// O arquivo é apagado no fim só se ainda for o deste processo (outro helper pode tê-lo trocado depois).
	ln.(*net.UnixListener).SetUnlinkOnClose(false)
	mine, _ := os.Lstat(path)
	if err := os.Chmod(path, 0o600); err != nil {
		logger.Print(err)
		return 1
	}
	var (
		mu    sync.Mutex
		conns = map[net.Conn]bool{}
		wg    sync.WaitGroup
	)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		_ = ln.Close()
		mu.Lock()
		for c := range conns {
			// Fechar a leitura encerra o Serve da conexão, que termina o que estava em andamento e fecha as identidades.
			if uc, ok := c.(*net.UnixConn); ok {
				_ = uc.CloseRead()
			} else {
				_ = c.Close()
			}
		}
		mu.Unlock()
	}()
	logger.Printf("atendendo em %s", path)
	for {
		c, err := ln.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				break
			}
			logger.Print(err)
			continue
		}
		mu.Lock()
		conns[c] = true
		mu.Unlock()
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() { mu.Lock(); delete(conns, c); mu.Unlock(); _ = c.Close() }()
			if err := server.Serve(cfg, c, c); err != nil {
				logger.Printf("conexão: %v", err)
			}
		}()
	}
	wg.Wait()
	if now, err := os.Lstat(path); err == nil && mine != nil && os.SameFile(now, mine) {
		_ = os.Remove(path)
	}
	return 0
}

// claimSocketPath libera o caminho para o listen: nada lá, ou um socket morto (de um helper que caiu sem apagar),
// que é removido. Um socket que aceita conexão é de um helper vivo, e um arquivo que não é socket não é nosso: nos
// dois casos o helper não sobe, em vez de tirar o caminho de quem está atendendo.
func claimSocketPath(path string) error {
	fi, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if fi.Mode()&os.ModeSocket == 0 {
		return fmt.Errorf("%s existe e não é socket; não vou apagar", path)
	}
	c, err := net.DialTimeout("unix", path, 2*time.Second)
	if err == nil {
		_ = c.Close()
		return fmt.Errorf("%s já tem um sinete-signer atendendo; não vou tirar o socket dele", path)
	}
	if !errors.Is(err, syscall.ECONNREFUSED) {
		return fmt.Errorf("%s: não deu para saber se o socket está vivo: %w", path, err)
	}
	return os.Remove(path)
}
