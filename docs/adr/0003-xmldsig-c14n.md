# 0003. XMLDSig, C14N e leitura de PFX

Status: proposta (spike S3, 25/set/2026). Código descartável em `spikes/s3-xmldsig/`.

## Contexto

A SEFAZ exige XMLDSig enveloped no perfil fixo: C14N 1.0 inclusivo (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`), RSA-SHA1 com PKCS#1 v1.5, digest SHA-1, `Reference URI="#<Id>"` apontando para `infNFe`, `infEvento` ou `infMDFe`, transforms `enveloped-signature` + C14N, e o certificado em `KeyInfo/X509Data/X509Certificate`. O `<Signature>` fica como irmão do elemento assinado (`NFe > infNFe + Signature`).

O brafis assinava, reparseava e reserializava o XML, então o digest era calculado sobre uma string diferente da enviada. A regra do plano agora é assinar a string final e nunca mais tocar nela. Este ADR decide como canonicalizar, assinar, verificar e ler o PFX do certificado A1, com a restrição de rodar em Node, Bun, Deno e browser sem binário nativo.

Corpus local (dados pessoais, fora do repo; só agregados aqui): 4.703 documentos, sendo 2.115 NF-e próprias, 1.500 NF-e de terceiros (ERPs variados), 600 procEvento de NF-e (cancelamento e CC-e) e 488 MDF-e e eventos de MDF-e. Características relevantes: 450 arquivos com CRLF, 77 com `&amp;`, 2.740 com caracteres não ASCII, 371 com CDATA (qrCode do MDF-e, fora da área assinada), 119 com atributos em aspas simples, 14 com duas assinaturas (a da SEFAZ em `infProt`), nenhum com RSA-SHA256, C14N 1.1 ou exclusivo, nenhum com prefixo `ds:`, e nenhum ancestral (`nfeProc`, `procEventoNFe`, `mdfeProc`) declarando namespace além do default.

Ambiente: Node 26.3.1, Bun 1.4.2, Deno 2.9.1, OpenSSL 3.6.4, xmlsec1 1.3.12 (libxml2), Chrome headless, WebKit 26.5 (Playwright), macOS arm64.

## Opções com evidência

### Verificação sobre o corpus

Três implementações, mais o xmlsec1 como oráculo independente:

- **(a) xml-crypto 6.3.2** (MIT), DOM via `@xmldom/xmldom`, cripto via `node:crypto`.
- **(b) xmldsigjs 2.8.8** (MIT), DOM via xmldom, cripto via WebCrypto, depende de `xml-core`, `pkijs`, `asn1js`, `xpath`.
- **(c) própria**: parser mínimo que guarda offsets da string original (`src/xml.ts`, cerca de 300 linhas) + C14N 1.0 inclusivo escrito a partir da spec W3C + verificação só com WebCrypto (`src/dsig.ts`). Sem DOM, sem dependências. Rejeita DOCTYPE (sem XXE nem expansão de entidade) e rejeita `Id` duplicado (defesa contra signature wrapping).

| Implementação | Assinaturas válidas | Falhas | ms/doc Bun | ms/doc Node | ms/doc Deno |
|---|---|---|---|---|---|
| (c) própria | 4.682 de 4.699 | 17 | 0,13 | 0,15 | 0,22 |
| (b) xmldsigjs | 4.683 de 4.699 | 16 | 1,52 | 2,00 | 2,23 |
| (a) xml-crypto | 4.683 de 4.699 | 16 | 3,14 | 3,24 | 3,15 |
| xmlsec1 (CLI, 1ª assinatura) | concorda com (c) em 4.703 de 4.703 arquivos | | 9,5 ms/doc com spawn de processo | | |

A diferença de 1 entre (c) e as bibliotecas é um documento malformado (um `&` sem escape dentro do `infEvento`): o xmldom aceita XML que não é bem formado e o parser próprio recusa, o que é o comportamento correto. Reescapando o `&`, a assinatura desse documento confere.

As 16 falhas comuns às quatro implementações foram categorizadas. Em todas, o `SignatureValue` sobre o `SignedInfo` é válido, ou seja, o documento foi alterado depois de assinado, e não há erro de C14N:

| Categoria | Qtde | Evidência |
|---|---|---|
| Namespace removido depois da assinatura | 9 procEvento de NF-e | Nenhum elemento do documento declara `xmlns`; recolocando `xmlns="http://www.portalfiscal.inf.br/nfe"` no elemento, o digest bate |
| Whitespace inserido depois da assinatura | 7 NF-e de terceiros | 16 a 25 CRLF acrescentados no fim de `infCpl` e antes dele em `infAdic`; removendo, o digest bate; mesmo padrão nos 7 |
| `&` desescapado ao armazenar | 1 procEvento | Documento não é XML bem formado; reescapado, confere |

Outros 18 documentos não têm assinatura verificável: 7 NF-e próprias e 4 MDF-e sem `Signature`, e 7 NF-e de terceiros, das quais 6 tiveram o `Signature` da NFe removido e o da `protNFe` sem o namespace do xmldsig. Categorias pedidas que não produziram falha nenhuma: herança de namespace dentro do `nfeProc`, CRLF (450 arquivos, todos corretos com a normalização de fim de linha do XML 1.0 §2.11), entidades, ordem de atributos, `&amp;` e acentos.

### Casos de borda sintéticos

Doze casos gerados e assinados pela implementação própria (`bench/edge.ts`) e verificados pelo xmlsec1: CRLF e CR literais, `&#13;` e `&#9;` em texto e atributo, whitespace literal em atributo, entidades e acentos, CDATA com comentário e PI, ordem de atributos com prefixo, `xmlns:xsi` herdado do `nfeProc`, `xmlns=""`, `xml:lang` herdado, aspas simples e espaços dentro da tag, elementos vazios e whitespace entre tags, `infEvento` herdando o namespace do envelope.

| Implementação | Aceitos |
|---|---|
| xmlsec1 (oráculo) | 12 de 12 |
| (c) própria | 12 de 12 |
| (b) xmldsigjs | 11 de 12 (erra `xml:lang` herdado) |
| (a) xml-crypto | 10 de 12 (erra `xml:lang` herdado e o caso CDATA + PI) |

Os erros das bibliotecas não aparecem em NF-e real, mas mostram que elas não seguem a spec à risca.

### Assinatura

A implementação própria assina em três fases (`prepare`, `signPrepared`, `assemble`):

1. `prepare` acha o elemento pelo `Id`, calcula o digest do C14N dele, e insere por splice de string o `<Signature>` como último filho do pai do elemento (logo antes da tag de fechamento do pai, o que põe a assinatura depois de `infNFeSupl` e `infMDFeSupl`), com um placeholder no `SignatureValue`. O `SignedInfo` é canonicalizado já no contexto final, herdando os namespaces reais dos ancestrais.
2. O `Signer` assina os bytes do `SignedInfo` canonicalizado.
3. `assemble` troca o placeholder pelo `SignatureValue`. É a única edição de string depois do digest.

Resultados sobre uma NF-e do corpus com certificado autoassinado RSA-2048 descartável:

- A saída é exatamente a entrada com uma inserção (conferido por comparação de string).
- Com o mesmo template, o xmlsec1 produziu `DigestValue`, `SignatureValue` e `X509Certificate` idênticos aos nossos.
- xmlsec1, xml-crypto, xmldsigjs e o verificador próprio aceitam o documento assinado e o mesmo documento embrulhado num `nfeProc` por splice.
- Node, Bun, Deno, Chrome e WebKit produzem o mesmo `SignatureValue` byte a byte (RSASSA-PKCS1-v1_5 com SHA-1 via WebCrypto funciona nos cinco). Assinar custa 2,5 a 3,3 ms, com a importação da chave.
- Os dois modos de `Signer` geram saída idêntica: `data` (WebCrypto recebe os bytes e faz hash + RSA) e `digest` (recebe só o DigestInfo SHA-1 de 35 bytes e faz RSA cru, como `CKM_RSA_PKCS` em PKCS#11 ou um HSM remoto).
- Armadilha medida: se o envelope `nfeProc` ganhar um `xmlns:xsi` depois da assinatura, as quatro implementações rejeitam o documento, porque o C14N inclusivo leva os namespaces dos ancestrais para dentro do elemento assinado. Isso é da spec, não bug. Nenhum documento do corpus tem esse caso.
- Armadilha medida: no browser, um bundle carregado sem `<meta charset="utf-8">` foi decodificado como windows-1252 e gerou outra assinatura. Encoding é responsabilidade de quem entrega a string.

As bibliotecas assinam sobre DOM e devolvem o documento reserializado pelo `XMLSerializer`, que é exatamente o padrão que quebrou o brafis.

### Dependências e runtimes

| | (c) própria | (b) xmldsigjs | (a) xml-crypto |
|---|---|---|---|
| Pacotes em runtime | 0 | 10 (xml-core, pkijs, asn1js, bytestreamjs, pvtsutils, pvutils, tslib, xpath, @noble/hashes, xmldom como peer) | 3 (xmldom 0.8, is-dom-node, xpath) |
| Bundle browser min / gzip | 10,3 KB / 4,2 KB | 553 KB / 131 KB | 809 KB / 241 KB (com polyfill de `node:crypto` injetado pelo bundler) |
| Node, Bun, Deno | medido | medido | medido |
| Browser | medido em Chrome e WebKit | por desenho (WebCrypto), não medido aqui | só com polyfill de `node:crypto`, não medido |
| Assina sem reserializar | sim | não | não |

O xml-crypto teve CVEs de bypass de verificação em 2024 e 2025 (aceitar certificado do `KeyInfo` por padrão, e casos de SAML com comentários e múltiplos `SignedInfo`). Na versão 6 o certificado do `KeyInfo` só é usado se o chamador pedir explicitamente.

### Leitura de PFX

Oito PFX gerados com OpenSSL 3.6 a partir de uma AC de teste (folha + AC, senha `teste123` e uma variante com senha acentuada): perfis modernos (PBES2 AES-256, MAC SHA-256 ou SHA-1) e legados (`-legacy`, que é RC2-40 no cert e 3DES na chave com MAC SHA-1, o perfil típico de A1 ICP-Brasil antigo exportado pelo Windows; 3DES nos dois; cert sem cifra; RC2-128). Para cada leitor, "ok" exige extrair chave e certificado e produzir uma assinatura que confere via WebCrypto; o `tls.createSecureContext` só prova que o TLS aceita o arquivo, porque o `node:crypto` não expõe a chave de um PFX.

| PFX | TLS Node | TLS Bun | TLS Deno | node-forge 1.4.0 | pkijs 3.4.1 |
|---|---|---|---|---|---|
| PBES2 AES-256, MAC SHA-256 | ok | ok | ok | ok | ok |
| PBES2 AES-256, MAC SHA-1 | ok | ok | ok | ok | ok |
| 3DES / 3DES | ok | ok | ok | ok | falha |
| cert sem cifra / 3DES | ok | ok | ok | ok | falha |
| `-legacy` (RC2-40 / 3DES) | falha | ok | ok | ok | falha |
| RC2-40 / 3DES explícito | falha | ok | ok | ok | falha |
| RC2-40 / 3DES, senha acentuada | falha | ok | ok | ok | falha |
| RC2-128 / RC2-128 | falha | falha | falha | falha | falha |

- O Node 26 com OpenSSL 3 recusa RC2 ("Unsupported PKCS12 PFX data"); com `--openssl-legacy-provider` aceita todos, inclusive RC2-128. Bun (BoringSSL) e Deno aceitam RC2-40.
- O pkijs depende de WebCrypto, que não tem RC2 nem 3DES, então só lê PFX moderno.
- O node-forge lê todos os perfis que aparecem em A1 ICP-Brasil, em 5 a 24 ms, nas três runtimes. Licença `BSD-3-Clause OR GPL-2.0` (usamos a BSD). Bundle 290 KB min / 76 KB gzip, monolítico. Não lê RC2-128, que é raro.
- A senha acentuada funcionou com o forge porque o OpenSSL 3 converte UTF-8 para BMPString corretamente. PFX gerados por OpenSSL 1.0 e ferramentas antigas convertiam byte a byte (Latin-1), o que não foi testado.

## Decisão proposta

1. **`@sinete/core/xml` implementa o próprio parser com offsets e o próprio C14N 1.0 inclusivo**, sem DOM e sem dependências, a partir da spec W3C. É a única opção que assina por splice sem reserializar, passou em 12 de 12 casos de borda e em 100% dos documentos íntegros do corpus, é 10 a 25 vezes mais rápida que as bibliotecas e cabe em 4 KB gzip. O escopo é deliberadamente estreito: só C14N 1.0 inclusivo sem comentários, só `URI="#Id"`, só RSA-SHA1 (e RSA-SHA256 aceito na verificação), sem DTD.
2. **Assinatura em três fases com `Signer` plugável**, no formato do spike:
   ```ts
   type Signer =
     | { kind: 'data'; certificateDer(): Promise<Uint8Array>; sign(data: Uint8Array): Promise<Uint8Array> }
     | { kind: 'digest'; certificateDer(): Promise<Uint8Array>; signDigestInfo(di: Uint8Array): Promise<Uint8Array> };
   ```
   O A1 usa `data` com WebCrypto. A3 via PKCS#11, A3 em nuvem, HSM e KMS usam `digest`, e o conteúdo do documento não sai do processo. A string devolvida por `assemble` é a que vai para a SEFAZ e para o banco, sem passar por parser nem serializer.
3. **O verificador exige que o chamador diga o que espera ver assinado** (por exemplo `infNFe` com o Id da chave de acesso) e confere que a `Reference` aponta para esse elemento, além de rejeitar `Id` duplicado. O resultado é um tipo discriminado com categoria de falha (`digest-diverge`, `assinatura-invalida`, `parse`, `sem-assinatura` e afins), e na falha de digest deve informar também se o `SignedInfo` confere (o spike fez isso só no script de diagnóstico), o que distingue "documento alterado depois de assinado" de "assinatura forjada".
4. **xmlsec1 e xml-crypto entram como oráculos de teste**, só em devDependencies: teste diferencial no CI sobre fixtures anonimizadas e os casos de borda sintéticos.
5. **`@sinete/cert` lê PFX em JS com node-forge**, atrás de uma interface interna (`Pkcs12Reader`) para poder trocar depois. A chave sai como PKCS#8 para o WebCrypto. **Nunca passar `pfx` para o TLS**: o transporte recebe chave e certificado já extraídos em PEM, porque o Node com OpenSSL 3 recusa o PFX legado. Isso vale para o S2.

## Consequências

- A regra "assinar a string final" fica garantida por construção: o core só insere texto na string, e o teste de invariante (saída = entrada + uma inserção) entra no CI.
- Passamos a manter um parser e um C14N próprios. O risco é conformidade, mitigado pelo escopo estreito, pelo corpus de 4.703 documentos e pelo teste diferencial contra o xmlsec1.
- O mesmo código roda em Node, Bun, Deno e browser, o que viabiliza assinar A1 no browser (princípio 5 do plano).
- O parser próprio é estrito: XML malformado que o xmldom aceitaria é recusado com erro tipado. Para importação de terceiros (M2) isso é desejável, mas o integrador em produção precisa tratar a recusa.
- O verificador mostrou que parte do que está armazenado não é a string autorizada: 10 procEvento do corpus perderam o namespace ou o escape do `&` depois de assinados. Isso afeta o M2 (verificação na importação) e a guarda do XML autorizado no integrador em produção.
- Envelopes montados pelo sinete (`nfeProc`, `procEventoNFe`) não podem declarar namespaces extras nos ancestrais do elemento assinado.
- node-forge vira dependência de runtime do `@sinete/cert` (76 KB gzip) até existir um leitor próprio.

## Pendências

- Feito em 25/set/2026 (ver seção abaixo): a SEFAZ-SP de homologação aceitou uma NF-e assinada pelo sinete. Na Sefin Nacional, a DPS chegou à regra municipal E0312 (nível 3), o que indica assinatura aceita.
- O xmlsec1 fez o papel de oráculo independente sobre o mesmo XML.
- Testar PFX legados reais de AC ICP-Brasil, inclusive senha acentuada gerada por ferramenta antiga (BMPString a partir de Latin-1). Se aparecer, o leitor tenta as duas codificações.
- Avaliar um leitor PKCS#12 próprio (KDF da RFC 7292, RC2 da RFC 2268, 3DES e PBES2 via WebCrypto) para remover o node-forge e cobrir RC2-128.
- Investigar no integrador em produção onde o XML de evento perde o `xmlns` e o escape do `&` antes de ir para o banco.
- RSA-SHA256 ficou implementado só na verificação e não foi exercitado, porque o corpus não tem nenhum caso. Mais de uma `Reference` por assinatura é recusada, como no perfil SEFAZ.
- O C14N não foi medido com documentos grandes (NF-e com centenas de itens); o maior custo esperado é o parse, e o benchmark do corpus não isolou esse caso.

## Aceitação pela SEFAZ (25/set/2026)

Uma NF-e montada pelo codec do S1 (PL_010f) e assinada por `src/dsig.ts` foi enviada à SEFAZ-SP de homologação com o e-CNPJ A1 real da FAZER.AI LTDA. O PFX é legado (RC2-40 + 3DES) e foi lido pelo node-forge em memória; o `Signer` usado foi o `data` do WebCrypto. Foi uma tentativa só, e a string enviada é a devolvida por `assemble`, sem passar por parser nem serializer.

O lote voltou com cStat 104 ("Lote processado"), e o protocolo com cStat 166 ("UF de autorização não permitida para contribuinte exclusivo do IBS/CBS"), que é uma rejeição de regra de negócio sobre o cadastro do emitente, que não tem IE. Na ordem de validação do MOC, o schema (225) e a assinatura (certificado 290 a 296; 297 "assinatura difere do calculado"; 298 "assinatura difere do padrão") são conferidos antes das regras de negócio. Logo, o C14N, o `DigestValue`, o `SignatureValue` e o `KeyInfo` produzidos pelo sinete foram aceitos pela SEFAZ. Detalhes, chave de acesso e controles de uso do certificado estão no ADR 0004, seção 6.

Na NFS-e Nacional (produção restrita), a primeira DPS foi recusada com E1229 (faltava a declaração XML UTF-8), antes da assinatura. A segunda é a mesma DPS, com a mesma assinatura e só a declaração acrescentada. Ela voltou com E0312, uma regra de nível 3 (parametrização municipal do código de tributação). No Anexo I v1.01, as regras de assinatura (E0714 a E0718) são de nível 1, então a assinatura produzida pelo sinete (RSA-SHA1, C14N 1.0, `Reference` para `infDPS`) passou pela Sefin Nacional. Falta uma NFS-e efetivamente gerada. Ela não foi tentada de novo porque São Paulo, na produção restrita, não tem código de software com alíquota vigente hoje (ADR 0004, rodada 3).

## Como reproduzir

Em `spikes/s3-xmldsig/` (material com dados do corpus e chaves fica em `.local/` e `results/`, ignorados pelo git):

- `bun bench/own.ts`, `node bench/own.ts`, `deno run -A bench/own.ts`: verificador próprio no corpus.
- `bun bench/libs.ts xml-crypto` e `bun bench/libs.ts xmldsigjs`: bibliotecas no corpus.
- `bun bench/diag-falhas.ts`: categorização das falhas de digest.
- `bun bench/sign.ts` (nas três runtimes) e `bun bench/edge.ts`: assinatura e casos de borda; depois `xmlsec1 --verify --id-attr:Id infNFe --trusted-pem .local/cert.pem <arquivo>`.
- `bun bench/pfx.ts` (nas três runtimes): leitura dos PFX de teste gerados com `openssl pkcs12 -export` nas variantes da tabela.
