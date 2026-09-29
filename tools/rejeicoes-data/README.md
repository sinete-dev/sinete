# tools/rejeicoes-data

Gera `packages/rejeicoes/src/data/rejeicoes.json` a partir dos PDFs oficiais listados em `sources.json` e da curadoria em `curadoria.json`. Workspace privado, nunca publicado.

## Uso

Catálogo do MDF-e (`packages/rejeicoes/src/data/rejeicoes-mdfe.json`), a partir de `sources-mdfe.json` e `curadoria-mdfe.json`:

```sh
bun tools/rejeicoes-data/mdfe.ts --pdf-dir <dir>               # grava o JSON do MDF-e
bun tools/rejeicoes-data/mdfe.ts --pdf-dir <dir> --check       # só confere
```

O MOC do MDF-e não tem tabela de rejeições: o builder lê as regras de validação (`<regra> ... Obrig.|Facult. <código> Rej. Rejeição: <mensagem>`) do Anexo I, da Visão Geral e das NT, reconstitui a mensagem pela coluna (inclusive quando ela começa acima da linha do código, F95 a F98, e quando a frase continua depois de uma linha só com a descrição da regra, F94) e junta os marcadores partidos pela quebra de linha (`[nPro t:9999 99999999999]`). A mensagem do 678, que as regras de consumo indevido não trazem, vem de `mensagens` na curadoria com a citação do item 8 da Visão Geral.

Catálogo da NF-e:

```sh
# PDFs baixados do Portal da NF-e (Manuais e Notas Técnicas), com os nomes de sources.json
bun tools/rejeicoes-data/build.ts --pdf-dir <dir>              # grava o JSON
bun tools/rejeicoes-data/build.ts --pdf-dir <dir> --check      # só confere se o JSON versionado é o gerado
bun tools/rejeicoes-data/build.ts --pdf-dir <dir> --compare-csv <catalogo.csv>   # diferença de códigos contra outro catálogo
```

Requer `pdftotext` (poppler). O builder confere o sha256 de cada PDF antes de extrair: PDF diferente do registrado falha, e trocar de versão de documento é mudar `sources.json` (URL, versão, sha256) no mesmo commit que o JSON gerado.

## Método

A tabela 4.4.2 do Anexo I não é exaustiva, então o catálogo é a união de quatro leituras:

1. **Anexo I, tabelas 4.4.2 e 4.4.3**: código e mensagem oficial, juntando as linhas de continuação. É a mensagem que vale quando o código está na tabela. A tabela repete alguns códigos com mensagens diferentes; todas ficam em `messages`.
2. **Anexo I, regras de validação (item 4)**: cada linha `<regra> <modelo> ... Obrig.|Facul. <código> Rej.|Den. Rejeição: ...` dá o id da regra e os modelos. Códigos que só existem aqui (108, 109, 491, 492, 493, 764, 776) entram com a mensagem da regra.
3. **NT 2025.002, itens 7 e 8**: o mesmo formato sem a coluna de efeito. A mensagem quebra em várias linhas na coluna "Descrição Erro" e é reconstituída pela posição da coluna, atravessando quebra de página; quando o "Rejeição:" fica numa linha acima do código (regra I08-141), o builder busca até 3 linhas acima.
4. **NT 2025.001 (item 90.1) e NT 2023.002 (item 7), tabelas de mensagens**: só os códigos que as três leituras acima não trazem (QR Code versão 3 e lote de NFC-e, por exemplo), com a mensagem da tabela e o id e os modelos da regra de validação da própria NT. Cada documento declara em `sources.json` (`mensagens`) o título da tabela e o trecho das regras.

Linha só com id (célula de id em duas linhas, como B32-10/BB02-10) não encerra a mensagem; lista de valores (`1=União`), `Observação`, `Nota:` e `Exceção` na coluna da descrição encerram.

O id da regra vem da própria linha ou de até 2 linhas acima, nunca herdado de outra regra.

## Conferência

Contra o catálogo que o integrador em produção usava antes (810 códigos, mesma base documental): nenhum código dele falta aqui; entram 4 a mais (459, 460, 960 e 966, citados na NT 2025.002 e ausentes da tabela 4.4.2). As mensagens da NT, que lá vinham cortadas na primeira linha, aqui vêm completas.

## Códigos de outras NT (`adicionais`)

O builder não lê NT inteiras além da 2025.002. Um código de outra NT entra por `adicionais` na curadoria, com a mensagem, a regra, os modelos e o documento, que precisa estar em `sources.json` (sha256 conferido). O builder confere que a linha da regra, com o código, existe no texto do PDF, e recusa código que já está no catálogo. Entraram assim o 853 (NT 2025.001 v1.03, RV Y09-40) e o 836 (NT 2024.003 v1.10, RV ZF05-10), que apareceram em rejeições reais de um integrador em produção.

## Checagem de corte

Antes de gravar, o builder recusa (sai com 1) mensagem que termina em artigo, preposição ou conjunção, que tem parêntese ou colchete sem fechar, ou que deixou para trás, na coluna da descrição e nas 3 linhas seguintes do mesmo bloco, texto começando em minúscula (continuação de frase). Casos que estão assim no PDF oficial ficam em `sanityAllow` da curadoria, com a justificativa. A checagem foi validada reintroduzindo o bug do 1008, que ela aponta.

## Curadoria

`curadoria.json` tem, por código, `causaProvavel`, `comoCorrigir` e `referencia` (a regra de onde a explicação saiu), e opcionalmente `category` para corrigir a heurística. Redação própria a partir do MOC e das NT; nada de texto de terceiros. O builder falha se a curadoria citar um código fora do catálogo.

## NFS-e Nacional (`nfse.ts`)

Gera `packages/rejeicoes/src/data/nfse-erros.json` (o subpath `@sinete/rejeicoes/nfse`) a partir das planilhas oficiais listadas em `sources-nfse.json` e da curadoria em `curadoria-nfse.json`.

```sh
# planilhas baixadas da Documentação Atual do Portal NFS-e, com os nomes de sources-nfse.json
bun tools/rejeicoes-data/nfse.ts --xlsx-dir <dir>            # grava o JSON
bun tools/rejeicoes-data/nfse.ts --xlsx-dir <dir> --check    # só confere se o JSON versionado é o gerado
```

Requer `unzip`. O sha256 de cada planilha é conferido antes da leitura; as planilhas não entram no repositório. O xlsx é lido como o zip de XML que é (workbook, relações, sharedStrings e a aba), com o parser do `@sinete/core/xml`; o texto fonético (`rPh`) das strings compartilhadas é ignorado.

Abas lidas: no Anexo I, `RN_RECEPCAO_DPS` (certificado de transmissão e área de dados: código na coluna F, mensagem na G) e `RN DPS_NFS-e`; no Anexo II, `RN EVENTO_PED.REG.EVENTO`. Nas duas últimas, o caminho do campo vem das colunas B e C, e a linha sem B e C continua o campo da anterior; código na H, mensagem na I, nível na J. Todo código tem de casar `E\d{4}`, senão o builder falha.

Achados nas planilhas de 2026: E1570 aparece com duas mensagens (IBS municipal e CBS), e ficam as duas em `mensagens`; E1260 e outros dois códigos aparecem nos dois anexos; três regras do Anexo I (E0675, E0676, E0677) trazem "Obrig." na coluna de efeito em vez de "Rej.", e o builder as trata como rejeição e lista no log. A categoria é heurística (aba, caminho `Signature`, nível 3, caminho IBS/CBS, só no Anexo II, mensagem de duplicidade), corrigida na curadoria quando precisa (E1235 é schema; E1967 e E1978 são evento, não duplicidade).
