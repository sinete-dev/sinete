---
"@sinete/transport": minor
"sinete": minor
---

Opção `antesDeConectar` no transporte de Node e Bun (`TransporteNodeOpcoes`, entrada `node`): um gancho síncrono chamado a cada conexão nova, dentro do `createConnection` do Agent do próprio transporte, depois da política e de toda a preparação assíncrona e imediatamente antes de abrir o socket. Se ele lançar, nada vai para a rede e o `enviar` rejeita com o mesmo valor lançado, sem reclassificação. Um socket reaproveitado do pool (`manterConexao: true`, o padrão) não chama o gancho. Com a identidade `helper` a criação lança `ErroDeConfiguracao`, e no Deno o `criarTransporte` lança `ErroNaoSuportado`, em vez de ignorar a opção. O transporte continua sem aceitar `https.Agent` de fora.
