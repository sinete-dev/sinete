//go:build windows

package main

import (
	"log"

	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/server"
)

// serveSocket não existe no Windows: lá o helper roda só como processo filho, pelo stdio.
func serveSocket(_ server.Config, _ string, logger *log.Logger) int {
	logger.Print("--socket não é suportado no Windows; use o stdio")
	return 2
}
