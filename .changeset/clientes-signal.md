---
'@sinete/nfe': minor
'@sinete/mdfe': minor
'sinete': minor
---

`NfeClient` e `MdfeClient` aceitam `signal` em todo método que vai à rede, no padrão do `NfseClient`. Na NF-e, `consultar`, `cancelar`, `cancelarPorSubstituicao`, `cartaCorrecao`, `manifestar`, `inutilizar` e `consultarCadastro` ganham `opcoes?: OpcoesEnvio` no fim, e `statusServico` (`StatusServicoOpcoes`) e `distribuicaoDFe` recebem o `signal` no objeto de opções que já tinham. No MDF-e, `statusServico`, `consultar`, `consultarNaoEncerrados` e os eventos ganham `opcoes?: OpcoesEnvio`, e `AutorizarOpcoes` passa a ser o mesmo tipo. Os dois pacotes exportam `OpcoesEnvio`. A mudança é compatível: o parâmetro novo é opcional.
