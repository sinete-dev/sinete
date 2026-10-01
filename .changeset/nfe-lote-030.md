---
'@sinete/nfe': minor
'sinete': minor
---

**Quebra: texto e tamanho dos campos conferidos na entrada** (ADR 0011, revisão de 01/10/2026). O `montarNfe` confere os textos da entrada antes de montar, e as ocorrências abaixo mudam de `caminho` e de `origem`. O `code` não muda. Quem compara `caminho` (tabela de rótulos, lista de campos que a aplicação preenche) precisa conferir estes casos:

| Ocorrência | `code` | Antes | Agora |
|---|---|---|---|
| caractere que o XML não representa, em qualquer texto da entrada | `campo_invalido` | caminho do documento montado (`infNFe.ide.natOp`, `infNFe.det[0].prod.xProd`), `origem: 'montagem'` | caminho da entrada (`natOp`, `itens[0].produto.xProd`), `origem: 'entrada'` |
| texto fora do tipo do leiaute (tamanho mínimo ou máximo, espaço nas pontas, caractere fora do `TString`) em `natOp`; `emitente.xNome`, `xFant` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`; `destinatario.xNome`, `email` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `xPais`; `retirada` e `entrega` (`xNome`, `xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `email`); `itens[n].produto.cProd`, `xProd`, `uCom`, `uTrib`, `xPed`; `itens[n].infAdProd`; `transporte.transportador.xNome`, `xEnder`, `xMun`; `transporte.volumes[n].esp`, `marca`, `nVol`; `cobranca.fatura.nFat`; `cobranca.duplicatas[n].nDup`; `pagamento.detPag[n].xPag`; `informacoesAdicionais.infAdFisco`, `infCpl`, `obsCont[n].xTexto`, `obsFisco[n].xTexto`; `compra.xNEmp`, `xPed`, `xCont` | `schema` | caminho do XSD (`/infNFe/ide/natOp`, `/infNFe/det[2]/prod/xProd`), `origem: 'montagem'` | caminho da entrada (`natOp`, `itens[1].produto.xProd`), `origem: 'entrada'`; a `mensagem` mantém o formato `<código do validador>: <texto>` |

O limite vem do tipo do elemento no PL da montagem, não de uma tabela de números. Não mudam: o nome do destinatário e, na NFC-e, a descrição do primeiro item em homologação (a montagem os troca pelas literais de teste), os grupos repassados no tipo do schema (`exporta`, `infIntermed`, `cana`, `agropecuario` e afins), as opções da montagem (o `respTec` das opções, o CSC, o QR Code) e os valores calculados, que continuam com o caminho do XML e `origem: 'montagem'`. O campo que já tem ocorrência de outra conferência da entrada não ganha a segunda.

**`signal` nos resolvedores.** `resolverEnvioSemResposta(cliente, nfeAssinada, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta. Compatível.
