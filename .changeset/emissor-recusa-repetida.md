---
'@sinete/emissor': minor
'sinete': patch
---

Barreira da recusa repetida (ADR 0012): com um `TransmissaoStore` que implementa os novos métodos opcionais `registrarRecusa` e `recusaRecente`, o emissor lembra o SHA-256 dos bytes descartados por uma recusa da SEFAZ e lança `RecusaRepetidaError` (`recusa_repetida`), antes de gravar e sem ir à SEFAZ, quando a mesma `ref` montaria os mesmos bytes dentro da janela (1 hora por padrão, `recusaRepetida: { janelaMs }` ou `false`). Evita o bloqueio por consumo indevido (rejeição 656). A nota corrigida e a retomada de bytes gravados nunca são barradas; a recusa do serviço (108, 109, 999) não conta; `emitir(ref, entrada, { reenviarRecusado: true })` envia depois de uma correção fora da nota. O store em memória implementa os dois métodos; store com um só lança `ConfigError`. A suíte de contrato ganha três casos, incluídos por padrão: o adaptador sem os métodos passa `recusas: false`. `PerfilDocumento` ganha `transitorio` opcional.

O emissor da NF-e confere o certificado antes de assinar: sem CNPJ nem CPF, `ConfigError` (rejeição 282); emitente de outro CNPJ-base ou CPF, `ValidationError` com `emitente_difere_do_certificado` (213, 227).
