---
'@sinete/mdfe': patch
---

`MdfeClient.autorizar` confere o `tpAmb` do MDF-e assinado contra o ambiente do cliente e recusa com `PolicyError` (`politica_recusou`, com `tpAmb` e `esperado` nos detalhes) antes do envio. O MDF-e vai em GZip e Base64, onde a `allowlistPolicy` do transporte não enxerga o `tpAmb`; sem a conferência, um MDF-e de produção podia ir à homologação, ou o contrário, sem a trava que a NF-e tem.
