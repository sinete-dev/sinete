//go:build !cgo

// p11lab precisa de cgo (PKCS#11); sem ele, o comando só avisa.
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "p11lab precisa de cgo (CGO_ENABLED=1) para falar PKCS#11")
	os.Exit(2)
}
