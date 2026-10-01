---
'@sinete/emissor': patch
---

O emissor de NF-e registra um aviso (`warn`) no logger quando a nota é montada com alguma alíquota de IBS/CBS informada por quem integra (`comAliquotasInformadas`), fora da tabela oficial do pacote, com a chave, as alíquotas por item e o motivo. A emissão segue normalmente.
