import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
  site: 'https://sinete.vercel.app', // domínio temporário; sinete.fazer.ai quando o DNS existir
  integrations: [
    starlight({
      title: 'sinete',
      description: 'DF-e brasileiros em TypeScript: NF-e, NFC-e, MDF-e e NFS-e Nacional.',
      defaultLocale: 'root',
      locales: { root: { label: 'Português', lang: 'pt-BR' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/sinete-dev/sinete' }],
      sidebar: [
        { label: 'Comece aqui', items: ['guia', { autogenerate: { directory: 'tutorial' } }] },
        { label: 'Como fazer', items: [{ autogenerate: { directory: 'como-fazer' } }] },
        { label: 'Explicação', items: [{ autogenerate: { directory: 'explicacao' } }] },
        { label: 'Referência', items: [{ autogenerate: { directory: 'referencia' } }] },
        { label: 'Erros', items: [{ autogenerate: { directory: 'erros' } }] },
      ],
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: 'sinete',
          description:
            'DF-e brasileiros em TypeScript (NF-e, NFC-e, MDF-e e NFS-e Nacional). Documentação em português do Brasil.',
          customSets: [
            {
              label: 'Tutorial',
              paths: ['guia', 'tutorial/**'],
              description: 'primeira NF-e em homologação, passo a passo',
            },
            { label: 'Como fazer', paths: ['como-fazer/**'], description: 'receitas para tarefas específicas' },
            { label: 'Explicação', paths: ['explicacao/**'], description: 'por que o sinete foi desenhado assim' },
            {
              label: 'Referência',
              paths: ['referencia/**'],
              description: 'API de cada pacote, gerada dos tipos publicados',
            },
            {
              label: 'Erros',
              paths: ['erros/**'],
              description: 'um código de erro por página: causa, correção e armadilha',
            },
          ],
        }),
      ],
    }),
  ],
});
