# ADR 0009: verbos dos clientes de documento e o caminho curto

- Status: aceito
- Data: 26/set/2026
- Complementa o [ADR 0008](0008-divisao-de-pacotes.md), que decide os pacotes, mas não os nomes dentro deles.
- A decisão 3 (emissores curtos dentro de cada pacote de documento, com `aoAssinar`) foi revista pelo [ADR 0010](0010-fronteira-emissor.md): os emissores estão no `@sinete/emissor`, com `TransmissaoStore` obrigatório.

## Contexto

Quem chega pelo npm para emitir uma NF-e precisava de seis peças antes da primeira nota: abrir o PFX (`@sinete/cert`), tirar o signer, montar a identidade TLS, criar o transporte com uma política de hosts, montar a nota e criar o cliente. O exemplo do README tinha oito linhas e dependia de `transport` e `signer` que o leitor não sabia fazer. E o passo que evita a nota duplicada, gravar o XML assinado antes do envio e consultar a chave depois de um envio sem resposta, ficava num comentário e numa função à parte (`resolverEnvioSemResposta`).

Os três clientes também tinham crescido separados. A mesma operação tinha nomes diferentes (`consultarProtocolo` na NF-e, `consultar` no MDF-e, `consultarNfse` na NFS-e; `autorizar` na NF-e e no MDF-e, `emitir` na NFS-e), o `AbortSignal` era posicional num e opção noutro, e o resolvedor de envio sem resposta da NFS-e tinha outro nome e outra forma. Nada foi publicado e o único consumidor é o integrador em produção: é o momento barato de alinhar.

## Auditoria

| Operação | NF-e antes | MDF-e antes | NFS-e antes | Depois (os três) |
|---|---|---|---|---|
| enviar o documento assinado | `autorizar(xml, { sincrono })` | `autorizar(xml, signal?)` | `emitir(xml, { signal })` | `autorizar(xml, opcoes?)`, com `signal` nas opções dos três |
| consultar pela chave | `consultarProtocolo(chave, xml?)` | `consultar(chave, xml?)` | `consultarNfse(chave, opcoes?)` | `consultar(chave, ...)` |
| resolver envio sem resposta | `resolverEnvioSemResposta` → `{ acao }` | `resolverEnvioSemResposta` → `{ acao }` | `resolverEmissaoSemResposta` → `{ situacao }` | `resolverEnvioSemResposta` → `{ acao: 'concluida' \| 'reenviar' \| 'divergente' ... }` |
| cancelar | `cancelar(pedido)` | `cancelar(pedido)` | `cancelar(pedido)` | sem mudança |
| montar, validar, assinar e enviar | não havia | não havia | não havia | `emitir(entrada)` no emissor |

A regra que sai da tabela: **no cliente, o verbo nomeia a operação sobre bytes já assinados; no emissor, sobre a entrada do domínio.** `autorizar` recebe o XML assinado nos três documentos e devolve `authorized` quando dá certo, que é o `status` do desfecho do core. `emitir` recebe `NfeInput`, `MdfeInput` ou `DpsInput` e faz tudo. Antes, `emitir` na NFS-e recebia a DPS assinada, e o mesmo nome no emissor receberia a entrada: dois contratos com o mesmo verbo no mesmo pacote.

## Decisões

### 1. Renomeações da API completa, sem alias

| Pacote | Antes | Depois |
|---|---|---|
| `@sinete/nfe` | `NfeClient.consultarProtocolo(chave, nfeAssinada?)` | `NfeClient.consultar(chave, nfeAssinada?)` |
| `@sinete/nfe` | `AutorizarOpcoes` só com `sincrono` | ganha `signal` (aditivo) |
| `@sinete/mdfe` | `MdfeClient.autorizar(mdfeAssinado, signal?)` | `MdfeClient.autorizar(mdfeAssinado, { signal }?)`, tipo `AutorizarOpcoes` exportado |
| `@sinete/nfse` | `NfseClient.emitir(dpsAssinada, opcoes?)` | `NfseClient.autorizar(dpsAssinada, opcoes?)` |
| `@sinete/nfse` | `NfseClient.consultarNfse(chave, opcoes?)` | `NfseClient.consultar(chave, opcoes?)` |
| `@sinete/nfse` | `resolverEmissaoSemResposta(client, dps)` | `resolverEnvioSemResposta(client, dps)` |
| `@sinete/nfse` | `ResolucaoEmissao`: `{ situacao: 'concluida', chaveAcesso, nfse } \| { situacao: 'reenviar' }` | `ResolucaoEnvio`: `{ acao: 'concluida', chaveAcesso, nfse, outcome } \| { acao: 'reenviar', dpsAssinada } \| { acao: 'divergente', chaveAcesso, nfse }` |

Sem alias: cada alias é um nome a mais na API pública, na documentação e no autocomplete, e o custo de não tê-lo é trocar meia dúzia de chamadas no primeiro consumidor com a tabela acima.

O resolvedor da NFS-e ganhou o caso `divergente`, que faltava: mesmo Id de DPS não prova o mesmo conteúdo (série e número repetidos com outra DPS também têm o mesmo Id). Ele compara o DigestValue da DPS embutida na NFS-e com o dos bytes gravados; sem a assinatura na NFS-e devolvida, vale o Id, porque não se sabe se a Sefin real devolve a DPS assinada.

### 2. O que continua diferente, e por quê

As diferenças abaixo vêm do protocolo de cada documento e ficam:

- **Desfechos.** A NF-e tem denegação (`denied`, o número fica consumido); o MDF-e não tem (MOC MDF-e 3.00b, Visão Geral, 4.2.6), e o tipo diz `SefazOutcome<ProtocoloMdfe, never>`; a NFS-e só tem gerada ou rejeitada, com `erros` e `httpStatus` na rejeição (`NfseOutcome`). Só a NF-e tem `pending` na autorização (lote assíncrono); na NF-e e no MDF-e, o emissor usa `pending` também para a consulta que não decidiu.
- **Consulta da NFS-e.** É REST: `consultar` devolve a NFS-e ou `undefined` no 404, não um desfecho com `cStat`.
- **Nomes dos campos.** `chNFe`, `chMDFe` e `chaveAcesso` seguem o leiaute de cada documento; `situacao` é `autorizada` na NF-e e `autorizado` no MDF-e, pelo gênero do documento.
- **Verbos só de um documento.** `cartaCorrecao`, `manifestar`, `inutilizar`, `cancelarPorSubstituicao` (NFC-e), `consultarRecibo` e `aguardarRecibo` (lote assíncrono), `consultarCadastro` e `distribuicaoDFe` na NF-e; `encerrar`, `incluirCondutor`, `incluirDFe`, `pagamentoOperacao` e `consultarNaoEncerrados` no MDF-e; `substituir`, `solicitarAnaliseFiscal`, `registrarEvento`, `consultarDps`, `consultarEventos` e `parametros` na NFS-e (o `obterDanfse` saiu com a suspensão da API do DANFSe do ADN em 03/08/2026; o DANFSe é gerado pelo `@sinete/da/nfse`). `statusServico` e `distribuicaoDFe` mantêm o nome do serviço do WSDL.
- **Sem `evento` genérico.** Só a NFS-e tem um caso real para enviar um pedido de evento pronto (`registrarEvento`: os tipos 2xx e 3xx do Anexo II não têm montagem). Na NF-e e no MDF-e cada evento tem um método tipado, que monta o `detEvento` pelo schema do evento; um `evento(xml)` genérico abriria a porta para um evento montado à mão, sem a validação que o método tipado faz.

### 3. O caminho curto: `createNfeEmissor`, `createMdfeEmissor`, `createNfseEmissor`

Um emissor por pacote de documento, na raiz de cada um. O nome segue o das outras fábricas (`createNfeClient`, `createTransport`, `createA1Signer`, `createSefazSim`, `createParametrosMunicipais`: `create` e o nome do que é criado, em português quando não há termo técnico em inglês), e `createNfeEmissor` aparece ao lado de `createNfeClient` no autocomplete, que é onde quem está escolhendo entre os dois procura.

```ts
const nfe = await createNfeEmissor({ pfx, senha, uf: 'SP', ambiente: 'homologacao', aoAssinar });
const desfecho = await nfe.emitir(nota);
```

- **Padrões.** O PFX é aberto pelo `openPfx` (certificado fora da validade recusado na criação), o signer é o do certificado, o transporte é o `createTransport` do `@sinete/transport` com a identidade do PFX e uma `allowlistPolicy` com os hosts do ambiente e o `tpAmb` do corpo, o relógio é o `systemClock`, os endpoints são os dados do transporte e o autor dos eventos e consultas é o CNPJ ou CPF do certificado. Cada padrão tem uma opção que o troca (`clock`, `transporte`, `montagem`, `cliente`), e `emissor.cliente` é o cliente completo com o mesmo transporte.
- **Transporte preguiçoso.** O transporte só é criado na primeira operação de rede. Assim `assinar(entrada)` roda no browser, onde a entrada `default` do `@sinete/transport` não tem mTLS e lança `UnsupportedError` ao criar o transporte.
- **`aoAssinar` obrigatório.** O tipo exige e a criação confere. O emissor só envia depois que o gancho devolve; se ele lançar, nada vai para a SEFAZ. É a única garantia de que os bytes do reenvio existem: remontar depois de um envio sem resposta gera outro cNF e outro `dhEmi`, e a SEFAZ responde 539 ou autoriza uma segunda nota. Recomendado não bastava: o erro só aparece no dia em que a rede cai.
- **Envio sem resposta.** `emitir` trata timeout, conexão caída, resposta fora do leiaute e as rejeições de duplicidade (204 e 539; E0014 na NFS-e) pelo `resolverEnvioSemResposta`: concluída volta como `authorized`; não consta, reenvia os mesmos bytes uma vez; sem decisão, `pending` com a chave em `ref` (NF-e e MDF-e); a rejeição de duplicidade com outra chave volta como a rejeição que é; a mesma chave com outro conteúdo lança `DocumentoDivergenteError` (novo no core, `documento_divergente`), porque não há `cStat` da SEFAZ para um desfecho. Se nem a consulta responder, lança o erro do envio, e `retomar(xml)` continua com os bytes gravados.
- **Entrada inválida lança `ValidationError`** com todas as ocorrências, em vez de um terceiro formato de resultado. O desfecho de `emitir` fica exatamente o `SefazOutcome` do resto (o `matchOutcome` do core serve), e a validação local já lançava `ValidationError` nos métodos dos clientes. Quem quer as ocorrências como valor usa o `buildNfe` da API completa.
- **Dependências.** O `@sinete/cert` passa a ser dependência direta dos três pacotes. Não muda a instalação nem o que o Node carrega: o `@sinete/transport`, que os três já importavam, depende dele e o importa na entrada.
- **PDF.** `pdf()` usa o `@sinete/da` como peer dependency opcional (`peerDependenciesMeta`), importado na primeira chamada por um especificador montado em runtime. Um `import('@sinete/da/nfe')` literal quebraria o bundle de quem não instalou o pacote, porque o bundler tenta resolver todo especificador literal; o custo é que o bundler também não leva o `@sinete/da` de quem o instalou, então no browser o módulo vai pela opção `da`. No Deno também: com `npm:`, o import sob demanda de dentro do `@sinete/nfe` só acha a peer opcional quando o `@sinete/da` já está no grafo estático do app, e um `import()` do `@sinete/da` feito pelo app depois de carregar o `@sinete/nfe` quebra a resolução (o Deno 2.9 cria uma variante do pacote pela peer e não a materializa no cache). Visto na smoke; a regra documentada para o Deno é importar o `@sinete/da` de forma estática e passá-lo em `da`. Sem o pacote, `pdf()` lança `ConfigError`. Na NFS-e, `pdf()` é o DANFSe do ADN, porque a geração local ainda não está no `@sinete/da` (ADR 0006).

### 4. Testes

Cada emissor tem uma suíte contra o `@sinete/sefaz-sim` em HTTPS com mTLS, com um PFX sintético (`syntheticPfx`, novo no simulador, montado com o node-forge a partir do `syntheticCertificate`): autorização, envio sem resposta concluído pela consulta, envio que não chegou reenviado com os mesmos bytes, emissão que lança quando nem a consulta responde seguida de `retomar` com os bytes gravados, consulta paralisada como `pending`, divergência e duplicidade. A smoke roda o caminho curto em Node, Bun e Deno contra o simulador em processo, com a conexão caindo depois do processamento; no Chromium, só monta e assina. Um segundo consumidor, sem o `@sinete/da`, confere que a instalação não o traz, que o bundle de browser fecha e que o `pdf()` pede o pacote.

## Consequências

- O primeiro consumidor troca as chamadas da tabela da decisão 1. Nada mais muda na API completa.
- Documento novo (CT-e, NFCom) nasce com `autorizar`, `consultar`, `resolverEnvioSemResposta` com `acao`, e um `create<Doc>Emissor` com `emitir`, `assinar`, `retomar` e `aoAssinar` obrigatório.
- O README de cada documento abre com o caminho curto e mostra a API completa depois.

## Pendências

- O emissor só lê PFX. A3 e HSM (ADR 0005) continuam pela API completa; quando o helper existir, o emissor pode aceitar a identidade e o signer dele.
- O caminho curto não foi exercitado contra a SEFAZ real; os serviços que ele usa foram, na NF-e (veja `docs/validacao-homologacao.md`).
