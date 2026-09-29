# Documentação do sinete

O sinete emite e lê documentos fiscais eletrônicos brasileiros em TypeScript: Nota Fiscal Eletrônica (NF-e), Nota Fiscal de Consumidor Eletrônica (NFC-e), Manifesto Eletrônico de Documentos Fiscais (MDF-e) e Nota Fiscal de Serviço Eletrônica no padrão nacional (NFS-e Nacional). Oferece assinatura digital de XML no padrão XMLDSig, transporte com autenticação mútua por certificado (mTLS), validação pelos schemas oficiais, geração de documentos auxiliares e cálculo do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS). Os recursos locais funcionam em Node, Bun, Deno e no navegador. No navegador, a transmissão precisa passar por um servidor; no Deno, o transporte nativo tem limitações de compatibilidade TLS com alguns serviços fiscais.

Esta pasta contém a documentação da versão instalada e acompanha os pacotes `sinete` (`node_modules/sinete/docs/`) e `@sinete/emissor` (`node_modules/@sinete/emissor/docs/`). Se houver divergência com informações de outra versão, siga esta documentação. Se houver divergência entre a documentação e os tipos publicados em cada pacote (`dist/*.d.ts`), siga os tipos.

## Comece por aqui

- [Tutorial: primeira NF-e em homologação](tutorial/primeira-nfe.md), o ambiente de testes, com o simulador da Secretaria da Fazenda (SEFAZ), sem certificado real.

## Como fazer

- [Implementar o `TransmissaoStore` num banco SQL e rodar a suíte de contrato](como-fazer/store-sql.md): persistência das transmissões e testes do comportamento exigido pelo emissor
- [Retomar documentos pendentes](como-fazer/retomada.md), manualmente ou com uma tarefa agendada
- [Emitir por vários emitentes no mesmo servidor](como-fazer/varios-emitentes.md): certificado aberto, conjunto reutilizável de emissores (pool), função `aoDecidir` por chamada e entrada preparada
- [Emitir NFC-e](como-fazer/nfce.md): regras do modelo fiscal 65, usado pela NFC-e, QR Code e contingência off-line, com emissão sem conexão e transmissão posterior
- [Emitir em contingência](como-fazer/contingencia.md): NF-e na SEFAZ Virtual de Contingência (SVC), MDF-e e NFC-e off-line, com ativação manual ou automática
- [Cancelar NF-e, MDF-e e NFS-e](como-fazer/cancelamento.md)
- [Emitir a carta de correção](como-fazer/carta-de-correcao.md), para corrigir informações permitidas de uma NF-e autorizada
- [Emitir e encerrar um MDF-e](como-fazer/mdfe.md)
- [Emitir a NFS-e Nacional](como-fazer/nfse.md), com substituição de nota
- [Informar o IBS e a CBS](como-fazer/ibs-cbs.md)
- [Usar no navegador com a transmissão no servidor](como-fazer/browser.md)
- [Usar certificado A3 e chave fora do processo](como-fazer/certificado-a3.md): token pela interface PKCS#11, A3 em nuvem de um Prestador de Serviço de Confiança (PSC), OpenBao e `CryptoKey` não exportável, com o programa auxiliar `sinete-signer`
- [Gerar DANFE, DANFC-e, DAMDFE, DACCe e DANFSe](como-fazer/documentos-auxiliares.md), os documentos auxiliares da NF-e, NFC-e, MDF-e, carta de correção eletrônica e NFS-e, respectivamente
- [Tratar as ocorrências de validação](como-fazer/ocorrencias-de-validacao.md)

## Por quê

- [Por que gravar os bytes assinados antes do envio](explicacao/bytes-antes-do-envio.md)
- [Por que o emissor exige um `store` com trava](explicacao/store-e-trava.md), para persistir transmissões e impedir operações simultâneas sobre o mesmo documento
- [Por que o autorizador sai do documento e da chave](explicacao/autorizador-pela-chave.md), determinando qual serviço fiscal recebe o envio
- [Por que assinar a string final e nunca mais tocar nela](explicacao/assinatura-por-splice.md)
- [Como os pacotes se dividem](explicacao/divisao-de-pacotes.md)

## Referência

- [Pacotes e entradas](referencia/index.md): cada nome exportado, com referência gerada a partir dos tipos publicados.
- [Códigos de erro](erros/index.md): uma página por código (`code`), com causa, correção e armadilha. Os erros derivados de `SineteError`, a classe base de erros do sinete, trazem na propriedade `docs` o caminho `erros/<code>.md`, relativo à pasta `docs/` do pacote instalado.

## Para agentes de código

- [Bloco do `AGENTS.md`](bloco-agents.md): regras e índice curto para o `AGENTS.md` do seu projeto. `npx sinete agents-md` insere ou atualiza o bloco entre os marcadores sem tocar no restante do arquivo e cria o `CLAUDE.md` com `@AGENTS.md` se ele não existir.
- [Skill do `sinete`](skill-sinete.md): o `SKILL.md` que `npx sinete agents-md` instala em `.claude/skills/sinete/` (Claude Code) e `.agents/skills/sinete/` (Codex e outras ferramentas do padrão Agent Skills). É um complemento do bloco para quem trabalha com skills: só manda ler esta documentação, sem repeti-la. Uma skill `sinete` sem a linha `<!-- sinete-skill: ... -->` é tratada como sua e não é tocada; `--sem-skill` não instala nem atualiza.
