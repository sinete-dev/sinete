# sinete

Monorepo bun de pacotes `@sinete/*` (DF-e brasileiros em TypeScript, Apache-2.0). `bun run check` roda o mesmo que o CI; `bun run ci` soma a smoke dos tarballs.

## Invariantes

- **Assinar a string final e nunca mais tocar nela.** Nada de reparsear ou reserializar XML assinado.
- **Dados como dados.** Endpoints, tabelas, rejeições, cadeia ICP e regras por UF em arquivos versionados com `fonte` e vigência. Nunca `if (uf === 'MT')`.
- **Relógio injetado.** Nada de `new Date()` ou `Date.now()` fora de `packages/core/src/clock.ts` (o Biome barra). Dois relógios: emissão e fato gerador (`ContextoDeTempo`).
- **Erro tipado.** Todo erro estende `ErroSinete` com `code` estável; rejeição da SEFAZ é `ResultadoSefaz`, não exceção.
- **Sem LGPL/GPL.** Implementar das specs oficiais, registrar a origem de cada regra, nunca copiar código de projetos LGPL/GPL.
- **Corpus nunca no repo.** Nem certificado, nem XML real, nem dado pessoal. `scripts/check-no-secrets.ts` barra os casos comuns.
- Pacotes puros sem builtins do Node; código de runtime em entradas `*.node.ts` com condição `node` no `exports`.
- Commits com `Signed-off-by` (DCO) e Conventional Commits com o pacote como escopo.

## Leia quando

- for mexer em build, testes, smoke, CI ou publicação: `docs/adr/0001-tooling-monorepo.md` e `docs/release.md`
- for criar um pacote novo ou um subpath: `docs/adr/0008-divisao-de-pacotes.md` (na dúvida, é subpath), a estrutura de `packages/core/` e `scripts/umbrella.ts` (guarda-chuva `sinete`)
- for usar erros, desfechos, relógio, logger, ambiente ou UFs: `packages/core/README.md`
- for trabalhar em schemas ou codegen: `docs/adr/0002-codegen-xsd.md`
- for trabalhar em XML, assinatura ou certificado: `docs/adr/0003-xmldsig-c14n.md`
- for trabalhar em transporte, TLS ou endpoints: `docs/adr/0004-tls-transporte.md`
- for trabalhar no helper Go ou em A3: `docs/adr/0005-signer-tls-nativo.md`, `docs/signer-contract/PROTOCOL.md` e, para o cliente e a distribuição do binário, `docs/adr/0014-distribuicao-do-signer.md`
- for trabalhar em DANFE e nos outros documentos auxiliares (`@sinete/da`): `docs/adr/0006-danfe.md`
- for trabalhar em IBS/CBS (`@sinete/ibs-cbs`, `@sinete/ibs-cbs-dados`): `docs/adr/0007-rtc-dados-e-oraculo.md`
- for trabalhar no `@sinete/emissor` (estado, trava, retomada, pool) ou decidir se algo vai para ele ou para um pacote de documento: `docs/adr/0010-fronteira-emissor.md`
- for mexer em ocorrências de validação (`Ocorrencia`, `origem`, `rotuloDoCaminho`) ou no coletor de um montador: `docs/adr/0011-origem-e-rotulo-das-ocorrencias.md`
- for pré-validar uma regra da SEFAZ, curar a dica de uma rejeição ou mexer na barreira da recusa repetida (656): `docs/adr/0012-pre-validacao-pelas-rejeicoes-reais.md`
- for mexer na contingência automática do emissor (SVC da NF-e, NFC-e off-line, métodos de contingência do `TransmissaoStore`): `docs/adr/0013-contingencia-automatica.md`
- for mexer na documentação embarcada (`docs/guia/`, que vai no tarball do `sinete` e do `@sinete/emissor`), criar um código de erro ou mudar o bloco do `AGENTS.md` ou a skill `sinete`: `CONTRIBUTING.md` (seção Documentação embarcada) e `scripts/check-docs.ts`
- for dar nome a qualquer coisa pública (função, tipo, propriedade, valor de união): `docs/adr/0015-nomes-em-portugues.md`
- antes de abrir PR: `CONTRIBUTING.md`
- índice completo: `docs/README.md`

`spikes/` é código descartável de referência dos ADRs: não importe nada de lá.
