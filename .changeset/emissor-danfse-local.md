---
'@sinete/emissor': minor
'@sinete/nfse': minor
'sinete': minor
---

O DANFSe passa a ser gerado localmente, pelo `@sinete/da/nfse`, porque a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026) e responde 404.

Mudança de API no emissor de NFS-e (`@sinete/emissor/nfse`): `pdf(chave)`, que pedia o PDF ao ADN e devolvia `Promise<Uint8Array | undefined>`, virou `pdf(nfse, opcoes?)`, que recebe o XML da NFS-e (o `proc` do desfecho autorizado), gera o DANFSe v2 sem ir à rede e devolve `Promise<Uint8Array>`. Novos: `pdfCancelado(nfse, evento, opcoes?)`, com a marca de cancelada ou substituída pelo evento registrado, e `pdfPorChave(chave, opcoes?)`, que consulta a NFS-e e os eventos de cancelamento na Sefin e gera com a marca (`undefined` se a Sefin não conhece a chave). A opção `da` aceita o módulo `@sinete/da/nfse`, como nos emissores de NF-e e MDF-e.

Remoção no `@sinete/nfse`: o `NfseClient` não tem mais o `obterDanfse`. Quem o chamava gera o DANFSe com `danfse` de `@sinete/da/nfse` a partir do XML da NFS-e.
