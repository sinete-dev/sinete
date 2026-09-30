# Como usar o sinete no browser com a transmissão no servidor

No browser, o sinete monta, valida e assina documentos; a transmissão direta à SEFAZ, a Secretaria da Fazenda, exige TLS com certificado de cliente (mTLS). O `fetch` do browser não permite fornecer o certificado usado pelo sinete. Por isso, a entrada padrão do `@sinete/transport`, usada pelo bundler no browser, lança `ErroNaoSuportado` (`nao_suportado`) ao criar o transporte. Nos dois arranjos abaixo, a transmissão fica no servidor; a escolha depende de onde fica o certificado do emitente.

Também é possível usar o helper nativo `sinete-signer`, distribuído no npm como `@sinete/signer`, para estabelecer o mTLS fora do browser sem exportar a chave privada. O cliente `@sinete/transport/signer` aceita um canal até o helper, inclusive uma integração por WebSocket. Essa alternativa atende certificados A3 em token PKCS#11, A3 em nuvem de um Prestador de Serviço de Confiança (PSC) e chaves não exportáveis. Ela exige integrar o helper e o canal de comunicação; os exemplos abaixo usam certificados A1 em arquivo PFX.

## 1. Certificado no servidor: o browser só valida

É o arranjo mais simples. O servidor tem o PFX do emitente, arquivo que contém o certificado e a chave privada, e o emissor completo (`sinete/emissor/nfe`, com o `TransmissaoStore`, que guarda os documentos assinados durante a transmissão). O browser monta a Nota Fiscal Eletrônica (NF-e) para mostrar as ocorrências enquanto a pessoa preenche e manda os dados de entrada para o servidor emitir.

```ts
import { relogioDoSistema, contextoDeTempo } from 'sinete/core';
import { montarNfe, rotuloDoCaminho } from 'sinete/nfe';

const r = await montarNfe(nota, { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioDoSistema }) });
if (!r.ok) {
  for (const i of r.ocorrencias.filter((x) => x.origem === 'entrada')) mostrarNoCampo(i.caminho, rotuloDoCaminho(i.caminho), i.mensagem);
} else {
  await fetch(`/api/pedidos/${pedido.id}/nfe`, { method: 'POST', body: JSON.stringify(nota) });
}
```

O servidor chama `emissor.emitir(pedido.id, nota)` e monta de novo, com o próprio relógio: a nota do browser serviu só para validar. O cálculo do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS) no browser carrega a base de dados tributários, cerca de 2 MB de JSON, na primeira nota com item classificado para esses tributos. Essa base pode ficar em um arquivo separado se o bundler estiver configurado para dividir o código em arquivos carregados sob demanda.

## 2. Certificado com o usuário: o browser assina, o servidor transmite

Quando o A1 do emitente não pode sair da máquina dele, o browser abre o PFX, monta e assina. O servidor recebe o XML assinado, confere, grava no `store` e transmite com o certificado de um transmissor, como a empresa de software ou a contabilidade, no TLS. Na NF-e, o certificado do canal pode ser de um terceiro, enquanto a assinatura deve ser do emitente. Isso foi medido na SEFAZ Virtual do Rio Grande do Sul (SVRS), em homologação, em 26/set/2026: a autorização e a consulta funcionaram com o e-CNPJ de um terceiro no TLS e a assinatura do emitente. Outras unidades da federação (UFs) não foram medidas. Na Nota Fiscal de Serviço Eletrônica (NFS-e) Nacional, o sinete usa o certificado do próprio emitente no canal, o mesmo que assina a Declaração de Prestação de Serviços (DPS), enviada à Sefin Nacional para gerar a nota. O arranjo com transmissor terceiro abaixo não se aplica a esse fluxo.

No browser:

```ts
import { abrirPfx } from 'sinete/cert';
import { relogioDoSistema, contextoDeTempo } from 'sinete/core';
import { montarNfe, assinarNfe } from 'sinete/nfe';

const ks = await abrirPfx(new Uint8Array(await arquivoPfx.arrayBuffer()), { senha: senha, relogio: relogioDoSistema });
const r = await montarNfe(nota, { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioDoSistema }) });
if (r.ok) {
  const assinada = await assinarNfe(r.valor, await ks.assinador());
  await fetch(`/api/pedidos/${pedido.id}/nfe-assinada`, {
    method: 'POST',
    headers: { 'content-type': 'application/xml; charset=utf-8' },
    body: assinada,
  });
}
```

No servidor, confira a assinatura e se a chave de acesso corresponde ao emitente autenticado, à série e ao número reservado para o pedido. `conferirAssinatura` verifica a assinatura criptográfica com o certificado incluído no XML; a validação da cadeia de confiança e do vínculo desse certificado com o emitente precisa ser feita pela aplicação, com os recursos de `@sinete/cert`. Depois das conferências, grave os bytes com a trava do próprio `store` e retome: `retomar` consulta a chave antes e, se a consulta confirmar que a nota não consta, pode transmitir os mesmos bytes.

```ts
import { conferirAssinatura } from 'sinete/core/xml';
import { ErroTransmissaoEmAndamento } from 'sinete/emissor';
import { criarEmissorNfe } from 'sinete/emissor/nfe';
import { documentoAssinado } from 'sinete/nfe';

const transmissor = await criarEmissorNfe({ pfx: pfxDoTransmissor, senha: senhaDoTransmissor, ambiente: 'homologacao', store, aoDecidir });

async function receberAssinada(ref: string, xml: string) {
  const { id } = documentoAssinado(xml, 'NFe', 'infNFe'); // 'NFe' + chave de acesso
  const v = await conferirAssinatura(xml, { id, elemento: 'infNFe' });
  if (!v.ok) throw new Error(`assinatura não confere: ${v.motivo}`);
  conferirChaveDoPedido(ref, id.slice(3)); // emitente, série e número do pedido
  const trava = await store.travar('nfe', ref, 60_000);
  if (trava === undefined) throw new ErroTransmissaoEmAndamento('outra transmissão deste pedido está em curso');
  try {
    // Com bytes já gravados para o pedido, vale o que já estava lá: estes são ignorados.
    if ((await store.ler('nfe', ref)) === undefined) await store.gravar(trava, { xml, id: id.slice(3), meta: {} });
  } finally {
    await store.soltar(trava);
  }
  return transmissor.retomar(ref);
}
```

O exemplo mostra a verificação criptográfica e a gravação com trava. `conferirChaveDoPedido` é uma função da aplicação; as verificações da cadeia de confiança e do titular do certificado devem ser acrescentadas antes da gravação, usando o certificado retornado em `v.certificadoDer`.

Guarde o corpo da requisição como texto e preserve essa string no `store`. As funções de conferência analisam o XML, mas não substitua o texto recebido por uma versão serializada novamente. Na transmissão, o sinete pode remover a declaração XML para inserir a nota no envelope do serviço, preservando o conteúdo assinado.

## Armadilhas

- **Encoding.** Os dados usados no cálculo da assinatura são codificados em UTF-8. Uma página servida sem `<meta charset="utf-8">` fez o browser decodificar o bundle como windows-1252 e gerar outra assinatura, conforme registrado no documento de decisão de arquitetura ADR 0003 do sinete. Sirva a página e o corpo do POST em UTF-8.
- **Assinar de novo a cada clique.** O browser pode assinar quantas vezes quiser enquanto nada foi gravado no servidor. Enquanto houver um registro no `store`, o código acima ignora os bytes novos daquele pedido e retoma os gravados. Depois que o registro é concluído e removido, cabe à aplicação impedir uma nova emissão para um pedido já atendido. Não gere número novo no browser para o mesmo pedido.
- **Servidor que confia no XML.** Sem conferir a chave, um cliente pode mandar uma nota de outro emitente ou de outro número. `conferirAssinatura` exige o `Id` esperado e aceita também o nome do elemento esperado, informado como `infNFe` no exemplo. A função recusa múltiplos elementos com esse `Id` ou múltiplas assinaturas que o referenciem. Uma assinatura criptograficamente válida, por si só, não comprova a confiança no certificado nem sua relação com o emitente.
- **Senha do PFX.** Mantenha a senha apenas na memória da página pelo tempo necessário para abrir o PFX; nunca a mande ao servidor. O leitor do PFX não a guarda depois da leitura, mas cabe à aplicação limpar o campo e deixar de manter referências à senha. O sinete não garante sua remoção imediata da memória do browser.

## Veja também

- [Como tratar as ocorrências de validação](ocorrencias-de-validacao.md).
- [Como implementar o `TransmissaoStore`](store-sql.md).
- Referência: [`@sinete/nfe`](../referencia/nfe.md), [`@sinete/cert`](../referencia/cert.md) e [`@sinete/core`](../referencia/core.md).
