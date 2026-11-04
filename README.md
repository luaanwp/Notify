# Notify

Monitor de oportunidades da equipe CartAI. Primeira entrega: cadastro manual, favoritos, busca, participação interna, etapas com evidência, próximos prazos e histórico. Interface em português e responsiva.

## Executar

Requer Node 22.12+ ou 24.

```sh
npm install
npm run dev
npm test
npm run build
```

Sem `.env`, funciona em **modo local**, com dados somente neste navegador. Não contém oportunidades fictícias, sincronização ou coleta automática. Faça exportação em Configurações antes de limpar os dados do navegador.

## Conectar Supabase

1. Criar projeto gratuito e executar `supabase/migrations/202611040001_base.sql` no editor SQL.
2. Ativar Google no Auth e configurar as URLs de redirecionamento local e de produção.
3. Copiar `.env.example` para `.env`, preenchendo URL e chave pública anon. Nunca usar service role no frontend.
4. Após o primeiro login, criar workspace e membership pelo editor SQL, com UUID real do usuário em Auth > Users:

```sql
insert into public.workspaces(name) values ('CartAI') returning id;
insert into public.memberships(workspace_id,user_id,role)
values ('UUID_DO_WORKSPACE','UUID_DO_USUARIO','admin');
```

O login não concede acesso sem membership. O aplicativo seleciona a primeira equipe autorizada nesta versão. Leitores podem consultar; gravações exigem admin/editor. Auditoria de escrita é transacional no servidor. Os dados locais não são importados automaticamente para o Supabase.

## Publicar

Cloudflare Pages: comando `npm run build`, diretório `dist`. Configurar as duas variáveis públicas do `.env.example` no ambiente de build. Sem serviços pagos obrigatórios.

## Escopo e pendências

O banco usa um payload JSON por evento nesta primeira entrega, com isolamento por equipe. A normalização das fontes, versões, observações e etapas pertence à próxima entrega. Migração e autenticação foram preparadas, mas precisam ser validadas em um projeto Supabase real, incluindo isolamento entre duas equipes. Atualizações simultâneas ainda podem sobrescrever alterações: controlar versão antes do piloto compartilhado.

Coletor HTML/PDF, proteção SSRF, workflow periódico, Gemini, pedidos de atualização, revisões, Telegram e lembretes não estão implementados. Nenhum monitoramento foi ativado. O plano completo está em [docs/PLANO.md](docs/PLANO.md).

## Convenções

Regras de colaboração e design em [AGENTS.md](AGENTS.md); tokens em [DESIGN.md](DESIGN.md); contexto e decisões em [PRODUCT.md](PRODUCT.md). Skills locais preservam os arquivos fornecidos pelo usuário; seus arquivos de apoio não foram fornecidos.
