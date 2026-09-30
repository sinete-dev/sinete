---
'@sinete/cert': minor
'@sinete/transport': minor
'@sinete/schemas': minor
'@sinete/ibs-cbs-dados': minor
'@sinete/ibs-cbs': minor
'@sinete/nfe': minor
'@sinete/mdfe': minor
'@sinete/nfse': minor
'@sinete/da': minor
'@sinete/emissor': minor
'@sinete/sefaz-sim': minor
'@sinete/cli': minor
'sinete': minor
---

Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:

| Onde aparece | Antigo | Novo |
|---|---|---|
| desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
| desfecho autorizado ou denegado | `value` | `valor` |
| desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
| desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
| erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
| ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
| `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
| assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
| relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
| resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |

A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.
