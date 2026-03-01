import { defineConfig } from 'clearify';

export default defineConfig({
  name: 'Data Brain',
  siteUrl: 'https://data-brain-docs.lumitra.co',
  hubProject: {
    description: 'Structured data API with multi-tenant workspaces',
    status: 'active',
    icon: '🗄️',
    tags: ['api', 'database'],
    group: 'Lumitra Infrastructure',
  },
  sections: [
    { label: 'Documentation', docsDir: './docs/public' },
    { label: 'Internal', docsDir: './docs/internal', basePath: '/internal', draft: true },
  ],
  mermaid: {
    strategy: 'client',
  },
});
