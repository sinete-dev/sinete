---
'@sinete/nfe': minor
---

O autorizador sai do documento e da chave, não das opções do cliente. `autorizar` vai à UF do cUF da NF-e assinada; `autorizar`, `consultar`, `cancelar`, `cancelarPorSubstituicao` e `consultarRecibo` com a nota seguem o tpEmis da chave (6 SVC-AN, 7 SVC-RS), seja qual for a contingência de agora; a CC-e vai sempre à UF. Antes, a nota assinada em SVC e retomada depois do fim da contingência ia à UF, e a nota normal enviada por um cliente em contingência ia ao SVC. O fuso dos eventos passa a ser o da UF da chave.

`NfeClientOptions.uf` fica opcional: vale só para os serviços sem documento (status, inutilização, recibo sem a nota, `cUFAutor` padrão da distribuição), que lançam `ConfigError` sem ela. A nota em SVC sai da montagem (`NfeInput.contingencia`), e um cliente atende todas as UFs do certificado.

Quebra: `NfeClientOptions.contingencia` deixa de valer para autorização, consulta e eventos.
