//go:build cgo

// Package p11lab prepara um token SoftHSM descartável para os testes: inicializa o token num diretório próprio, gera
// o par RSA dentro do token (sensível e não extraível) e grava o certificado emitido pela AC de teste. Só testes e o
// comando tools/p11lab usam; o helper nunca gera chave.
package p11lab

import (
	"crypto/rsa"
	"crypto/x509"
	"errors"
	"fmt"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/miekg/pkcs11"
)

// Token é um token SoftHSM pronto para uso.
type Token struct {
	Module string
	Conf   string
	Label  string
	Pin    string
}

// FindModule acha o módulo do SoftHSM (SOFTHSM2_MODULE ou os caminhos do Homebrew e das distribuições Linux).
func FindModule() string {
	for _, p := range []string{os.Getenv("SOFTHSM2_MODULE"), "/opt/homebrew/lib/softhsm/libsofthsm2.so", "/usr/local/lib/softhsm/libsofthsm2.so", "/usr/lib/softhsm/libsofthsm2.so", "/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so", "/usr/lib/aarch64-linux-gnu/softhsm/libsofthsm2.so"} {
		if p == "" {
			continue
		}
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// Init cria o diretório do token, escreve o softhsm2.conf, exporta SOFTHSM2_CONF neste processo e inicializa o token.
func Init(dir, module, label, pin string) (*Token, error) {
	util, err := exec.LookPath("softhsm2-util")
	if err != nil {
		return nil, errors.New("softhsm2-util não está no PATH")
	}
	tokens := filepath.Join(dir, "tokens")
	if err := os.MkdirAll(tokens, 0o700); err != nil {
		return nil, err
	}
	conf := filepath.Join(dir, "softhsm2.conf")
	if err := os.WriteFile(conf, []byte(fmt.Sprintf("directories.tokendir = %s\nobjectstore.backend = file\nlog.level = ERROR\n", tokens)), 0o600); err != nil {
		return nil, err
	}
	os.Setenv("SOFTHSM2_CONF", conf)
	cmd := exec.Command(util, "--init-token", "--free", "--label", label, "--pin", pin, "--so-pin", pin+"0")
	cmd.Env = append(os.Environ(), "SOFTHSM2_CONF="+conf)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("softhsm2-util: %v: %s", err, out)
	}
	return &Token{Module: module, Conf: conf, Label: label, Pin: pin}, nil
}

func (t *Token) session(fn func(*pkcs11.Ctx, pkcs11.SessionHandle) error) error {
	p := pkcs11.New(t.Module)
	if p == nil {
		return fmt.Errorf("não carregou %s", t.Module)
	}
	defer p.Destroy()
	if err := p.Initialize(); err != nil && !errors.Is(err, pkcs11.Error(pkcs11.CKR_CRYPTOKI_ALREADY_INITIALIZED)) {
		return err
	}
	defer p.Finalize()
	slots, err := p.GetSlotList(true)
	if err != nil {
		return err
	}
	for _, s := range slots {
		ti, err := p.GetTokenInfo(s)
		if err != nil || ti.Label != t.Label {
			continue
		}
		sess, err := p.OpenSession(s, pkcs11.CKF_SERIAL_SESSION|pkcs11.CKF_RW_SESSION)
		if err != nil {
			return err
		}
		defer p.CloseSession(sess)
		if err := p.Login(sess, pkcs11.CKU_USER, t.Pin); err != nil && !errors.Is(err, pkcs11.Error(pkcs11.CKR_USER_ALREADY_LOGGED_IN)) {
			return err
		}
		return fn(p, sess)
	}
	return fmt.Errorf("token %s não encontrado", t.Label)
}

// GenerateKey gera o par dentro do token e devolve a chave pública. keyLabel rotula só a chave; o certificado ganha
// outro rótulo em StoreCertificate, como nos tokens reais, e os dois se ligam pelo CKA_ID.
func (t *Token) GenerateKey(keyLabel string, id []byte) (*rsa.PublicKey, error) {
	var pub *rsa.PublicKey
	err := t.session(func(p *pkcs11.Ctx, sess pkcs11.SessionHandle) error {
		pubTpl := []*pkcs11.Attribute{
			pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
			pkcs11.NewAttribute(pkcs11.CKA_VERIFY, true),
			pkcs11.NewAttribute(pkcs11.CKA_MODULUS_BITS, 2048),
			pkcs11.NewAttribute(pkcs11.CKA_PUBLIC_EXPONENT, []byte{1, 0, 1}),
			pkcs11.NewAttribute(pkcs11.CKA_LABEL, keyLabel),
			pkcs11.NewAttribute(pkcs11.CKA_ID, id),
		}
		privTpl := []*pkcs11.Attribute{
			pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
			pkcs11.NewAttribute(pkcs11.CKA_PRIVATE, true),
			pkcs11.NewAttribute(pkcs11.CKA_SIGN, true),
			pkcs11.NewAttribute(pkcs11.CKA_SENSITIVE, true),
			pkcs11.NewAttribute(pkcs11.CKA_EXTRACTABLE, false),
			pkcs11.NewAttribute(pkcs11.CKA_LABEL, keyLabel),
			pkcs11.NewAttribute(pkcs11.CKA_ID, id),
		}
		pubH, privH, err := p.GenerateKeyPair(sess, []*pkcs11.Mechanism{pkcs11.NewMechanism(pkcs11.CKM_RSA_PKCS_KEY_PAIR_GEN, nil)}, pubTpl, privTpl)
		if err != nil {
			return err
		}
		// A chave não sai do token: ler o expoente privado tem de falhar.
		if _, err := p.GetAttributeValue(sess, privH, []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_PRIVATE_EXPONENT, nil)}); err == nil {
			return errors.New("o token deixou ler CKA_PRIVATE_EXPONENT")
		}
		attrs, err := p.GetAttributeValue(sess, pubH, []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_MODULUS, nil), pkcs11.NewAttribute(pkcs11.CKA_PUBLIC_EXPONENT, nil)})
		if err != nil {
			return err
		}
		pub = &rsa.PublicKey{N: new(big.Int).SetBytes(attrs[0].Value), E: int(new(big.Int).SetBytes(attrs[1].Value).Int64())}
		return nil
	})
	return pub, err
}

// StoreCertificate grava o certificado no token com o rótulo e o CKA_ID do par.
func (t *Token) StoreCertificate(label string, id, der []byte) error {
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return err
	}
	return t.session(func(p *pkcs11.Ctx, sess pkcs11.SessionHandle) error {
		_, err := p.CreateObject(sess, []*pkcs11.Attribute{
			pkcs11.NewAttribute(pkcs11.CKA_CLASS, pkcs11.CKO_CERTIFICATE),
			pkcs11.NewAttribute(pkcs11.CKA_CERTIFICATE_TYPE, pkcs11.CKC_X_509),
			pkcs11.NewAttribute(pkcs11.CKA_TOKEN, true),
			pkcs11.NewAttribute(pkcs11.CKA_LABEL, label),
			pkcs11.NewAttribute(pkcs11.CKA_ID, id),
			pkcs11.NewAttribute(pkcs11.CKA_VALUE, der),
			pkcs11.NewAttribute(pkcs11.CKA_SUBJECT, cert.RawSubject),
		})
		return err
	})
}
