# Como emitir NFC-e

A NFC-e (Nota Fiscal de Consumidor Eletrônica, modelo 65) documenta a venda ao consumidor final, inclusive com entrega a domicílio. No sinete, ela usa a mesma entrada da NF-e (Nota Fiscal Eletrônica), `NfeInput`, com `modelo: '65'`. É montada pelo mesmo `buildNfe` e transmitida pelo mesmo `createNfeEmissor`. O que muda são as regras de montagem, o QR Code no grupo de informações suplementares do XML (`infNFeSupl`) e o DANFC-e, documento auxiliar da NFC-e, em bobina.

As regras implementadas vêm do Manual de Orientação do Contribuinte (MOC) 7.0, Anexo I, nas regras de aplicação obrigatória para o modelo 65; da Nota Técnica (NT) 2023.002 v1.01, sobre emitente pessoa física; da NT 2025.001 v1.03, sobre QR Code versão 3 e pagamentos; e da NT 2025.002 v1.51, sobre a reforma tributária. O leiaute do QR Code segue o Manual de Padrões Técnicos do DANFE NFC-e e QR Code, versão 6.0.

## Emitir

```ts
import { toPdf } from 'sinete/da/nfce';
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfce = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });

const d = await nfce.emitir('cupom-1', {
  ...venda, // emitente e itens, como na NF-e; sem destinatário na venda de balcão
  modelo: '65',
  serie: 1,
  nNF: 1,
  pagamento: { detPag: [{ tPag: '01', vPag: '20.00' }] }, // dinheiro; o troco sai sozinho
});
if (d.tipo === 'autorizado') await imprimir(await nfce.pdf(d.proc));
```

- **Padrões do modelo.** Quando os campos são omitidos, a NFC-e usa `indPres` 1 (presencial), `indFinal` 1 (consumidor final), `tpImp` 4 (DANFC-e impresso) e `idDest` 1 (operação interna, dentro da mesma unidade federativa, ou UF). `tpImp` 5 indica DANFC-e em mensagem eletrônica.
- **Destinatário.** Opcional na venda presencial. Obrigatório na entrega a domicílio (`indPres` 4, com endereço; regras de validação, ou RV, E01-20 e E05-20) e quando o total ultrapassa R$ 10.000,00 (RV W16-40, limite definido pela constante `NFCE_LIMITE_SEM_DESTINATARIO`). Quando informado, deve ser não contribuinte do ICMS (`indIEDest` 9). A montagem também recusa destinatário com o mesmo CNPJ do emitente. Na entrega a domicílio, é obrigatório identificar o transportador em `transporte.transportador`.
- **Pagamento.** Obrigatório. Não são aceitos `tPag` 14 (duplicata), 90 (sem pagamento) e 99 (outros). A soma dos pagamentos não pode ficar abaixo do total, exceto quando há pagamento posterior (`tPag` 91), que deve ter `vPag` zero. Quando os pagamentos superam o total, o `vTroco` é calculado se não for informado. Se informado, deve corresponder à diferença entre os pagamentos e o total. Cartão (03, 04) e PIX (17) exigem o grupo `card`, com os dados do pagamento eletrônico (NT 2025.001, YA04-10).
- **Grupos que a NFC-e não tem.** Data de entrada ou saída, previsão de entrega, notas referenciadas, cobrança, exportação, compra, cana, IPI (Imposto sobre Produtos Industrializados), II (Imposto de Importação), PIS-ST e COFINS-ST (PIS e Cofins por substituição tributária), ICMS da UF de destino, partilha do ICMS (Imposto sobre Circulação de Mercadorias e Serviços), veículo novo e armamento são recusados na montagem com `grupo_vedado`, antes da assinatura. Fora da entrega a domicílio, informar transportador também gera `grupo_vedado`; informar modalidade de frete diferente de `modFrete` 9 (sem frete) gera `campo_invalido`.
- **Homologação.** No ambiente de testes, a descrição do primeiro item é substituída pelo texto obrigatório da RV I04-10, definido em `XPROD_HOMOLOGACAO_NFCE`, assim como ocorre com o nome do destinatário na NF-e.
- **Emitente pessoa física.** Produtor rural com CPF emite NFC-e nas séries 920 a 969 (NT 2023.002), com e-CPF, o certificado digital da pessoa física, e QR Code versão 3.

## QR Code

O grupo `infNFeSupl` fica entre o `infNFe`, que contém os dados da nota, e a `Signature`, que contém a assinatura digital. O `signNfe`, também usado pelo emissor, insere esse grupo antes de assinar.

- **Versão 3**, o padrão (NT 2025.001; Manual 6.0, item 4.4): dispensa o CSC (Código de Segurança do Contribuinte). Na emissão normal, o QR Code contém apenas a chave de acesso, a versão e o ambiente.
- **Versão 2** (Manual 6.0, item 4.3): contém o hash SHA-1 dos parâmetros concatenados ao CSC. O CSC e seu identificador, `idCSC`, são fornecidos ao emitente pela Secretaria da Fazenda (SEFAZ) da UF. O CSC entra no cálculo do hash e nunca é incluído no XML. Essa versão não é aceita para emitente pessoa física.

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfceV2 = await createNfeEmissor({
  pfx,
  senha,
  ambiente: 'homologacao',
  store,
  aoDecidir,
  montagem: { qrCode: { versao: '2', idCSC: '1', CSC: process.env.CSC ?? '' } },
});
```

O endereço do QR Code e o `urlChave`, endereço de consulta pela chave de acesso impresso no DANFC-e, são obtidos conforme a UF, o ambiente e a data de emissão. A função `urlsNfce`, de `sinete/nfe`, consulta a tabela do Portal Nacional da NFC-e incluída na biblioteca. As opções `urlQrCode` e `urlChave` da montagem substituem os valores da tabela. Para AM e MA, a tabela não fornece o protocolo do endereço do QR Code, por isso é preciso informar `urlQrCode` com `http://` ou `https://`.

Na assinatura em três fases, usada com certificados A3 ou módulos de segurança de hardware (HSM), obtenha a assinatura dos parâmetros com `assinaturaQrCode(built, signer)` e monte o XML com `comQrCode(built, assinatura)`. Passe o XML devolvido ao `prepararAssinatura`, de `@sinete/core/xml`, com o `id` da nota, e conclua a assinatura. A3 em token PKCS#11, A3 em nuvem de prestador de serviço de confiança (PSC) e chaves não exportáveis também têm suporte pelo helper `sinete-signer`, em `helpers/signer-tls`, distribuído no npm como `@sinete/signer`, com cliente em `@sinete/transport/signer`. Veja [Certificado A3](certificado-a3.md).

## Contingência off-line

Sem conexão com a SEFAZ, a NFC-e pode ser emitida em contingência off-line, modo que permite assinar e imprimir antes da transmissão (`tpEmis` 9, MOC 7.0, campo B22). A transmissão posterior usa os mesmos bytes gravados.

O QR Code muda nesse modo. Na versão 3, além da chave, da versão e do ambiente, ele contém o dia da emissão, o valor total, o tipo e o número de identificação do destinatário e uma assinatura RSA-SHA1 desses parâmetros com o certificado da nota. Sem destinatário identificado, os campos de tipo e número ficam vazios; para destinatário estrangeiro, o tipo é 3 e o número fica vazio. Na versão 2, são acrescentados o dia, o valor e o `DigestValue`, resumo criptográfico usado na assinatura do XML. O texto desse resumo em Base64 é convertido para hexadecimal, caractere a caractere (Manual 6.0, itens 4.3 e 4.4).

```ts
import { danfce, toPdf } from 'sinete/da/nfce';

const d = await nfce.emitir('cupom-2', {
  ...venda,
  modelo: '65',
  contingencia: {
    tpEmis: '9',
    dhCont: new Date('2026-09-26T09:55:00-03:00'), // quando a contingência começou, com fuso
    xJust: 'SEM CONEXAO COM A SEFAZ AUTORIZADORA',
  },
});
if (d.tipo === 'pendente') {
  // A SEFAZ não respondeu: o DANFC-e sai dos bytes gravados, com "EMITIDA EM CONTINGÊNCIA".
  const gravado = await store.ler('nfe', 'cupom-2');
  if (gravado !== undefined) await imprimir(toPdf(danfce(gravado.xml)));
}
```

Ao informar a contingência manualmente, como no exemplo, o emissor tenta enviar a nota na hora. Se a SEFAZ autorizar, o desfecho será `autorizado`; uma resposta também pode indicar rejeição. Se o envio e as consultas posteriores não resolverem a situação, o desfecho será `pendente`. Os bytes ficam gravados para a [retomada](retomada.md).

Com a [contingência automática](contingencia.md#contingência-automática), depois das falhas previstas na política e da consulta ao status do autorizador, o emissor pode colocar as novas NFC-e em `tpEmis` 9. Enquanto esse modo estiver ativo, grava as notas sem tentar enviá-las naquele momento. A contingência off-line é decisão do emitente e não depende de ativação pela SEFAZ.

A NFC-e não usa a SVC (SEFAZ Virtual de Contingência), autorizador alternativo da NF-e que depende de ativação pela SEFAZ de origem. Informar `tpEmis` 6 ou 7 no modelo 65 é recusado na montagem (RV B22-70, rejeição 783). Informar `tpEmis` 9 no modelo 55 também é recusado (RV B22-10, rejeição 711).

## Armadilhas

- **CSC em log ou no repositório.** O CSC é segredo do emitente, assim como a senha do certificado. Armazene-o de forma segura. O sinete só o usa no cálculo do hash e nunca o grava no XML.
- **Lote com várias NFC-e.** A SEFAZ recusa lotes com mais de uma NFC-e (NT 2023.002, rejeição 126). O emissor envia uma nota por lote.
- **Regras que variam por UF.** A lista de CFOP (Código Fiscal de Operações e Prestações) e CST (Código de Situação Tributária) aceitos na NFC-e, o limite de valor da RV W16-30 e as regras de aplicação facultativa dependem da SEFAZ da UF. A montagem não aplica essas restrições estaduais; eventuais rejeições são recebidas na autorização. Isso não dispensa as validações obrigatórias já implementadas, como a relação entre o CFOP 5.933 e o grupo do ISSQN (Imposto sobre Serviços de Qualquer Natureza).
- **Contingência antiga pendente.** A retomada automática seleciona gravações de até `idadeMaximaMs`, cujo padrão é 3 dias. Se a conexão ficar indisponível por mais tempo, retome manualmente ou aumente a idade máxima. Esse parâmetro controla a seleção das gravações, não o prazo legal de transmissão, que depende da legislação da UF.

## Veja também

- [Emitir em contingência](contingencia.md): NF-e na SVC e MDF-e (Manifesto Eletrônico de Documentos Fiscais) off-line.
- [Retomada](retomada.md).
- [Gerar DANFE, DANFC-e, DAMDFE, DACCe e DANFSe](documentos-auxiliares.md).
- [Tratar as ocorrências de validação](ocorrencias-de-validacao.md).
