//go:build !cgo

package main

import "errors"

const hasPKCS11 = false

func openP11Identity(*identity, string, string, string, string, [][]byte) error {
	return errors.New("este binário é o sabor estático (CGO_ENABLED=0), sem PKCS#11; use sinete-signer-p11 ou o modo remote")
}
