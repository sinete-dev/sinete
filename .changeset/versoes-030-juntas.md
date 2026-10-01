---
'@sinete/core': minor
'@sinete/emissor': minor
'@sinete/mdfe': minor
'@sinete/nfe': minor
'@sinete/nfse': minor
'@sinete/rejeicoes': minor
'sinete': minor
'@sinete/cert': patch
'@sinete/cli': patch
'@sinete/da': patch
'@sinete/ibs-cbs': patch
'@sinete/ibs-cbs-dados': patch
'@sinete/schemas': patch
'@sinete/sefaz-sim': patch
'@sinete/transport': patch
'@sinete/validators': patch
---

**Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
