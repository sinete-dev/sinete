# @sinete/da

## 0.1.0

### Minor Changes

- 515861a: O `cancelado` do `damdfe` aceita o `procEventoMDFe` do cancelamento (110111), lido pelo schema de eventos do MDF-e: o protocolo e a data do evento vão ao carimbo, como o `procEventoNFe` no `cancelamento` do `danfe`. Evento de outro MDF-e, de outro tipo ou sem retorno registrado (135, 134 ou 136) é `evento_incompativel`. O objeto `{ nProt, dhRegEvento }` e o `true` continuam valendo, com a mesma saída.
- 515861a: Primeira versão do `@sinete/da` (documentos auxiliares), com um subpath por documento (`/nfe`, `/nfce`, `/mdfe`, `/cce`) e o comum na raiz: DANFE retrato e paisagem (com canhoto, fatura, ISSQN, quadro de IBS/CBS/IS, contingência FS-DA e EPEC), DANFE Simplificado, Etiqueta e Simplificado Tipo 2, DANFE NFC-e, DACCE e DAMDFE, a partir do XML autorizado lido pelo `@sinete/schemas`, em PDF determinístico e HTML/SVG, com logotipo PNG/JPEG, marcas de homologação, contingência e cancelamento, CODE-128C e QR Code próprios.
- 515861a: Marca os documentos sem valor fiscal em todos os formatos do DANFE e no DAMDFE: "SEM VALOR FISCAL" quando falta o protocolo de autorização na emissão normal (prévia, XML sem protocolo, SVC sem protocolo, EPEC sem o registro do evento) e "DENEGADA", com o motivo da tabela 4.4.3 do MOC e o protocolo de denegação, nos cStat 110, 301, 302 e 303. A contingência com a autorização por vir continua valendo e passa a ser marcada com "EMITIDA EM CONTINGÊNCIA" ("EMISSÃO EM CONTINGÊNCIA" no DAMDFE), e o protocolo só aparece como de autorização quando o cStat é 100 ou 150.
- 515861a: Novo subpath `@sinete/da/nfse` (e `sinete/da/nfse`): `danfse` gera o DANFSe v2 da NFS-e Nacional pela NT SE/CGNFS-e 008/2026 v1.02, em PDF e HTML, a partir do `NFSe` autorizado nos pacotes de esquemas 1.01 de 20260209 e de 20260727. A4 retrato numa página só, QR Code da consulta pública com a chave, "NFS-e SEM VALIDADE JURÍDICA" em produção restrita e marcas d'água de cancelada e substituída pelo evento registrado (`cancelamento`, `substituicao`) ou por `true`; canhoto opcional e `nomeMunicipio` para os endereços. O `TextOp` do modelo ganha `rgb`, opcional, para o texto em cor que a NT pede; os outros documentos não mudam.

### Patch Changes

- 515861a: A NF-e e a NFC-e cujo `protNFe` traz cStat de cancelamento (101, 151 ou o 155 do evento fora de prazo), como gravam os sistemas que importam a nota, saem com o carimbo "CANCELADA" e o número do protocolo no campo do protocolo de autorização, e não mais como "SEM VALOR FISCAL". O `procEventoNFe` de cancelamento, quando passado, continua prevalecendo no carimbo, com o protocolo do evento. No DAMDFE, o `protMDFe` com cStat 101 sai "CANCELADO" e o 132 (encerrado) sai como autorizado, com o protocolo e sem marca.
- 515861a: DANFE NFC-e e DANFE Simplificado Tipo 2 de emitente pessoa física: o cabeçalho diz "CPF:" no lugar de "CNPJ:" (Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, 3.1.1). A saída com emitente CNPJ não muda.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
  - @sinete/schemas@0.1.0
