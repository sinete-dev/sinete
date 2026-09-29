//go:build cgo

// Backend PKCS#11: exige cgo (dlopen do módulo do fabricante). O sabor estático (CGO_ENABLED=0) usa pkcs11_nocgo.go.
package signer

import (
	"bytes"
	"crypto/rsa"
	"crypto/x509"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sync"

	"github.com/miekg/pkcs11"
	"github.com/sinete-dev/sinete/helpers/signer-tls/internal/protocol"
)

// HasPKCS11 diz se este binário tem o backend pkcs11.
const HasPKCS11 = true

// P11Params são os parâmetros de identity.open com backend pkcs11. O PIN chega pelo canal e nunca por argv ou env.
type P11Params struct {
	Module string
	Token  string // rótulo do token (CKA_LABEL do token)
	Serial string // opcional: número de série do token, para desempatar tokens com o mesmo rótulo
	Label  string // rótulo do certificado (e da chave, se o CKA_ID não resolver)
	KeyID  []byte // opcional: CKA_ID do par
	Pin    string
	Extra  [][]byte // intermediárias para completar a cadeia
}

// Um módulo PKCS#11 só pode ser inicializado uma vez por processo: identidades do mesmo módulo dividem o contexto.
type module struct {
	ctx  *pkcs11.Ctx
	refs int
	fi   os.FileInfo
}

var (
	modMu   sync.Mutex
	modules = map[string]*module{}
)

// acquireModule carrega o módulo uma vez por arquivo, não por caminho: um link simbólico (ou hard link) e o alvo dividem
// o mesmo estado de inicialização dentro da biblioteca, e contagens separadas fariam o C_Finalize de um derrubar as
// sessões do outro. Devolve a chave do registro, que vai para o releaseModule.
func acquireModule(path string) (*pkcs11.Ctx, string, error) {
	key, err := filepath.EvalSymlinks(path)
	if err != nil {
		return nil, "", fmt.Errorf("módulo %s: %w", path, err)
	}
	fi, err := os.Stat(key)
	if err != nil {
		return nil, "", fmt.Errorf("módulo %s: %w", path, err)
	}
	modMu.Lock()
	defer modMu.Unlock()
	for k, m := range modules {
		if os.SameFile(m.fi, fi) {
			m.refs++
			return m.ctx, k, nil
		}
	}
	ctx := pkcs11.New(key)
	if ctx == nil {
		return nil, "", fmt.Errorf("não carregou o módulo %s", path)
	}
	if err := ctx.Initialize(); err != nil && !errors.Is(err, pkcs11.Error(pkcs11.CKR_CRYPTOKI_ALREADY_INITIALIZED)) {
		ctx.Destroy()
		return nil, "", fmt.Errorf("C_Initialize: %w", err)
	}
	modules[key] = &module{ctx: ctx, refs: 1, fi: fi}
	return ctx, key, nil
}

func releaseModule(path string) {
	modMu.Lock()
	defer modMu.Unlock()
	m := modules[path]
	if m == nil {
		return
	}
	m.refs--
	if m.refs == 0 {
		_ = m.ctx.Finalize()
		m.ctx.Destroy()
		delete(modules, path)
	}
}

// p11Key é a chave no token. A sessão PKCS#11 não é segura entre goroutines: um mutex por identidade.
type p11Key struct {
	mu      sync.Mutex
	ctx     *pkcs11.Ctx
	session pkcs11.SessionHandle
	priv    pkcs11.ObjectHandle
	// closed é marcado sob mu pelo fechamento da identidade: uma requisição que ainda segura a identidade não pode
	// chamar C_SignInit numa sessão fechada nem num módulo já finalizado.
	closed bool
}

func (k *p11Key) SignDigestInfo(di []byte) ([]byte, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.closed {
		return nil, errors.New("identidade PKCS#11 fechada")
	}
	if err := k.ctx.SignInit(k.session, []*pkcs11.Mechanism{pkcs11.NewMechanism(pkcs11.CKM_RSA_PKCS, nil)}, k.priv); err != nil {
		return nil, fmt.Errorf("C_SignInit: %w", err)
	}
	sig, err := k.ctx.Sign(k.session, di)
	if err != nil {
		return nil, fmt.Errorf("C_Sign: %w", err)
	}
	return sig, nil
}

// OpenPKCS11 abre o token, faz login e acha o certificado e a chave. A chave nunca sai do token: o helper só pede
// C_Sign sobre o DigestInfo.
func OpenPKCS11(id string, p P11Params) (*Identity, error) {
	if !filepath.IsAbs(p.Module) {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "module precisa ser caminho absoluto")
	}
	if p.Token == "" || (p.Label == "" && len(p.KeyID) == 0) {
		return nil, protocol.Errorf(protocol.CodeBadRequest, "token e label (ou keyId) são obrigatórios")
	}
	ctx, modKey, err := acquireModule(p.Module)
	if err != nil {
		return nil, protocol.Errorf(protocol.CodePKCS11, "%v", err)
	}
	ok := false
	defer func() {
		if !ok {
			releaseModule(modKey)
		}
	}()
	slots, err := ctx.GetSlotList(true)
	if err != nil {
		return nil, protocol.Errorf(protocol.CodePKCS11, "C_GetSlotList: %v", err)
	}
	var found []uint
	for _, s := range slots {
		ti, err := ctx.GetTokenInfo(s)
		if err != nil || ti.Label != p.Token || (p.Serial != "" && ti.SerialNumber != p.Serial) {
			continue
		}
		found = append(found, s)
	}
	switch len(found) {
	case 0:
		return nil, protocol.Errorf(protocol.CodePKCS11, "token %q não encontrado", p.Token)
	case 1:
	default:
		return nil, protocol.Errorf(protocol.CodePKCS11, "%d tokens com o rótulo %q: informe serial", len(found), p.Token)
	}
	sess, err := ctx.OpenSession(found[0], pkcs11.CKF_SERIAL_SESSION)
	if err != nil {
		return nil, protocol.Errorf(protocol.CodePKCS11, "C_OpenSession: %v", err)
	}
	closeSession := func() { _ = ctx.CloseSession(sess) }
	if err := ctx.Login(sess, pkcs11.CKU_USER, p.Pin); err != nil && !errors.Is(err, pkcs11.Error(pkcs11.CKR_USER_ALREADY_LOGGED_IN)) {
		closeSession()
		return nil, protocol.Errorf(protocol.CodePKCS11, "C_Login: %v", err)
	}
	find := func(class uint, attrs ...*pkcs11.Attribute) ([]pkcs11.ObjectHandle, error) {
		tpl := append([]*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_CLASS, class)}, attrs...)
		if err := ctx.FindObjectsInit(sess, tpl); err != nil {
			return nil, err
		}
		defer func() { _ = ctx.FindObjectsFinal(sess) }()
		h, _, err := ctx.FindObjects(sess, 8)
		return h, err
	}
	sel := []*pkcs11.Attribute{}
	if p.Label != "" {
		sel = append(sel, pkcs11.NewAttribute(pkcs11.CKA_LABEL, p.Label))
	}
	if len(p.KeyID) > 0 {
		sel = append(sel, pkcs11.NewAttribute(pkcs11.CKA_ID, p.KeyID))
	}
	certs, err := find(pkcs11.CKO_CERTIFICATE, sel...)
	if err != nil || len(certs) != 1 {
		closeSession()
		return nil, protocol.Errorf(protocol.CodePKCS11, "certificado: %d objetos encontrados (esperado 1), %v", len(certs), err)
	}
	attrs, err := ctx.GetAttributeValue(sess, certs[0], []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_VALUE, nil), pkcs11.NewAttribute(pkcs11.CKA_ID, nil)})
	if err != nil {
		closeSession()
		return nil, protocol.Errorf(protocol.CodePKCS11, "C_GetAttributeValue do certificado: %v", err)
	}
	der, ckaID := attrs[0].Value, attrs[1].Value
	// A chave do par tem o mesmo CKA_ID do certificado (PKCS#11 v2.40, seção 4.4); rótulos de chave e de certificado
	// costumam divergir nos tokens reais. Sem CKA_ID, cai para o rótulo.
	// O rótulo só entra quando o certificado não tem CKA_ID: com CKA_ID, uma chave de mesmo rótulo e outro CKA_ID é
	// de outro par.
	var privs []pkcs11.ObjectHandle
	if len(ckaID) > 0 {
		privs, err = find(pkcs11.CKO_PRIVATE_KEY, pkcs11.NewAttribute(pkcs11.CKA_ID, ckaID))
	} else if p.Label != "" {
		privs, err = find(pkcs11.CKO_PRIVATE_KEY, pkcs11.NewAttribute(pkcs11.CKA_LABEL, p.Label))
	}
	if err != nil || len(privs) != 1 {
		closeSession()
		return nil, protocol.Errorf(protocol.CodePKCS11, "chave privada: %d objetos encontrados (esperado 1), %v", len(privs), err)
	}
	// E a chave tem de ser a do certificado: o módulo da chave privada (quando o token o mostra) é o da folha.
	if cert, perr := x509.ParseCertificate(der); perr == nil {
		if pub, isRSA := cert.PublicKey.(*rsa.PublicKey); isRSA {
			if m, merr := ctx.GetAttributeValue(sess, privs[0], []*pkcs11.Attribute{pkcs11.NewAttribute(pkcs11.CKA_MODULUS, nil)}); merr == nil && len(m) == 1 && len(m[0].Value) > 0 {
				if new(big.Int).SetBytes(m[0].Value).Cmp(pub.N) != 0 {
					closeSession()
					return nil, protocol.Errorf(protocol.CodePKCS11, "a chave privada achada não é a do certificado (módulos diferentes)")
				}
			}
		}
	}
	chain := [][]byte{der}
	for _, e := range p.Extra {
		if !bytes.Equal(e, der) {
			chain = append(chain, e)
		}
	}
	key := &p11Key{ctx: ctx, session: sess, priv: privs[0]}
	ident, err := newTokenIdentity(id, chain, key, func() error {
		key.mu.Lock()
		defer key.mu.Unlock()
		if key.closed {
			return nil
		}
		key.closed = true
		// Sem C_Logout: o login vale para o token inteiro na aplicação, e outra identidade pode estar usando o mesmo
		// token. Fechar a última sessão encerra o login (PKCS#11 v2.40, seção 5.6).
		err := ctx.CloseSession(sess)
		releaseModule(modKey)
		return err
	})
	if err != nil {
		closeSession()
		return nil, err
	}
	ok = true
	return ident, nil
}
