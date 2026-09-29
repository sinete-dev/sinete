---
'@sinete/emissor': patch
---

A barreira da recusa repetida compara o conteúdo da nota, não os bytes: sai da comparação o que muda sozinho entre duas montagens (hora de emissão e de saída, código numérico e dígito da chave, assinatura, grupo suplementar), por `PerfilDocumento.conteudoParaRecusa`. Quem remonta a nota a cada tentativa com a hora de agora também é barrado; a nota corrigida continua passando. A recusa que se corrige num desses campos (toda mensagem do catálogo que fala de data, prazo, chave, assinatura, certificado, QR Code ou CSRT; `campoVolatil` na tabela do emissor) continua comparada pelos bytes.
