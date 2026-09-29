//go:build cgo

// Backend PKCS#11: exige cgo (dlopen do módulo do fabricante). O sabor estático (CGO_ENABLED=0) não tem este arquivo.
package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/x509"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/miekg/pkcs11"
)

const hasPKCS11 = true

func openP11Identity(id *identity, module, token, label, pin string, extra [][]byte) error {
	k, chain, err := openP11(module, token, label, pin)
	if err != nil {
		return err
	}
	id.Chain = append(chain, extra...)
	id.Leaf, _ = x509.ParseCertificate(chain[0])
	id.newKey = func(ctx signContext, rec func(signStat)) crypto.Signer { return &p11Signer{k: k, id: id, rec: rec} }
	return nil
}

// ---------- backend pkcs11: a chave mora no token (SoftHSM aqui; SafeNet, GD, Bird ID middleware em produção) ----------

type p11Key struct {
	mu      sync.Mutex // sessão PKCS#11 não é thread-safe
	ctx     *pkcs11.Ctx
	session pkcs11.SessionHandle
	priv    pkcs11.ObjectHandle
	pub     crypto.PublicKey
}

var digestInfoPrefix = map[crypto.Hash][]byte{
	crypto.SHA1:   {0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14},
	crypto.SHA256: {0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20},
}

type p11Signer struct {
	k   *p11Key
	id  *identity
	rec func(signStat)
}

func (s *p11Signer) Public() crypto.PublicKey { return s.k.pub }

func (s *p11Signer) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	if _, pss := opts.(*rsa.PSSOptions); pss {
		return nil, fmt.Errorf("RSA-PSS recusado")
	}
	scheme, err := schemeName(opts.HashFunc())
	if err != nil {
		return nil, err
	}
	t0 := time.Now()
	in := append(append([]byte{}, digestInfoPrefix[opts.HashFunc()]...), digest...)
	s.k.mu.Lock()
	defer s.k.mu.Unlock()
	if err := s.k.ctx.SignInit(s.k.session, []*pkcs11.Mechanism{pkcs11.NewMechanism(pkcs11.CKM_RSA_PKCS, nil)}, s.k.priv); err != nil {
		return nil, fmt.Errorf("C_SignInit: %w", err)
	}
	sig, err := s.k.ctx.Sign(s.k.session, in)
	if err != nil {
		return nil, fmt.Errorf("C_Sign: %w", err)
	}
	s.id.Signs.Add(1)
	s.rec(signStat{scheme, "pkcs11", float64(time.Since(t0).Microseconds()) / 1000})
	return sig, nil
}

func openP11(module, tokenLabel, keyLabel, pin string) (*p11Key, [][]byte, error) {
	ctx := pkcs11.New(module)
	if ctx == nil {
		return nil, nil, fmt.Errorf("não carregou o módulo %s", module)
	}
	if err := ctx.Initialize(); err != nil {
		return nil, nil, fmt.Errorf("C_Initialize: %w", err)
	}
	slots, err := ctx.GetSlotList(true)
	if err != nil {
		return nil, nil, err
	}
	var slot uint
	found := false
	for _, s := range slots {
		ti, err := ctx.GetTokenInfo(s)
		if err == nil && ti.Label == tokenLabel {
			slot, found = s, true
			break
		}
	}
	if !found {
		return nil, nil, fmt.Errorf("token %q não encontrado", tokenLabel)
	}
	sess, err := ctx.OpenSession(slot, pkcs11.CKF_SERIAL_SESSION)
	if err != nil {
		return nil, nil, err
	}
	if err := ctx.Login(sess, pkcs11.CKU_USER, pin); err != nil {
		return nil, nil, fmt.Errorf("C_Login: %w", err)
	}
	find := func(class uint) ([]pkcs11.ObjectHandle, error) {
		if err := ctx.FindObjectsInit(sess, []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_CLASS, class), pkcs11.NewAttribute(pkcs11.CKA_LABEL, keyLabel)}); err != nil {
			return nil, err
		}
		defer ctx.FindObjectsFinal(sess)
		h, _, err := ctx.FindObjects(sess, 4)
		return h, err
	}
	privs, err := find(pkcs11.CKO_PRIVATE_KEY)
	if err != nil || len(privs) != 1 {
		return nil, nil, fmt.Errorf("chave privada %q: %d objetos, %v", keyLabel, len(privs), err)
	}
	certs, err := find(pkcs11.CKO_CERTIFICATE)
	if err != nil || len(certs) != 1 {
		return nil, nil, fmt.Errorf("certificado %q: %d objetos, %v", keyLabel, len(certs), err)
	}
	attrs, err := ctx.GetAttributeValue(sess, certs[0], []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_VALUE, nil)})
	if err != nil {
		return nil, nil, err
	}
	der := attrs[0].Value
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, nil, err
	}
	return &p11Key{ctx: ctx, session: sess, priv: privs[0], pub: leaf.PublicKey}, [][]byte{der}, nil
}
