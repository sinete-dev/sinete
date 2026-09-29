// GERADO por scripts/docs-gerados.ts a partir de docs/guia/skill-sinete.md. Não edite: rode `bun scripts/docs-gerados.ts`.
/** O `SKILL.md` da skill `sinete` que o `sinete agents-md` grava no projeto do integrador. */
export const SKILL_SINETE: string = `---
name: sinete
description: Use quando o trabalho envolver emitir, consultar ou cancelar NF-e, NFC-e, MDF-e ou NFS-e, calcular IBS e CBS, gerar DANFE ou outro documento auxiliar, ou mexer no pacote sinete ou nos pacotes @sinete/*. A API muda entre versões e o domínio fiscal é pouco coberto no treino, então leia a documentação da versão instalada antes de escrever código.
---

<!-- sinete-skill: gerada por \`npx sinete agents-md\`; apague esta linha para manter a sua versão, e o comando deixa de atualizá-la -->
# sinete: leia a documentação da versão instalada

Esta skill não traz a documentação: ela aponta para a que acompanha o pacote instalado, que é a única certa para a versão em uso. O que você lembra do sinete, da SEFAZ ou de NT e MOC pode estar errado ou desatualizado.

Antes de escrever ou alterar código que use \`sinete\` ou \`@sinete/*\`:

1. Leia \`node_modules/sinete/docs/index.md\` (ou \`node_modules/@sinete/emissor/docs/index.md\` se só o emissor estiver instalado) e siga o link da página que a tarefa pede: tutorial, como fazer, explicação, referência ou o código de erro em questão.
2. Leia \`node_modules/sinete/docs/bloco-agents.md\`: as regras que evitam nota duplicada (emitir, retomar e cancelar pelo emissor, nunca remontar documento assinado) e o índice dos pacotes e verbos.
3. Confira nomes e assinaturas nos \`.d.ts\` de \`node_modules/@sinete/*/dist/\`, que são a palavra final. Não invente campo, método nem código de erro.
4. Se o pacote não estiver em \`node_modules\`, instale-o antes. Não escreva a partir da memória.
`;
