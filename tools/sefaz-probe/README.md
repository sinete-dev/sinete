# tools/sefaz-probe

Sondagem periódica dos autorizadores: status de serviço, perfil TLS e cadeia por host; abre PR quando algo muda nos dados de `@sinete/transport`.

## Decisões que valem aqui

- ADR 0004. Workspace privado, roda no CI agendado.
- Referência: `spikes/s2-tls/`.

## Status

Vazio. Só este README existe para marcar o lugar e o escopo. Ferramentas de `tools/` são workspaces privados: rodam no Bun, podem usar Node e console (override do Biome) e não são publicadas.
