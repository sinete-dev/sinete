# Como os pacotes do sinete se dividem

O sinete é publicado como pacotes `@sinete/*` e como o pacote guarda-chuva `sinete`, que reúne as bibliotecas de uso e a ferramenta de linha de comando. Esta página explica o critério da divisão, para você saber o que instalar e de onde importar. As decisões estão nos registros de decisão de arquitetura (ADRs) 0008 e 0010 do sinete.

## Um pacote ou dois caminhos

- **`sinete`**: uma dependência só, com um caminho de importação específico, chamado subpath, por pacote (`sinete/nfe`, `sinete/emissor/nfe`, `sinete/da/nfe`...) e as versões dos `@sinete/*` fixadas num conjunto testado junto nos testes de instalação e uso dos pacotes publicados. Não tem entrada raiz de propósito: `import 'sinete'` não resolve. Um índice com tudo carregaria os dados tributários, os esquemas XML e os leiautes para quem precisa de uma parte, em ambientes que não eliminam código não utilizado. Além disso, há nomes exportados que colidem entre pacotes. `sinete/<pacote>` e `sinete/<pacote>/<x>` reexportam as entradas correspondentes de `@sinete/<pacote>` sem copiar a implementação: a função e a classe de erro são as mesmas pelos dois caminhos quando eles resolvem a mesma instalação do pacote. O guarda-chuva também fornece o executável `sinete`, do `@sinete/cli`.
- **`@sinete/*` avulsos**: para quem quer instalar só o que usa ou trocar a versão de um pacote isolado. Os dois caminhos convivem.
- **Fora do guarda-chuva:** o `@sinete/sefaz-sim`, simulador para testes, que não deve ir para a instalação de produção, e o `@sinete/signer`, que distribui o helper nativo `sinete-signer` e é instalado separadamente quando necessário. A API programática da ferramenta de linha de comando, como `runDoctor`, também exige importar diretamente de `@sinete/cli`.

## Quando algo é um pacote

Uma parte só vira pacote separado quando atende a pelo menos um dos critérios abaixo. Caso contrário, ela é um subpath de um pacote que já existe:

1. **Dependência pesada** que parte dos usuários não quer carregar: o `node-forge` do `@sinete/cert`, o `fflate` do `@sinete/da`, os cerca de 2,4 MB de JSON do `@sinete/ibs-cbs-dados`.
2. **Ritmo de publicação diferente:** o conjunto de dados do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS) muda com a Calculadora da Receita Federal do Brasil (RFB) e é versionado pelo mês dos dados (`AAAA.M.patch`, com ano, mês e revisão); o catálogo de rejeições acompanha o Manual de Orientação do Contribuinte (MOC) e as Notas Técnicas (NT).
3. **Ambiente de execução diferente:** a ferramenta de linha de comando (CLI) é destinada ao Node; o transporte tem entradas selecionadas pelas condições `node` e `default`, com implementações e limitações próprias para Node, Bun, Deno e navegador; o simulador é ferramenta de teste.
4. **Público próprio que instala só aquilo:** o sistema de gestão (ERP) que só valida CNPJ e inscrição estadual (IE), o sistema de ponto de venda (PDV) que só calcula IBS/CBS, quem só imprime o Documento Auxiliar da Nota Fiscal Eletrônica (DANFE) de notas recebidas (`@sinete/da`).
5. **Camada que compõe vários pacotes de documento com a mesma política:** o `@sinete/emissor`, que guarda estado entre chamadas, incluindo bytes gravados, trava para coordenar processos, retomada e pool de emissores reutilizáveis por certificado. Essa camada atende à Nota Fiscal Eletrônica (NF-e), ao Manifesto Eletrônico de Documentos Fiscais (MDF-e) e à Nota Fiscal de Serviço Eletrônica (NFS-e) do padrão nacional.

Reduzir o tamanho do bundle, o código empacotado para a aplicação, não é critério para criar um pacote. Os subpaths permitem importar só a parte necessária, e o empacotador pode eliminar código não utilizado. As entradas de cada pacote saem do mesmo build com code splitting, que compartilha o código comum entre elas sem duplicá-lo.

## Documento e emissor

Cada documento tem o pacote do protocolo (`@sinete/nfe`, `@sinete/mdfe`, `@sinete/nfse`): montagem, assinatura, cliente dos serviços e operações que o integrador pode compor sem adotar o armazenamento de transmissões do emissor. Entre essas operações estão resolver um envio sem resposta, recuperar eventos registrados e, na NF-e e no MDF-e, extrair o documento assinado do `proc`, o XML que reúne documento e protocolo. O `@sinete/nfe` também atende à Nota Fiscal de Consumidor Eletrônica (NFC-e).

O `@sinete/emissor` compõe essas operações com estado entre chamadas. A raiz do emissor não importa nenhum pacote de documento; cada subpath importa só o correspondente (`@sinete/emissor/nfe` importa o `@sinete/nfe`). Os pacotes de documento são peer dependencies opcionais, dependências que a aplicação fornece conforme o documento usado: quem só emite NF-e instala `@sinete/emissor` e `@sinete/nfe`, ou só `sinete`.

No Deno com `npm:` e sem `node_modules`, uma peer dependency opcional só é resolvida quando aparece nos imports estáticos da aplicação: importe também o pacote do documento (`import 'npm:@sinete/nfe'`) em algum módulo carregado pela aplicação. Para gerar documentos auxiliares no Deno e no navegador, importe estaticamente o subpath correspondente de `@sinete/da` e passe o módulo na opção `da` do emissor. Isso também garante a resolução dessa dependência opcional no Deno.

## Onde está cada coisa

| Precisa de | Importe de |
|---|---|
| emitir, retomar, cancelar com estado | `sinete/emissor/nfe`, `sinete/emissor/mdfe`, `sinete/emissor/nfse` |
| retomada automática, pool de emissores, contrato de armazenamento `TransmissaoStore` | `sinete/emissor` |
| store em memória para testes, suíte que verifica o contrato do store | `sinete/emissor/memoria`, `sinete/emissor/contrato` |
| montar, assinar e chamar diretamente os serviços da Secretaria da Fazenda (SEFAZ) ou da NFS-e Nacional | `sinete/nfe`, `sinete/mdfe`, `sinete/nfse` |
| IBS/CBS a partir da NF-e | `sinete/nfe` (calculadora) e `sinete/nfe/ibs-cbs` (motor e leitor dos dados) |
| IBS/CBS sem emitir | `sinete/ibs-cbs` e subpaths, `sinete/ibs-cbs-dados` |
| documentos auxiliares da NF-e (DANFE), da NFC-e (DANFC-e), do MDF-e (DAMDFE) e da Carta de Correção Eletrônica (DACCe) | `sinete/da/nfe`, `sinete/da/nfce`, `sinete/da/mdfe`, `sinete/da/cce` |
| documento auxiliar da NFS-e Nacional (DANFSe v2), gerado localmente a partir do XML autorizado | `sinete/da/nfse` |
| certificado A1 em arquivo, cadeia de certificação da Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil) | `sinete/cert` |
| certificado A3 em token PKCS#11, A3 em nuvem de Prestador de Serviço de Confiança (PSC) ou chave não exportável, pelo helper `sinete-signer` de `helpers/signer-tls` | `sinete/transport/signer` ou `@sinete/transport/signer` para o cliente; `@sinete/signer` para distribuir e iniciar o binário nativo |
| transporte mTLS, com autenticação por certificado do cliente e do servidor, e endereços dos serviços | `sinete/transport` |
| validação de CPF, CNPJ, IE e chave de acesso, o identificador do documento fiscal | `sinete/validators` |
| catálogo de rejeições da NF-e, do MDF-e e da NFS-e | `sinete/rejeicoes`, `sinete/rejeicoes/mdfe`, `sinete/rejeicoes/nfse` |
| tipos gerados dos esquemas XML (XSD), organizados por versão e pacote de liberação (PL) | `sinete/schemas` e subpaths |
| erros, desfechos das operações, relógio e assinatura digital XML (XMLDSig) | `sinete/core`, `sinete/core/xml` |
| SEFAZ simulada | `@sinete/sefaz-sim` (fora do guarda-chuva) |

A lista completa de cada entrada está na [referência](../referencia/index.md).

## Veja também

- [Por que o `store` e a trava](store-e-trava.md).
- [Tutorial: primeira NF-e](../tutorial/primeira-nfe.md).
