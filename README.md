<div align="center">

# sinete

**Nota fiscal eletrônica, do XML à autorização na SEFAZ.**

Biblioteca JavaScript e TypeScript para NF-e, NFC-e, MDF-e e NFS-e Nacional, com cálculo de IBS/CBS, DANFE e demais PDFs auxiliares, e retomada da emissão quando a conexão cai.

[![Licença Apache-2.0](https://img.shields.io/badge/Licen%C3%A7a-Apache--2.0-3B82F6)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
![Node](https://img.shields.io/badge/Node-339933?logo=nodedotjs&logoColor=fff)
![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=fff)
![Deno](https://img.shields.io/badge/Deno-000?logo=deno&logoColor=fff)

</div>

O **sinete** é uma biblioteca TypeScript/JavaScript para integrar emissão fiscal ao seu ERP, PDV ou emissor. Monta, valida, assina e transmite os documentos, com os bytes assinados gravados no banco da aplicação antes do envio. Se a conexão cair, a SEFAZ pode ter autorizado a nota sem que a resposta tenha chegado ao seu sistema. Ao retomar a emissão, o sinete consulta a chave e, se precisar reenviar, usa os mesmos bytes, evitando criar outra nota para a mesma operação.

## Destaques

- **Emissão que pode ser retomada:** grava os bytes antes de transmitir e consulta a chave após uma queda, evitando duplicidade e rejeição 539.
- **Validação antes da SEFAZ:** aplica regras das rejeições reais e devolve todas as ocorrências locais juntas em um `ErroDeValidacao`.
- **A1 e A3:** usa A1 sem binário nativo, JDK ou openssl externo, e integra token PKCS#11 ou A3 em nuvem pelo `sinete-signer`.
- **Reforma tributária:** calcula IBS/CBS e determina CST e cClassTrib pelos fatos do negócio, com dados oficiais versionados por mês.
- **PDF e HTML locais:** gera os documentos auxiliares sem browser headless, fonte embutida ou dependência nativa.
- **Teste a queda de conexão:** o simulador injeta falhas inclusive depois da autorização, para exercitar a recuperação no seu sistema.
- **Referência da versão instalada:** a documentação vem no pacote e pode ser indicada aos agentes de código pelo comando `agents-md`.

## Comece agora

```sh
npm install sinete
```

Siga o [tutorial da primeira NF-e](docs/guia/tutorial/primeira-nfe.md) para emitir no simulador, provocar uma queda após a autorização, retomar a emissão e gerar o DANFE. O tutorial também mostra como passar para a SEFAZ de homologação.

Na integração abaixo, `meuStore` implementa o `TransmissaoStore` sobre o banco da aplicação. A função `guardarNota`, usada em `aoDecidir`, precisa ser idempotente: uma retomada pode chamá-la novamente. Veja o [guia de store SQL](docs/guia/como-fazer/store-sql.md).

```ts sem-execucao
import { readFile } from 'node:fs/promises';
import { criarEmissorNfe } from 'sinete/emissor/nfe';

const senha = process.env.SINETE_PFX_SENHA;
if (senha === undefined) throw new Error('defina SINETE_PFX_SENHA');

const emissor = await criarEmissorNfe({
  pfx: await readFile('empresa.pfx'),
  senha,
  ambiente: 'homologacao',
  store: meuStore, // TransmissaoStore sobre o banco da aplicação
  aoDecidir: guardarNota, // upsert pela ref, idempotente
});

const desfecho = await emissor.emitir(pedido.id, nota);
```

Use o `doctor` para conferir certificado, cadeia, relógio e TLS com o autorizador antes da emissão. Ele lê a senha do ambiente e não exibe a chave nem a senha.

```sh
export SINETE_PFX_SENHA=...
npx sinete doctor --pfx empresa.pfx --uf SP --status
```

## Por que o emissor guarda os bytes antes do envio

Uma conexão encerrada sem resposta não diz se a nota foi autorizada. Montar outro XML nessa hora pode produzir outra chave e resultar em duplicidade ou rejeição 539.

O emissor trava a operação e grava os bytes assinados no `TransmissaoStore` antes de enviá-los. Ao retomar, consulta a chave e, se precisar reenviar, usa os mesmos bytes. Enquanto houver bytes gravados, `emitir(ref, entrada)` ignora a nova entrada para aquela referência.

Esse contrato inclui a gravação idempotente do resultado em `aoDecidir`. Leia a explicação de [bytes antes do envio](docs/guia/explicacao/bytes-antes-do-envio.md) para implementar a recuperação na sua aplicação.

## O que cobre

| Documento ou área | O que faz | O que ainda não faz |
|---|---|---|
| NF-e (55) | Montagem tipada, totais em decimal exato, autorização síncrona e assíncrona, consultas, cancelamento, CC-e, manifestação do destinatário, inutilização, consulta cadastro, SVC e Distribuição DF-e | EPEC e FS-DA |
| NFC-e (65) | Autorização, cancelamento, QR Code v2 e v3, contingência off-line e DANFC-e | Regras específicas de cada UF, como listas de CFOP e CST aceitos |
| MDF-e (58, leiaute 3.00b) | Rodoviário para carga própria, produtor rural com e-CPF e prestador de transporte; QR Code, contingência off-line, encerramento, cancelamento e consulta de não encerrados | Outros modais |
| NFS-e Nacional (leiaute 1.01) | DPS tipada, emissão síncrona na Sefin Nacional, substituição, consultas, eventos e cancelamento com recuperação de evento já registrado | NFS-e municipais com leiaute próprio |
| IBS/CBS | Alíquotas por fato gerador, cálculo e validação da NT 2025.002, determinação de CST e cClassTrib pelos fatos do negócio; uso em qualquer DF-e | Monofasia e Imposto Seletivo, que retornam erro em vez de valor zerado |
| Documentos auxiliares | DANFE retrato, paisagem e simplificado, DANFC-e, DAMDFE, DACCe e DANFSe v2 em PDF e HTML | Sem pendência registrada |
| Certificados | PFX A1, cadeia ICP-Brasil e assinatura XML; A3 em token PKCS#11, A3 em nuvem de PSC e chave não exportável pelo helper | Uso de A3 sem o helper |
| Validadores | CPF, CNPJ alfanumérico, IE e chave de acesso; catálogo de rejeições com causa e correção sugerida | Sem pendência registrada |
| Simulador | Web services, ordem de validação e estado equivalentes, com AC e e-CNPJ sintéticos e falhas injetáveis | Substituir a validação no serviço real |

### Transmissão e contingência

Após 3 recusas iguais em 1 hora, a 4ª tentativa idêntica é barrada localmente para evitar a rejeição 656 por consumo indevido.

A entrada na SVC exige que o status da própria SVC responda 107, conforme a NT 2013.007. Na NFC-e, a contingência off-line é uma decisão do emitente.

### Documentos auxiliares

A geração é local e determinística: a mesma entrada produz os mesmos bytes em qualquer runtime, sem browser headless, fonte embutida ou dependência nativa.

O DANFSe v2 segue a NT 008/2026. Sua geração não depende da API de DANFSe do ADN, desligada em 03/08/2026.

### Regras, assinatura e erros

As regras têm origem registrada no MOC, nas Notas Técnicas e nos XSD; os tipos são gerados dos XSD. Endpoints, tabelas, rejeições e cadeia ICP-Brasil são dados versionados com fonte e vigência, sem `if` por UF no código.

A assinatura XML é inserida por splice na string final, sem reserializar o XML assinado. Os relógios de emissão e de fato gerador podem ser injetados.

Uma rejeição da SEFAZ volta como desfecho da operação. Erros têm `code` estável e uma página correspondente em `erros/<code>.md`.

## Documentação e agentes de código

Consulte o [índice do guia](docs/guia/index.md). A documentação está organizada em tutorial, como fazer, explicação, referência e erros. Sua fonte fica em `docs/guia/` e acompanha os pacotes em `node_modules/sinete/docs/` e `node_modules/@sinete/emissor/docs/`.

- **Persistência e operação:** [store SQL](docs/guia/como-fazer/store-sql.md), [retomada](docs/guia/como-fazer/retomada.md) e [vários emitentes com pool por certificado](docs/guia/como-fazer/varios-emitentes.md).
- **Eventos e contingência:** [cancelamento](docs/guia/como-fazer/cancelamento.md), [carta de correção](docs/guia/como-fazer/carta-de-correcao.md) e [contingência](docs/guia/como-fazer/contingencia.md).
- **Documentos e tributos:** [NFC-e](docs/guia/como-fazer/nfce.md), [NFS-e Nacional](docs/guia/como-fazer/nfse.md), [MDF-e](docs/guia/como-fazer/mdfe.md) e [IBS/CBS](docs/guia/como-fazer/ibs-cbs.md).
- **Integração:** [certificado A3](docs/guia/como-fazer/certificado-a3.md), [browser](docs/guia/como-fazer/browser.md) e [documentos auxiliares](docs/guia/como-fazer/documentos-auxiliares.md).

Para orientar o agente de código do seu projeto:

```sh
npx sinete agents-md
```

O comando insere as instruções do sinete no `AGENTS.md`, delimitadas por `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`. Se o `CLAUDE.md` não existir, cria o arquivo com `@AGENTS.md`. Instala também a skill `sinete` em `.claude/skills/` e `.agents/skills/`, que aponta para a mesma documentação (`--sem-skill` a dispensa).

Essas instruções mandam o agente consultar a documentação instalada. A API muda entre versões e o domínio fiscal é pouco coberto no treino dos modelos; usar a referência que acompanha o pacote evita depender de exemplos de outra versão.

## Estado do projeto

A versão é **0.x**, com possibilidade de mudanças na API até a 1.0.

Desde setembro de 2026, o sinete está em produção num emissor em uso comercial, atendendo produtores rurais em várias UFs. Esse uso cobre autorização, cancelamento, CC-e e consulta cadastro de NF-e, além de emissão e encerramento de MDF-e.

A validação em serviços reais cobre:

- **SEFAZ de homologação:** status em todos os autorizadores e SVC, consulta cadastro, Distribuição DF-e, autorização de NF-e na SVRS com cStat 100, consulta, carta de correção e cancelamento.
- **Sefin Nacional em produção restrita:** emissão e cancelamento de uma NFS-e em setembro de 2026.
- **Ainda sem validação em ambiente real:** inutilização, recibo assíncrono e NFC-e.

Os registros estão no [relatório de validação em homologação](docs/validacao-homologacao.md).

## Runtimes

Use a biblioteca em Node, Bun, Deno ou browser, observando as condições de transmissão:

| Runtime | Suporte |
|---|---|
| Node `^20.19.0 \|\| >=22.12.0` | `import` e `require` |
| Bun | sim; transmissão mTLS sem hosts só DHE (GO produção), porque o BoringSSL não tem DHE (ADR 0004, seção 7) |
| Deno 2 | via `npm:`; transmissão mTLS parcial, declarada por endpoint (ADR 0004) |
| Browser | monta, valida e assina com A1; a transmissão fica no servidor |

O [ADR 0004](docs/adr/0004-tls-transporte.md) registra as condições de TLS. Para integrar no navegador, consulte o [guia de browser](docs/guia/como-fazer/browser.md).

## Pacotes

Instale `sinete` para acessar as bibliotecas por subpaths como `sinete/nfe`, `sinete/emissor/nfe` e `sinete/da/nfe`. Os pacotes `@sinete/*` também podem ser usados separadamente; o simulador fica fora do guarda-chuva. O [ADR 0008](docs/adr/0008-divisao-de-pacotes.md) explica a divisão.

| Pacote | Conteúdo |
|---|---|
| [`sinete`](packages/sinete/README.md) | Guarda-chuva: um subpath por pacote, versões fixadas e o bin `sinete` |
| [`@sinete/core`](packages/core/README.md) | Erros tipados, desfechos da SEFAZ, relógio, logger, ambiente, UFs; em `@sinete/core/xml`, parser, C14N e XMLDSig |
| [`@sinete/schemas`](packages/schemas/README.md) | Código gerado dos XSD por documento e PL |
| [`@sinete/cert`](packages/cert/README.md) | PFX, cadeia ICP-Brasil e `Assinador` A1 |
| [`@sinete/transport`](packages/transport/README.md) | SOAP e REST com mTLS, endpoints como dados |
| [`@sinete/validators`](packages/validators/README.md) | CPF, CNPJ alfanumérico, IE e chave de acesso |
| [`@sinete/rejeicoes`](packages/rejeicoes/README.md) | Catálogo de rejeições com causa e correção |
| [`@sinete/nfe`](packages/nfe/README.md) | NF-e e NFC-e: emissão, eventos, contingência SVC, Distribuição DF-e, IBS/CBS por padrão (`@sinete/nfe/ibs-cbs`); NFC-e com QR Code |
| [`@sinete/mdfe`](packages/mdfe/README.md) | MDF-e |
| [`@sinete/nfse`](packages/nfse/README.md) | NFS-e Nacional |
| [`@sinete/ibs-cbs`](packages/ibs-cbs/README.md) | IBS/CBS para qualquer DF-e: alíquotas, cálculo, regras da NT 2025.002, determinação de CST e cClassTrib |
| [`@sinete/ibs-cbs-dados`](packages/ibs-cbs-dados/README.md) | Dados oficiais do IBS/CBS versionados pelo mês dos dados |
| [`@sinete/da`](packages/da/README.md) | DANFE, DANFC-e, DAMDFE, DACCe e DANFSe em PDF e HTML, um subpath por documento |
| [`@sinete/emissor`](packages/emissor/README.md) | Emissão com estado: bytes assinados gravados antes do envio (`TransmissaoStore`), trava entre processos, retomada automática, cancelamento com recuperação, pool por certificado; um emissor por documento (`@sinete/emissor/nfe`, `/mdfe`, `/nfse`) |
| [`@sinete/sefaz-sim`](packages/sefaz-sim/README.md) | SEFAZ simulada para testes |
| [`@sinete/cli`](packages/cli/README.md) | `sinete doctor` e `sinete agents-md` |
| [`@sinete/signer`](helpers/signer-tls/README.md) | Helper `sinete-signer` em Go para A3 e chave não exportável, fora do workspace |

O `sinete-signer` termina o mTLS com a SEFAZ sem guardar a chave. Seu código fica em `helpers/signer-tls`, e a distribuição no npm usa `@sinete/signer` e `@sinete/signer-<os>-<cpu>`.

## Contribuir

Prepare o ambiente e execute as verificações:

```sh
bun install
bun run check   # lint, build, typecheck, testes, gates do tarball
bun run ci      # check + smoke em Node, Bun, Deno e Chromium
```

O `check` também compila os exemplos do README e da documentação e executa o tutorial. O `ci` acrescenta a smoke dos tarballs em Node 20, 22, 24 e 26, Bun, Deno e Chromium.

**DCO obrigatório.** Consulte o [guia de contribuição](CONTRIBUTING.md) para preparar sua PR, os [ADRs](docs/adr/README.md) para entender as decisões e o [índice da documentação](docs/README.md) para localizar as referências.

## Licença

O sinete é distribuído sob [Apache-2.0](LICENSE). A licença do core não muda.

O uso da marca está descrito em [TRADEMARKS.md](TRADEMARKS.md). Para reportar vulnerabilidades, siga [SECURITY.md](SECURITY.md).

## Links

- Site: [fazer.ai](https://fazer.ai)
- Documentação: [guia do sinete](docs/guia/index.md)
- Contribuições: [CONTRIBUTING.md](CONTRIBUTING.md)

<div align="center">
<sub>Apache-2.0 · feito pela <a href="https://fazer.ai">fazer.ai</a></sub>
</div>
