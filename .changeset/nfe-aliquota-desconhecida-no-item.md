---
'@sinete/nfe': minor
'sinete': minor
---

**Quebra: alíquota de IBS/CBS desconhecida sai uma vez, no caminho do item.** Quando a calculadora padrão (`calculadoraIbsCbs`) não tem a alíquota da data do fato gerador (a CBS de 2027 antes da resolução do Senado, qualquer alíquota de 2029 em diante), o `montarNfe` devolvia a causa com o caminho da nota e, além dela, uma `ibscbs_calculo` por item classificado. Agora devolve uma ocorrência só. O `code` e a `origem` não mudam. Quem compara `caminho` ou conta ocorrências precisa conferir estes casos:

| Ocorrência | Antes | Agora |
|---|---|---|
| alíquota desconhecida na data (`ibscbs_aliquota_desconhecida`, `origem: 'montagem'`) | `caminho: 'impostos.ibsCbs'` | `caminho: 'itens[n].impostos.ibsCbs'`, o primeiro item (pela ordem da nota) que precisa da alíquota; o item sem `gIBSCBS` (CST 410, por exemplo) não pede alíquota e é pulado |
| grupo IBSCBS ausente depois de uma recusa explicada da calculadora (`ibscbs_calculo`, `origem: 'montagem'`, `itens[n].impostos.ibsCbs`) | uma por item classificado, depois da causa | não sai: a ocorrência da calculadora já diz a causa |

Com N itens classificados, a nota recusada por alíquota desconhecida passa de 1 + N ocorrências para 1. O mesmo vale para as outras recusas da calculadora (`ibscbs_base_ausente`, `ibscbs_classificacao_invalida`, `ibscbs_nao_suportado`, calculadora própria que devolve `ocorrencias`): a `ibscbs_calculo` só sai quando a calculadora omite um item sem devolver nenhuma ocorrência.

**Novo: a nota montada diz quais alíquotas vieram de quem integra.** `NfeMontada.aliquotasInformadas` lista, por item, o tributo, o valor e o motivo de cada alíquota do IBS/CBS que veio de `comAliquotasInformadas` em vez da tabela oficial do pacote; ausente quando todas foram oficiais. A montagem continua sem recusar a alíquota informada, em qualquer ambiente (ADR 0007, seção "Alíquotas"): é o caminho para emitir com uma alíquota já publicada que o pacote ainda não traz. A porta `CalculadoraIbsCbs` ganha o campo opcional `RespostaIbsCbs.aliquotasInformadas`, e o tipo `AliquotaIbsCbsInformada` é exportado. Calculadora própria que não o preencher continua funcionando.
