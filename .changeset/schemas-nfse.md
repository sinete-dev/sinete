---
'@sinete/schemas': minor
---

Novos módulos `nfse/1.01-20260209` e `nfse/1.01-20260727`, gerados dos XSD oficiais da NFS-e Nacional (DPS, NFSe, pedRegEvento e evento) com sha256 conferido, e a família `nfse` na tabela de vigências.

- **Correção do TSSerieDPS.** O XSD de 09/02/2026 declara `^0{0,4}\d{1,5}$`, e em regex de XSD `^` e `$` são literais. A correção vem registrada em `schema.patches`, com o pattern oficial, o usado e o motivo (tipo `SchemaPatch`).
- **Assinatura.** A `ds:Signature` é opaca (`$any`).
- **Classes de caracteres.** O tradutor de regex de XSD passa a aceitar `\S` e `\D` dentro de classe de caracteres positiva.
