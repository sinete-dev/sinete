# @sinete/schemas

## 0.1.0

### Minor Changes

- 515861a: Novo módulo `nfe/evento-cancelamento-substituicao/PL_010d`: o evento 110112 (cancelamento por substituição da NFC-e) com o `detEvento` do e110112_v1.00.xsd oficial (Evento_CancSubst_v1.01, NT 2018.004) ligado ao envelope genérico do PL_010d, e a família `nfe/evento-cancelamento-substituicao` na tabela de vigências.
- 515861a: Primeira versão: módulos gerados dos XSD oficiais (NF-e PL_010f e PL_010e, MDF-e 3.00b, eventos, inutilização, consultas, status do serviço e distribuição de DF-e) com serializer canônico, decoder tolerante, validador estrito e tabela de vigências que escolhe o PL por data e ambiente.
- 515861a: MDF-e 3.00b: `retMDFe` (retorno da recepção síncrona) no `mdfe/3.00b` e dois módulos novos do mesmo pacote de liberação, `mdfe/eventos/3.00b` (`eventoMDFe`, `retEventoMDFe` e `procEventoMDFe`, com o `detEvento` ligado aos sete schemas de evento) e `mdfe/servicos/3.00b` (status, consulta situação e consulta não encerrados), com vigência na tabela.
- 515861a: Novos módulos `nfse/1.01-20260209` e `nfse/1.01-20260727`, gerados dos XSD oficiais da NFS-e Nacional (DPS, NFSe, pedRegEvento e evento) com sha256 conferido, e a família `nfse` na tabela de vigências.
  
  - **Correção do TSSerieDPS.** O XSD de 09/02/2026 declara `^0{0,4}\d{1,5}$`, e em regex de XSD `^` e `$` são literais. A correção vem registrada em `schema.patches`, com o pattern oficial, o usado e o motivo (tipo `SchemaPatch`).
  - **Assinatura.** A `ds:Signature` é opaca (`$any`).
  - **Classes de caracteres.** O tradutor de regex de XSD passa a aceitar `\S` e `\D` dentro de classe de caracteres positiva.

### Patch Changes

- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
