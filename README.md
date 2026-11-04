# Notify

Monitor de oportunidades da equipe CartAI. React + Vite + TypeScript, Supabase e coletor Node.js. Orçamento autorizado: R$ 0/mês. Nada foi implantado ou habilitado automaticamente.

## Executar localmente

Requer Node **24**, mesma versão do coletor e dos testes.

```sh
npm ci
npm run dev
npm test
npm run test:ui
npm run check:design
npm run build
```

Para testes de interface, instalar Chromium uma vez com `npx playwright install chromium`. Os testes usam navegador isolado; não alteram os dados do usuário.

Sem `.env`, funciona em **modo local**: cadastros, favoritos, busca, participação interna, etapas com evidência e próximos prazos. Os dados ficam neste navegador, sem coleta em segundo plano ou sincronização. Configurações permite exportar JSON. Um arquivo local inválido é preservado e bloqueia gravações.

## Conectar Supabase

1. Criar projeto gratuito. Executar as duas migrações de `supabase/migrations/`, em ordem, no editor SQL. Se a primeira já foi aplicada, executar somente a segunda.
2. Ativar Google em Auth e configurar URLs de redirecionamento local e de produção.
3. Copiar `.env.example` para `.env`, preenchendo URL e chave pública anon. **Nunca usar service role no frontend.** Reiniciar Vite após configurar o arquivo.
4. Fazer o primeiro login e criar equipe com membership pelo editor SQL, usando o UUID de Auth > Users:

```sql
insert into public.workspaces(name) values ('CartAI') returning id;
insert into public.memberships(workspace_id,user_id,role)
values ('UUID_DO_WORKSPACE','UUID_DO_USUARIO','admin');
```

Login sem membership não concede acesso. Papéis: `admin`, `editor`, `reader`. A interface usa a primeira equipe autorizada nesta versão. Gravações exigem admin/editor, são auditadas na mesma transação e verificam revisão para impedir sobrescrita silenciosa. Os dados locais não são importados automaticamente para o Supabase.

## Coletar fontes

Na oportunidade, cadastrar até três links oficiais em **Fontes e evidências**. Conferir organização e edição antes de cadastrar, principalmente PDFs. A consulta não começa ao cadastrar: o próximo lote atende a fila.

No GitHub, adicionar Secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente ao coletor. Configurar a variável de repositório `MONITOR_ENABLED=true` somente depois de conferir limites gratuitos da conta. O workflow está desativado por padrão, inclusive no acionamento manual.

O workflow consulta até 20 fontes por execução, em sequência, às 00:17, 06:17, 12:17 e 18:17 UTC. Atrasos do GitHub podem ocorrer. O administrador pode usar Actions > Consultar fontes oficiais > Run workflow. O botão do site solicita consulta na próxima rodada; não dispara GitHub nem promete atualização imediata. Pedidos repetidos têm intervalo mínimo de uma hora por fonte.

Para executar fora do Actions, fornecer os mesmos dois Secrets como variáveis de ambiente e rodar `npm run collect`. Não adicionar chaves a arquivos versionados.

O coletor:

- Usa HTTP simples, bloqueia destinos privados/reservados e verifica todos os IPs do DNS. Fixa o IP da conexão e revalida redirecionamentos; não usa navegador nesta entrega.
- Limita cada resposta a 2 MB, rede a 15 segundos, PDF a 40 páginas e extração em worker a 10 segundos/128 MB. Aceita HTML, texto e PDF textual.
- Extrai conteúdo principal e links PDF do mesmo domínio. Links são candidatos; documentos adicionais exigem cadastro explícito. Não percorre links automaticamente.
- Compara texto normalizado e links. Menus semânticos e alguns contêineres conhecidos são removidos; isso não garante eliminar todo ruído de qualquer site.
- Preserva bytes da primeira versão e de alterações relevantes em Storage privado. Texto, páginas e hashes ficam no banco. Mudanças somente em metadados ou menus descartados não criam nova evidência.
- Registra sucesso, erro, duração, revisão pendente e último sucesso. Falhas preservam o conteúdo conhecido e aplicam espera crescente de 6 a 48 horas. Leases permitem retomada e impedem concluir uma fonte pausada.
- Não altera etapas, prazos ou participação automaticamente. Mudanças exigem revisão. Confirmar leitura registra versão, nota e autoria; a pessoa cadastra nas etapas os fatos conferidos.

Tetos conservadores do piloto: 50 versões relevantes por fonte e 100 MB somados nas evidências referenciadas. Ao atingir o teto, novas consultas permanecem pendentes e aparecerão atrasadas; o administrador precisa exportar/revisar retenção. Logs de coleta expiram em 30 dias. Uploads órfãos após falha entre Storage e banco precisam de limpeza administrativa; não há coleta automática de lixo ainda. Estes controles não substituem limites e bloqueios de cobrança das contas dos provedores.

## Diagnosticar uma URL sem banco

```sh
node scripts/probe.mjs https://www.mwcbarcelona.com/ https://www.expocomer.com/en/
```

Guarda bytes, texto e relatório em `.local/probes/`, ignorado pelo Git. Não cadastra eventos nem ativa monitoramento. Resultado das primeiras consultas em [docs/validacao/fontes-reais.md](docs/validacao/fontes-reais.md).

## Publicar

Cloudflare Pages: comando `npm run build`, saída `dist`. Configurar as duas variáveis públicas de `.env.example` no ambiente de build. Não há serviço pago obrigatório. O site ainda não foi publicado.

## Validação e pendências

Migrações e RLS foram exercitadas com PostgreSQL embutido via PGlite, usando simulações mínimas dos schemas Auth e Storage. Isso valida SQL e regras de banco, **não a integração hospedada com Auth, PostgREST e Storage**. Testes de interface cobrem modo local em desktop e celular. Ainda é necessário validar Google OAuth, transferência de arquivos e isolamento no Supabase real.

O evento continua como payload JSON com controle de revisão. Fontes, versões, execuções e conferências já são normalizadas. Faltam fases com intervalos/fusos completos, interpretação Gemini, conflitos por campo, outbox/Telegram, lembretes e piloto contínuo de 7–14 dias. Não há Playwright de coleta nem OCR automático. Não há garantia para CAPTCHA, login ou páginas cujo conteúdo dependa de JavaScript.

Plano completo em [docs/PLANO.md](docs/PLANO.md); colaboração em [AGENTS.md](AGENTS.md); tokens em [DESIGN.md](DESIGN.md); decisões em [PRODUCT.md](PRODUCT.md). Skills locais preservam arquivos fornecidos; scripts e referências não vieram junto.
