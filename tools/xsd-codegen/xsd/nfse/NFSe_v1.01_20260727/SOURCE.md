# NFSe_v1.01_20260727

Pacote oficial, artefato público do governo, sem alterações. Os arquivos abaixo são o conteúdo do zip, byte a byte.

- Título na fonte: NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20260727 (Documentação Técnica de homologação/testes, "layout com grupos IBSCBS")
- Publicação: 27/07/2026 (notícia "Plataforma NFS-e disponibiliza novas evoluções em Produção Restrita e divulga cronograma de implantação", de 28/07/2026: schemas atualizados para o CNPJ alfanumérico, em produção restrita desde 27/07/2026 e em produção a partir de 10/08/2026)
- Página de origem: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita (atualizada em 28/07/2026)
- Notícia do cronograma: https://www.gov.br/nfse/pt-br/noticias/plataforma-nfs-e-disponibiliza-novas-evolucoes-em-producao-restrita-e-divulga-cronograma-de-implantacao
- Download: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas-nfse-rtc-v1-01-20260727.zip
- Arquivo baixado: `esquemas-nfse-rtc-v1-01-20260727.zip` (sha256 `6c7e0510d3ecff4454f291f4e10b742d27a4818f23aab181494f96d0ea79f3dc`)
- Baixado em: 2026-09-26
- Uso no sinete: DPS, NFSe, pedRegEvento e evento do leiaute 1.01 com CNPJ alfanumérico. Diferenças para o 20260209 (fora fim de linha e BOM): patterns de CNPJ, chave e Id com `[0-9A-Z]`, `TSSerieDPS` corrigido para `[0-9]{1,4}|[0-8][0-9]{4}`, um pattern de data e hora sem vírgula na classe e um pattern que proíbe texto só com espaços.

## sha256 dos arquivos extraídos

```
26961f705970ccb1dede1b6bb0ab544ca1d089137c22e93371d789c1e15ef0c4  CNC_v1.00.xsd
c7dab363d8cf7c83fc2b3b21e72cf669a51bd30947a5690685ea96c4b3e39dcd  DPS_v1.01.xsd
dd14062174d439a67a11266d82e822cb9021db1595a41bd876a16560a38f6aec  evento_v1.01.xsd
1dd8f543060a4ba6f355693f1fa5d79a269acae7c3dfe42d621f62911cfebac0  NFSe_v1.01.xsd
186c83f33752a195845300af61ffbe7136547f84cab032b35238c78f9d78f7c6  pedRegEvento_v1.01.xsd
c1cc33f1007251075b1fff7766bf881bba6a8ad7f1f36d149e54ae98090c77f8  tiposCnc_v1.00.xsd
6f792f408a33c11e799042a8d61cac7d1c9f5992c53e07e60ce75a15f157d1ac  tiposComplexos_v1.01.xsd
6c9ae744b1cb886607c1138c32eeb76cd410b856ce7301197b95d48d63f7b40b  tiposEventos_v1.01.xsd
3d8171c9b7c9a82ecb48eed9a96485f2077006e7d21db6cd182839dd34dbb5e4  tiposSimples_v1.01.xsd
bf43998b2df1fedd9ed7d6914f91ab4d34958e8730c3b500cbe0b21e60335f11  xmldsig-core-schema.xsd
```
