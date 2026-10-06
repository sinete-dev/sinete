---
"@sinete/mdfe": minor
"@sinete/sefaz-sim": minor
"sinete": minor
---

MDF-e transportado no modal aquaviário (`infMDFeTransp`). `DadosMdfeAquaviario` aceita `descarregamentos[].mdfe` (`MdfeTransportado`: chave, `indReentrega`, `unidadesTransporte` no tipo `TUnidadeTransp` do leiaute e `perigosos`), e o `tot` ganha `qMDFe` pela contagem. `CamposMdfe` passa a ter um parâmetro de tipo para o descarregamento (`CamposMdfe<D extends Descarregamento = Descarregamento>`, com `DescarregamentoAquaviario` no aquaviário); quem usa `CamposMdfe` sem parâmetro não muda. O município que só tem MDF-e transportado deixa de ser recusado pela F26 (616), como o texto oficial da 616 já previa.

O montador confere F43 (647, só no aquaviário, inclusive para quem passa `mdfe` sem tipos em outro modal), F44 (648, carregamento ou descarregamento no AM ou no AP), F45 (649, chave de MDF-e com DV e modelo 58) e F45a (520, chave anterior a 6 meses, NT 2024.001), com `origem: 'entrada'` e o caminho `descarregamentos[i].mdfe[j]`. `rotuloDoCaminho` rotula esses caminhos como os da NF-e e do CT-e (`Documento 1 do descarregamento 1, Chave de acesso`).

O simulador confere F45 (649), F45a (520), F46 (655, MDF-e referenciado que ele não autorizou), F48 (657, cancelado) e F49 (658, modal que não é o rodoviário). Um teste que referenciava uma chave inventada e esperava 100 passa a receber 655.
