---
'@sinete/da': minor
---

Marca os documentos sem valor fiscal em todos os formatos do DANFE e no DAMDFE: "SEM VALOR FISCAL" quando falta o protocolo de autorização na emissão normal (prévia, XML sem protocolo, SVC sem protocolo, EPEC sem o registro do evento) e "DENEGADA", com o motivo da tabela 4.4.3 do MOC e o protocolo de denegação, nos cStat 110, 301, 302 e 303. A contingência com a autorização por vir continua valendo e passa a ser marcada com "EMITIDA EM CONTINGÊNCIA" ("EMISSÃO EM CONTINGÊNCIA" no DAMDFE), e o protocolo só aparece como de autorização quando o cStat é 100 ou 150.
