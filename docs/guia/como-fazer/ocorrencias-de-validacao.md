# Como tratar as ocorrências de validação

Antes de assinar, o sinete confere a entrada e o documento montado e reúne os problemas encontrados numa lista de ocorrências (`Ocorrencia`). Pelo emissor, a lista vem num `ErroDeValidacao` (`code: 'validacao_falhou'`), lançado antes de gravar o XML da transmissão. Pela montagem direta (`montarNfe`, `montarMdfe`, `montarDps`), vem como valor, em `{ ok: false, issues }`. Esta página mostra como separar o que a pessoa corrige do que precisa de investigação na integração, e como mostrar o campo em português.

## A ocorrência

| Campo | O que é |
|---|---|
| `caminho` | caminho do campo: da entrada (`itens[0].produto.xProd`, índice a partir de zero), das conferências do documento montado (`infNFe.det[0].prod.xProd`) ou do validador de XSD (`/infNFe/det[2]/prod/xProd`, índice a partir de um, só no elemento que se repete). O caminho é contrato: a mesma regra sobre a mesma entrada sai sempre no mesmo caminho |
| `code` | código estável da ocorrência (`valor_divergente`, `campo_invalido`, `schema`, `ibscbs_base_ausente`...); consulte `CODIGOS_OCORRENCIA_NFE` para NF-e, `CODIGOS_OCORRENCIA_MDFE` para MDF-e e `CODIGOS_OCORRENCIA`, de `@sinete/validators`, para os validadores avulsos |
| `mensagem` | texto para a pessoa, com a regra do Manual de Orientação do Contribuinte (MOC) e a rejeição quando aplicável, por exemplo `(F90, rejeição 663)`; pode mudar a cada versão |
| `origem` | `entrada` ou `montagem` (abaixo); quando ausente, a ocorrência não foi classificada, como nos validadores avulsos, que não sabem em que fase estão |

## `entrada` ou `montagem`

- **`entrada`**: a conferência foi sobre os dados de entrada (`DadosNfe`, `DadosMdfe`, `DadosDps`), usados para montar a Nota Fiscal Eletrônica (NF-e), o Manifesto Eletrônico de Documentos Fiscais (MDF-e) ou a Declaração de Prestação de Serviços (DPS). O `caminho` aponta para a entrada, onde o valor deve ser corrigido.
- **`montagem`**: a conferência foi sobre o que o sinete produziu a partir da entrada: o XML contra o XSD, que define a estrutura e os valores permitidos pelo leiaute vigente, a chave gerada, o grupo do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS) que a calculadora devolveu e as regras da Nota Técnica (NT) sobre ele. O `caminho` pode apontar para o documento montado ou para o item da entrada ao qual o resultado pertence.

Na NF-e, no MDF-e e na DPS, os textos da entrada são conferidos antes de montar: um caractere que o XML não representa e, nos campos de texto copiados como vieram (nomes, endereços, descrição e unidades do produto, informações adicionais, transportador, volumes e afins), o tipo do leiaute do Pacote de Liberação (PL) vigente, com o tamanho mínimo e máximo, sem espaço nas pontas e só com os caracteres que ele aceita. Essas ocorrências saem como `campo_invalido`, com `origem: 'entrada'`, o caminho da entrada (`itens[0].produto.xProd`) e uma mensagem para quem preenche o campo, por exemplo `no máximo 120 caracteres (tem 130)`, `sem espaço no começo nem no fim` ou `caractere não aceito: “€”`; o campo com mais de um problema tem uma ocorrência para cada. Na DPS, a conferência vale também dentro dos grupos que seguem o leiaute (prestador, tomador, intermediário e os grupos do serviço), com o tipo do leiaute da NFS-e: a descrição do serviço, por exemplo, aceita espaço nas pontas. O texto que vem das opções do montador (o responsável técnico das opções do MDF-e, a versão do aplicativo) continua conferido na montagem, com o caminho do XML.

A classificação é pela fase, não pelo código: o mesmo `schema` é `entrada` num grupo pronto que veio na entrada e `montagem` no grupo que a calculadora produziu. Para selecionar o que a pessoa pode corrigir, filtre por `entrada` e exclua os campos que o seu próprio sistema preenche, como a numeração e o responsável técnico. Essa exclusão depende da sua integração:

```ts
import { ehErroSinete, ErroDeValidacao } from 'sinete/core';
import { criarEmissorNfe } from 'sinete/emissor/nfe';
import { rotuloDoCaminho } from 'sinete/nfe';

const CAMPOS_DO_SISTEMA = [/^nNF$/, /^serie$/, /^respTec\b/];

const nfe = await criarEmissorNfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
try {
  await nfe.emitir(pedido.id, nota);
} catch (e) {
  if (!(e instanceof ErroDeValidacao) && !ehErroSinete(e, 'validacao_falhou')) throw e;
  const ocorrencias = (e as ErroDeValidacao).ocorrencias;
  const daPessoa = ocorrencias.filter((i) => i.origem === 'entrada' && !CAMPOS_DO_SISTEMA.some((r) => r.test(i.caminho)));
  const doSistema = ocorrencias.filter((i) => !daPessoa.includes(i));
  for (const i of daPessoa) mostrarNoCampo(i.caminho, `${rotuloDoCaminho(i.caminho)}: ${i.mensagem}`);
  if (doSistema.length > 0) logDeErros.registrar({ pedido: pedido.id, ocorrencias: doSistema });
}
```

## O caminho em português

`rotuloDoCaminho(path)`, de `sinete/nfe`, `sinete/mdfe` e `sinete/nfse`, transforma o caminho num rótulo compreensível: `itens[1].produto.xProd` vira `Item 2, Descrição do produto`, e `rodoviario.tracao.condutores[0].CPF` vira `Condutor 1, CPF`. Aceita caminhos da entrada e do documento montado, com pontos ou com barras, e apresenta a numeração a partir de um. Quando reconhece apenas o grupo ou o campo, devolve esse rótulo; quando não reconhece nenhum deles, devolve `Dados da NF-e`, `Dados do MDF-e` ou `Dados da DPS`. Na NFS-e, o rótulo é o da DPS: `tomador.CNPJ` vira `Tomador, CNPJ`, e o caminho do validador de XSD, que inclui a raiz (`/DPS/infDPS/serv/cServ/xDescServ`), vira `Serviço, Descrição do serviço`.

## Regras da SEFAZ conferidas antes do envio

Além do leiaute, a montagem da NF-e confere regras de validação da Secretaria da Fazenda (SEFAZ) que podem ser verificadas apenas com os dados do documento. As regras abaixo geram ocorrências com `origem: 'entrada'` e o caminho do campo. A mensagem cita a regra e a rejeição que ela evita.

Na tabela, RV significa regra de validação, CST é o Código de Situação Tributária, IE é a inscrição estadual e UF é a unidade federativa:

| Regra | Rejeição | `code` e `caminho` |
|---|---|---|
| série do emitente CNPJ de 0 a 889 (MOC 7.0 Anexo I, RV C02-30 e B26-10) | 503, 244 | `serie_invalida` em `serie` |
| CST 50 ou 51 com destinatário contribuinte isento, fora das exceções (RV N12-80; o CST 51 em operação interna passa na validação local) | 529 | `combinacao_invalida` em `itens[n].impostos.icms.CST` |
| parcela única vencendo na data de emissão, quando essa data coincide no fuso da emissão, no de Brasília e em UTC (NT 2025.001 v1.03, RV Y09-40) | 853 | `combinacao_invalida` em `cobranca.duplicatas` |
| NF-e sem IE do emitente, de contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10): NFC-e sem IE até o fim de 2032 (RV C17-42), emitente sem CNPJ (C17-43), IEST informada (C18-50), ICMS ou ICMS interestadual no item fora da devolução e do `tpNFCredito` 03 (N01-10), item sem o grupo IBS/CBS (UB12-11) | 156, 157, 158, 161, 162 | `campo_obrigatorio` em `emitente.IE`, `emitente.CNPJ` ou `itens[n].impostos.ibsCbs`; `combinacao_invalida` em `emitente.IEST`; `grupo_vedado` em `itens[n].impostos.icms` ou `itens[n].impostos.icmsUfDest` |
| CFOP de devolução (Tabela CFOP, `indDevol`) em NF-e que não é de devolução nem complementar, fora da nota de crédito 03, 04 e 06 (RV I08-144; NT 2025.002 v1.52) | 328 | `combinacao_invalida` em `itens[n].produto.CFOP` |
| CST fora de 00, 20, 40, 41, 60 e 61 com destinatário não contribuinte, fora das exceções da regra (RV N12-70; NT 2023.001 v1.60 e NT 2023.003 v1.40) | 508 | `combinacao_invalida` em `itens[n].impostos.icms.CST` |
| emitente com CNPJ-base diferente do certificado e-CNPJ ou CPF diferente do certificado e-CPF, pelo emissor; a comparação só ocorre entre documentos do mesmo tipo (RV F03 e F03A) | 213, 227 | `emitente_difere_do_certificado` em `emitente.CNPJ` ou `emitente.CPF` |
| destinatário estrangeiro: `idEstrangeiro` presente na operação com o exterior, mesmo que vazio, sem IE, com os caracteres permitidos, e fora do exterior só com consumidor final (RV E03a-10, E03a-20, E03a-30, E03a-60) | 720, 721, 925, 372 | `campo_obrigatorio`, `combinacao_invalida` ou `campo_invalido` em `destinatario`, `destinatario.idEstrangeiro` ou `destinatario.IE` |
| NF-e com nome (em produção) e endereço do destinatário (RV E04-10, E05-10) | 724, 726 | `campo_obrigatorio` em `destinatario.xNome` ou `destinatario.endereco` |
| código do município do destinatário com o prefixo da UF dele (RV E10-20) e país diferente do Brasil no endereço no exterior (RV E14-30) | 275, 926 | `combinacao_invalida` em `destinatario.endereco.cMun`, `campo_invalido` em `destinatario.endereco.cPais` |
| `idDest`, indicador de operação interna, interestadual ou com o exterior, compatível com as UFs do emitente e do destinatário, com as exceções de entrega, retirada, mesmo CNPJ, consumidor final e `UFCons`, a UF de consumo do combustível (RV E12-30 a E12-60) | 772, 773 | `combinacao_invalida` em `idDest`, quando informado, ou em `destinatario.endereco.UF`, quando o indicador foi inferido |
| indicador da IE: operação com o exterior exige não contribuinte, e saída para não contribuinte fora dessa operação exige consumidor final (RV E16a-20, E16a-40) | 790, 696 | `combinacao_invalida` em `destinatario.indIEDest` ou `indFinal` |
| IE do destinatário: contribuinte informa, isento e destinatário no exterior não informam (RV E17-20, E17-30, E17-40) | 728, 791, 792 | `campo_obrigatorio` ou `combinacao_invalida` em `destinatario.IE` |
| inscrição na Superintendência da Zona Franca de Manaus (Suframa) só na área incentivada (RV E18-30) | 251 | `combinacao_invalida` em `destinatario.ISUF` |

Nos eventos do emitente, como cancelamento e Carta de Correção Eletrônica (CC-e), com autor explícito, o cliente recusa o autor cujo CNPJ ou CPF difere do emitente identificado na chave (`autor_difere_do_emitente`, rejeição 574, RV P12-44). Regras facultativas, dependentes do cadastro da SEFAZ ou da configuração da UF, ou com exceções que não podem ser verificadas apenas pelo documento, ficam para a SEFAZ. Recusá-las localmente poderia impedir o envio de uma nota que seria aceita. A classificação dessas regras está no registro de decisão arquitetural ADR 0012 do repositório. Uma IE com `indIEDest` 9, indicador de não contribuinte, não é recusada apenas por essa combinação: existe IE de não contribuinte, e a regra que a cruza com o cadastro (5E17-12) fica para a SEFAZ.

## Armadilhas

- **Decidir pela mensagem.** A mensagem muda entre versões; decida pelo `code` e pela `origem`.
- **Mostrar tudo para a pessoa.** Uma ocorrência de `montagem` na tela ("o XML não confere com o schema") não diz o que corrigir. Registre-a no log e investigue a integração, inclusive a possibilidade de um valor de entrada ter causado a falha.
- **Parar na primeira.** Mostre todas as ocorrências recebidas, para a pessoa poder corrigir vários campos de uma vez. A lista reúne os problemas encontrados nas etapas executadas; uma falha que impede continuar a montagem pode deixar outras verificações para a próxima tentativa.
- **Rejeição da SEFAZ não é ocorrência.** A validação local não substitui a SEFAZ. Regras que dependem do cadastro dela, como IE ativa e emitente habilitado, ou da conferência do município com a tabela do Instituto Brasileiro de Geografia e Estatística (IBGE), podem resultar no desfecho `recusado`, com o `cStat`, código de situação da resposta, e a dica do catálogo. Não reenvie a mesma nota sem corrigir: ao atingir o limite de recusas iguais dentro da janela, a barreira do emissor impede novo envio do mesmo conteúdo para a mesma referência ([`recusa_repetida`](../erros/recusa_repetida.md)).

## Veja também

- [Erro `validacao_falhou`](../erros/validacao_falhou.md).
- Referência: [`@sinete/core`](../referencia/core.md), [`@sinete/nfe`](../referencia/nfe.md) e [`@sinete/mdfe`](../referencia/mdfe.md).
