//go:build !cgo

package signer

import "github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"

// HasPKCS11 diz se este binário tem o backend pkcs11.
const HasPKCS11 = false

// P11Params são os parâmetros de identity.open com backend pkcs11.
type P11Params struct {
	Module string
	Token  string
	Serial string
	Label  string
	KeyID  []byte
	Pin    string
	Extra  [][]byte
}

// OpenPKCS11 não existe no sabor estático.
func OpenPKCS11(string, P11Params) (*Identity, error) {
	return nil, protocol.Errorf(protocol.CodePKCS11, "este binário é o sabor estático (CGO_ENABLED=0), sem PKCS#11; use sinete-signer-p11 ou o backend remote")
}
