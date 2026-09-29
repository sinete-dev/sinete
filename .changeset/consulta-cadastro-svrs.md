---
'@sinete/transport': patch
---

A consulta cadastro de toda UF autorizada pela SVRS volta a ir para a SVRS. O `nfeEndpoint` recusava as UFs fora da linha de consulta cadastro do portal (DF, CE e outras), mas o serviço da SVRS responde por elas: em produção respondeu consultas do DF com 259 e 264. A UF que a SVRS não atender responde com a rejeição dela, como desfecho.
