---
'@sinete/nfe': minor
'sinete': minor
---

**Quebra: texto e tamanho dos campos conferidos na entrada** (ADR 0011, revisão de 01/10/2026). O `montarNfe` confere os textos da entrada antes de montar, e as ocorrências abaixo mudam de `caminho` e de `origem`; o texto fora do tipo do leiaute muda também de `code` e de `mensagem`. Quem compara `code` ou `caminho` (lista de códigos que vão para a tela, tabela de rótulos, lista de campos que a aplicação preenche) precisa conferir estes casos:

| Ocorrência | Antes | Agora |
|---|---|---|
| caractere que o XML não representa (de controle, substituto solto), em qualquer texto da entrada | `code: 'campo_invalido'`, caminho do documento montado (`infNFe.ide.natOp`, `infNFe.det[0].prod.xProd`), `origem: 'montagem'`, `mensagem: 'texto com caractere não permitido em XML'` | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[0].produto.xProd`), `origem: 'entrada'`, `mensagem: 'caractere não aceito (símbolo ou caractere de controle)'` |
| texto fora do tipo do leiaute (tamanho, espaço nas pontas, caractere fora do `TString`) nos campos listados abaixo | `code: 'schema'`, caminho do XSD (`/infNFe/ide/natOp`, `/infNFe/det[2]/prod/xProd`), `origem: 'montagem'`, `mensagem` do validador (`tamanho_maximo: tamanho máximo 60 (TString)`, `padrao: valor não casa com o pattern (TString)`) | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[1].produto.xProd`), `origem: 'entrada'`, uma ocorrência por regra violada, com `mensagem` para quem preenche o campo |

As mensagens novas do texto fora do tipo: `no máximo 60 caracteres (tem 70)` (e `no mínimo`, `exatamente`, com o limite do PL), `sem espaço no começo nem no fim`, `caractere não aceito: “€”` (o primeiro caractere recusado, quando é visível), `caractere não aceito (símbolo ou caractere de controle)` (quando não é), `não pode ficar em branco` (só espaços) e, para o que o tipo recusa sem ser um desses casos, `formato não aceito`. A `mensagem` não é contrato (ADR 0016): o `code`, o `caminho` e a `origem` são.

Campos conferidos na entrada: `natOp`; `emitente.xNome`, `xFant` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`; `destinatario.xNome`, `email` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `xPais`; `retirada` e `entrega` (`xNome`, `xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `email`); `itens[n].produto.cProd`, `xProd`, `uCom`, `uTrib`, `xPed`; `itens[n].infAdProd`; `transporte.transportador.xNome`, `xEnder`, `xMun`; `transporte.volumes[n].esp`, `marca`, `nVol`; `cobranca.fatura.nFat`; `cobranca.duplicatas[n].nDup`; `pagamento.detPag[n].xPag`; `informacoesAdicionais.infAdFisco`, `infCpl`, `obsCont[n].xTexto`, `obsFisco[n].xTexto`; `compra.xNEmp`, `xPed`, `xCont`.

O limite vem do tipo do elemento no PL da montagem, não de uma tabela de números. Não mudam e continuam `schema` (ou `campo_invalido` com a mensagem antiga, no caractere fora do XML), com o caminho do XML e `origem: 'montagem'`: o nome do destinatário e, na NFC-e, a descrição do primeiro item em homologação (a montagem os troca pelas literais de teste), os grupos repassados no tipo do schema (`exporta`, `infIntermed`, `cana`, `agropecuario` e afins), as opções da montagem (o `respTec` das opções, o CSC, o QR Code) e os valores calculados. O grupo IBSCBS pronto (`itens[n].impostos.ibsCbs.grupo`) segue `schema` com `origem: 'entrada'`, como antes: é estrutura do leiaute montada pelo integrador, não texto digitado. O campo que já tem ocorrência de outra conferência da entrada não ganha a segunda.

**`signal` nos resolvedores.** `resolverEnvioSemResposta(cliente, nfeAssinada, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta. Compatível.
