---
'@sinete/emissor': minor
---

A API do emissor depois da migração do primeiro integrador (ADR 0010, decisão 6):

- `aoDecidir` e o novo `jaGuardado` valem por chamada (`OpcoesEmitir`, `OpcoesRetomar`, `OpcoesRetomada`) e ficam opcionais no emissor; sem `aoDecidir` em nenhum lugar, `emitir` e `retomar` lançam `ConfigError` antes de travar.
- `emitir(ref, preparar)`: a entrada pode ser uma função chamada com a trava, só sem bytes gravados, que devolve a entrada e o `meta` gravado com os bytes.
- NF-e e MDF-e aceitam a montagem de um documento: `{ nfe, montagem }` e `{ mdfe, montagem }`, por cima da montagem do emissor.
- `jaGuardado(registro)`: com bytes gravados, o emissor pergunta antes de ir à SEFAZ se o documento já foi guardado; se sim, apaga a gravação e devolve o desfecho novo `ja-guardado`.
- `situacaoPosterior: 'divergente'` devolve o documento cancelado ou encerrado fora do fluxo como `divergente` (com `situacaoAtual` e `proc`) e mantém os bytes.
- `DesfechoPendente.anterior` traz o `cStat` e o `xMotivo` da duplicidade que levou à consulta quando a consulta não decidiu.
- `certificado` (um `CertificadoAberto`: signer, titular e identidade do mTLS) no lugar de `pfx` e `senha`; `abrirCertificado(cert, { completarCadeia })` abre como o emissor abriria. O pool aceita qualquer tipo de certificado com a opção `chave`, e `CertificadoA1` passa a sair de `certificado.ts`.
