# Monitor de editais e eventos — proposta de produto e arquitetura

Proposta para a equipe CartAI. Revisão de 04/11/2026: orçamento mensal de R$ 0 e implementação assistida por IA. Documento de planejamento; nenhum sistema foi implantado e nenhum monitoramento foi ativado.

## 1. Decisão recomendada

É viável criar um site privado compartilhado em que a equipe cadastra uma oportunidade e acompanha etapas, prazos, documentos e mudanças automaticamente. O sistema consulta fontes oficiais, preserva evidências e avisa quando algo relevante acontece.

Requisitos confirmados: etapas, prazos e histórico organizados, uso privado do grupo, sem intenção de pagar mensalidades e desenvolvimento com IA. Arquitetura escolhida: React + Vite + TypeScript no Cloudflare Pages Free; Supabase Free para banco e acesso; script Node.js executado por GitHub Actions; Gemini no Free Tier para interpretar mudanças, conforme disponibilidade e quotas da conta. Não contratar planos pagos, domínio ou infraestrutura adicional. Ao atingir limites, adiar processamento e mostrar pendências, sem migrar automaticamente para cobrança.

Premissas de dimensionamento, a validar: um grupo privado de aproximadamente 5–10 pessoas, 10–30 eventos ativos como alvo de piloto e 1–3 fontes principais por evento. Não são números confirmados pelo usuário. O print menciona oportunidades em Paris e Singapura, mas não contém os links dos editais; a cobertura desses sites específicos ainda precisa ser testada.

O objetivo inicial é acompanhar oportunidades conhecidas. Descobrir continuamente todos os editais existentes é outro produto e outro orçamento.

## 2. O que existe e o que falta

| Caminho | O que entrega | Trabalho restante | Quando escolher |
| --- | --- | --- | --- |
| changedetection.io | Monitoramento de URLs, diferenças, filtros, PDFs, notificações e API | Modelar eventos, etapas, decisões e prazos; adaptar experiência ao grupo | Só é preciso saber que uma página mudou |
| n8n com banco e integrações | Rotinas periódicas e integração entre serviços | Coleta, interpretação, persistência, interface e regras do domínio | Equipe já usa e mantém n8n |
| Aplicativo próprio | Painel específico, histórico de etapas, revisão de dúvidas e alertas contextualizados | Implementar e manter a aplicação | É necessário acompanhar o processo inteiro |

O changedetection.io já oferece resumo/interpretação com chave de IA própria. Portanto, o diferencial de um aplicativo próprio deve ser a organização do processo seletivo, não simplesmente adicionar IA a um detector de mudanças. [1–3]

## 3. Jornada de uso

1. Um integrante acessa o espaço privado da equipe.
2. Clica em “Adicionar evento” e cola o link oficial. Nome, edição e organização são preenchidos quando encontrados.
3. O cadastro fica aguardando a próxima rodada de coleta; o sistema então lê a página, identifica documentos relacionados e propõe um cronograma com fontes. No piloto, um administrador pode antecipar a rodada pelo GitHub Actions.
4. O integrante confirma o evento e as fontes na primeira configuração; dados ausentes permanecem ausentes.
5. O monitoramento passa a funcionar com o site fechado e sem o computador do integrante ligado.
6. Mudanças claras e validadas atualizam o painel automaticamente. Conflitos ficam em revisão, com aviso à equipe.
7. A equipe consulta próximos prazos, novas publicações e o que mudou desde a última visita.

Se só houver o nome do evento, uma extensão futura poderá consultar uma API de busca e oferecer candidatos. Antes de acompanhar, validar organização, edição, país e domínio oficial. Um resultado de busca isolado nunca deve alterar a etapa do processo. No primeiro MVP, solicitar o link reduz ambiguidades e custos.

## 4. Interface mínima

### Visão geral

Tabela no desktop e cartões no celular, com nome/edição, etapa ou etapas ativas, próximo prazo, responsável, última mudança e última verificação bem-sucedida. Filtros por etapa, prazo próximo, responsável, favorito e fonte com falha. Destacar “Precisa de atenção” acima da lista.

### Página do evento

Resumo, cronograma, publicações oficiais, histórico de alterações, fontes monitoradas, situação da equipe e ação “Solicitar atualização”, que registra um pedido para a próxima rodada. Toda informação extraída deve permitir abrir sua evidência: documento, URL, página/seção e trecho correspondente.

### Revisões e configurações

Uma lista pequena de conflitos: data ambígua, edição divergente, documento ilegível, fonte inacessível ou retificação sem relação clara. Um integrante confirma/corrige com registro de autoria. Configurações incluem participantes, canal de alerta, frequência e pausa do monitoramento.

Calendário visual e exportação .ics podem entrar depois. A primeira entrega precisa de lista de prazos funcional, não de várias visualizações equivalentes.

## 5. Três estados que não podem ser confundidos

| Dimensão | Exemplos | Regra |
| --- | --- | --- |
| Processo oficial | Inscrições, avaliação, recursos, resultado preliminar, resultado final, suspenso | Sustentado por cronograma ou publicação identificada |
| Participação da equipe | Interessados, preparando, inscrição enviada, aguardando, selecionados, não selecionados | Atualização manual no MVP; resultado individual só com correspondência inequívoca |
| Monitoramento | Atualizado, atrasado, erro de acesso, pendente de revisão, pausado | Descreve a capacidade de consultar a fonte |

Não tratar o processo como sequência rígida de seis estados: etapas podem se sobrepor, mudar de ordem, ser prorrogadas ou reabrir. Representar cada etapa com nome original, categoria normalizada, início/fim e fonte. A visão resumida pode mostrar mais de uma etapa ativa.

“Resultado previsto para hoje” não significa “resultado publicado”. “Prazo de inscrição encerrado conforme cronograma” é uma dedução temporal explícita. “Resultado final publicado” exige publicação oficial localizada. Uma fonte indisponível preserva o último estado conhecido e mostra sua desatualização.

## 6. Arquitetura escolhida — R$ 0 de mensalidade dentro das cotas

| Componente | Tecnologia | Papel |
| --- | --- | --- |
| Site | React + Vite + TypeScript | Painel privado responsivo, etapas, prazos e histórico |
| Hospedagem | Cloudflare Pages Free | Arquivos do site e endereço fornecido pelo serviço |
| Dados e acesso | Supabase Free: PostgreSQL, Auth e Storage | Cadastro compartilhado, permissões e documentos |
| Coleta automática | Node.js/TypeScript no GitHub Actions | Executar um script em lote quatro vezes ao dia |
| HTML e PDF | fetch, parser HTML, PDF.js | Ler páginas e documentos textuais |
| Páginas dinâmicas | Playwright, somente quando necessário | Coleta dentro do runner Linux, com limite de tempo |
| Interpretação | Gemini API Free Tier, modelo elegível na conta | Extrair fatos de conteúdo novo, dentro das cotas |
| Alertas | Painel e Telegram | Avisos sem introduzir plano de e-mail ou WhatsApp pago |

O navegador consulta o Supabase usando a sessão do usuário e permissões RLS. Apenas integrantes autorizados podem ler os dados da equipe. A página de login pode ser pública; os dados não. Credenciais administrativas, chave Gemini e token Telegram ficam nos Secrets do GitHub, nunca no JavaScript distribuído pelo site.

Login social com contas autorizadas evita depender de um serviço pago de envio de e-mails. O login por si só não concede acesso: memberships e RLS devem exigir associação à equipe.

A hospedagem é estática, mas os dados são dinâmicos: cadastrar evento ou atualizar prazo escreve no banco, sem republicar o site. Não há necessidade de renderização no servidor ou de um backend Next.js para este escopo. A coleta ocorre na nuvem; o computador de Luan não precisa ficar ligado.

GitHub Actions executará um lote com concorrência limitada, não um serviço permanente. Usar repositório privado, runner Linux padrão, timeout por fonte e limite total por execução. O site grava pedidos de atualização no banco; o lote os atende na próxima rodada. Execução imediata pelo administrador via workflow_dispatch no GitHub. Um endpoint autenticado para disparo pelo site pode ser adicionado posteriormente; nunca expor token GitHub no cliente.

Os recursos gratuitos têm limites e podem mudar. A aplicação deve continuar exibindo dados já salvos quando a coleta ou a interpretação estiverem indisponíveis. Se uma fonte só puder ser atendida por serviço pago, mantê-la com atualização manual.

## 7. Pipeline de atualização

1. Um workflow agendado quatro vezes ao dia seleciona fontes cujo next_check_at venceu. A configuração de concurrency impede lotes simultâneos; o banco mantém checkpoints. Não executar um despachante a cada poucos minutos no MVP gratuito.
2. Processar fontes em pequenos lotes, preferindo API/feed oficial quando existir; depois HTTP simples; navegador como alternativa. Aplicar timeout, limite de tamanho, limite por domínio e backoff.
3. Consultar a página que lista publicações e os documentos relevantes. Monitorar só o PDF original deixaria passar um novo PDF de retificação.
4. Descobrir links novos dentro de escopo limitado: mesma edição, termos relacionados, domínios oficiais aprovados e teto de páginas/documentos. Não percorrer a internet indiscriminadamente.
5. Preservar bytes/texto da versão relevante, horário da coleta, tipo e URL efetiva. Usar hash para deduplicar documentos idênticos; normalizar texto e links para comparar conteúdo útil.
6. Ignorar relógios, menus e banners. Alteração de metadados de PDF sem mudança textual não deve virar novidade do edital. Cache HTTP pode ajudar, mas fazer revalidação periódica conforme o comportamento da fonte.
7. Se não houve mudança relevante, registrar sucesso sem chamar IA. Na primeira leitura e em alterações relevantes, enviar texto novo e contexto anterior necessário, incluindo cabeçalhos e linhas próximas de tabelas.
8. A IA devolve proposta estruturada de fatos: tipo, valor anterior/novo, evidência, edição, publicação relacionada e incertezas. Permitir null e “não encontrado”.
9. Validar esquema, identidade do evento, datas, evidência existente e relação entre documentos. Uma nota de confiança do modelo, sozinha, não autoriza atualização.
10. Aplicar mudanças claras; encaminhar ambiguidades à revisão. Salvar versão, fatos e notificação pendente numa transação. Uma etapa posterior do script envia alertas pendentes, permitindo recuperação na próxima execução.

Além desse fluxo, uma etapa independente do mesmo lote produz lembretes a partir dos prazos vigentes. Ela funciona mesmo quando a página não muda. Uma prorrogação invalida lembretes associados à versão antiga do prazo.

## 8. Frequência, alertas e fontes difíceis

Configuração inicial sugerida, sujeita ao piloto:

| Situação | Consulta sugerida |
| --- | --- |
| Evento ativo sem prazo próximo | A cada 6 horas |
| Prazo em até 72 horas ou resultado aguardado | Priorizar dentro das quatro rodadas diárias; antecipar manualmente se necessário |
| Evento concluído | Pausar após janela configurável de acompanhamento |
| Falhas repetidas | Reduzir tentativas e avisar sobre monitoramento degradado |

Os intervalos são metas operacionais, não garantia de detecção imediata. O GitHub informa que agendamentos podem atrasar e, sob carga suficiente, ser descartados. O painel deve sinalizar quando a última coleta estiver atrasada. Escolher minuto fora do início da hora, por exemplo 17, para reduzir concentração de execuções [18]. Respeitar limitações e condições das fontes.

Alertar logo após detectar prorrogação, publicação de resultado, nova etapa, suspensão ou cancelamento. Enviar lembretes de 7 dias, 3 dias e 24 horas quando a precisão da data permitir. Agrupar mudanças secundárias num resumo diário; não enviar “sem novidades” a cada checagem.

Exemplo fictício: “Evento X — prazo de inscrição alterado de 12/11 para 19/11. Encontrado na retificação 02, página 1. Verificado às 09h15. Abrir documento / abrir evento.”

Para o MVP, Telegram é uma opção simples de integração oficial [13]. O print mostra um grupo de WhatsApp: manter no site uma ação de copiar/compartilhar resumo. Não prometer envio automático ao grupo existente antes de verificar a integração oficial aplicável à conta. E-mail pode substituir Telegram se o grupo preferir.

PDF escaneado: detectar ausência de texto e marcar como pendente; OCR automático entra se o piloto mostrar necessidade frequente. Redes sociais, login, CAPTCHA e páginas bloqueadas não têm cobertura garantida. Usar fonte pública alternativa, importar documento manualmente ou pedir revisão. Falhas nunca devem parecer ausência de novidades.

## 9. Modelo de dados inicial

| Tabela | Conteúdo principal |
| --- | --- |
| workspaces / memberships | Equipe, integrante e papel: administrador/editor/leitor |
| events | Nome, organização, edição, descrição, responsável e situação interna |
| sources | Evento, URL canônica, tipo, método, frequência, próxima consulta e saúde |
| source_versions | Fonte, hashes, arquivo/texto, primeira/última observação e metadados |
| stages | Evento, rótulo original, categoria, datas, precisão, fuso e estado de confirmação |
| observations | Fato extraído, versão de origem, trecho/página, proposta e decisão |
| changes | Diferença aceita, valores anterior/novo, autor e momento da aplicação |
| check_runs | Fonte, tentativa, resultado, duração, erro e consumo estimado |
| notification_outbox | Alteração/lembrete, destino, versão, chave de deduplicação e entrega |

Um evento tem muitas fontes e etapas; uma fonte tem muitas versões e execuções. Uma observação referencia a versão que sustenta o fato. Arquivos ficam no Storage privado; metadados e referências ficam no banco.

Datas de prazo: guardar data/hora original, fuso IANA quando conhecido, valor UTC quando possível e precisão (dia ou minuto). Exibir também o horário de Brasília. Para eventos internacionais, não assumir que 23h59 está no fuso brasileiro. Horário ausente continua ausente; não fabricar hora limite.

Separar data de publicação, data de vigência e momento em que o sistema encontrou o documento. Um arquivo descoberto hoje pode ter sido publicado há uma semana.

## 10. Confiabilidade e acesso

- Retificação só substitui o fato ao qual se refere, depois de conferir edição e escopo. Um documento mais recente não é automaticamente mais autoritativo para todos os campos.
- Deduplicar consulta por fonte e janela; deduplicar alteração por fato e versão; deduplicar alerta por alteração/lembrete e destino. Manter unicidade no banco, e checkpoints persistentes para retomar o script após falhas.
- Salvar entregas pendentes numa outbox transacional. Uma falha de envio não deve perder a alteração. Em provedores sem idempotência de envio, uma resposta de rede ambígua ainda pode gerar duplicata; documentar e reduzir esse caso.
- Guardar estado de revisão, decisões manuais e motivo. Uma nova leitura não deve sobrescrever silenciosamente uma correção humana bloqueada.
- Testar isolamento entre equipes com RLS; manter chaves administrativas e de IA somente no servidor. Convites e operações privilegiadas exigem autorização.
- Tratar páginas/PDFs como entrada não confiável: o modelo extrai dados, sem executar instruções encontradas nos documentos. Validar saídas antes de gravar.
- Proteger o coletor contra SSRF: limitar a HTTP/HTTPS, impedir destinos privados/locais e metadados de nuvem, verificar DNS/redirecionamentos e aplicar proteção também a requisições do navegador. Escopo de domínios ajuda, mas não substitui essa proteção.
- Limitar bytes, páginas, tempo, chamadas de IA e concorrência. Usar bibliotecas atualizadas e armazenamento privado dos PDFs.
- Reter versões que sustentam decisões. Definir retenção para logs e capturas repetidas. Fazer backup de banco e arquivos, e verificar restauração.
- Medir sucesso de coleta, fontes atrasadas, revisões pendentes, alertas falhos, consumo e custo por evento. Não depender apenas dos logs temporários do GitHub Actions.

## 11. Orçamento e limites gratuitos

Orçamento autorizado: R$ 0 por mês. Não é uma promessa de uso ilimitado ou garantia de disponibilidade permanente. A implementação deve respeitar as cotas e parar ou adiar processamento quando necessário, sem cobrança automática.

| Serviço | Limite/recurso consultado em 04/11/2026 | Decisão |
| --- | --- | --- |
| Cloudflare Pages Free | 500 builds por mês | Recompilar apenas quando o código mudar; dados vêm do banco [17] |
| Supabase Free | 500 MB de banco, 1 GB de arquivos; pausa após uma semana de inatividade | Guardar diferenças e versões relevantes; mostrar falhas e permitir restauração do projeto [6] |
| GitHub Free / Actions | 2.000 minutos mensais incluídos e 500 MB de armazenamento no plano | Runner Linux padrão; consumo compartilhado com outros repositórios da conta; bloquear excedentes [19–20] |
| Gemini API Free Tier | Acesso gratuito limitado a certos modelos; quotas dependem do projeto/modelo | Verificar modelo elegível na conta, manter projeto sem faturamento vinculado e enfileirar excedentes [21–22] |
| Endereço do site | Subdomínio do provedor | Não comprar domínio |

No GitHub, conferir orçamento com bloqueio de uso excedente; alerta de orçamento sozinho não bloqueia cobrança. Evitar runners maiores e armazenamento desnecessário. Não fazer upgrade automático de nenhum provedor.

Exemplo aritmético: 4 execuções/dia × 30 dias × 5 minutos por execução = 600 minutos/mês. Isso caberia nos 2.000 minutos do GitHub Free, se houver saldo disponível na conta. Os 5 minutos são hipótese, não medição. Navegador, instalação de dependências, PDFs, testes e falhas podem aumentar o consumo. Medir no piloto; começar com poucas fontes.

Não usar espera longa para contornar quota dentro do runner: persistir a pendência e encerrar o processo. Reusar dependências de forma moderada, controlar armazenamento de cache e não salvar PDFs como artifacts do Actions. Preservar no Supabase somente versões necessárias e manter exportação periódica para recuperação.

Gemini não precisa pesquisar a internet em cada consulta: o script obtém o documento e envia apenas os trechos relevantes. Se a quota gratuita acabar ou o modelo não estiver disponível, o detector continua registrando mudanças; a interpretação fica pendente. O grupo pode revisar manualmente. Não enviar dados privados da equipe para a IA; a modalidade gratuita informa uso de conteúdo para melhoria de produtos [21].

O orçamento anterior com serviços pagos foi substituído por este plano. Uma expansão paga só deve ser reconsiderada se o grupo mudar explicitamente a restrição de custo.

## 12. Construção assistida por IA e ordem de entrega

Usar IA para escrever código, migrações, workflows, testes e instruções de publicação é compatível com esta proposta. A estimativa anterior de horas de trabalho humano não serve como calendário de uma implementação assistida por IA e foi retirada. Ainda é necessário validar a integração, configurar contas/chaves e observar a coleta em fontes reais. A IA usada para construir o projeto não fornece automaticamente a API que o site usará depois de publicado.

| Entrega | Resultado verificável |
| --- | --- |
| 1. Base do produto | Site, login, equipe autorizada, cadastro manual, etapas, prazos e histórico |
| 2. Coleta básica | Script lê 5–10 fontes reais, identifica mudanças e grava evidências |
| 3. Automação gratuita | Workflow quatro vezes ao dia, limites, checkpoints e painel de saúde |
| 4. Interpretação | Gemini gratuito, validação estruturada, conflitos em revisão e tratamento de quota |
| 5. Alertas e piloto | Telegram, lembretes, exportação, teste de falhas e acompanhamento por 7–14 dias |

Manter um repositório: aplicação em src/, coletor em scripts/, migrações em supabase/migrations/ e workflow em .github/workflows/. Compartilhar tipos e validações. Instruir a IA explicitamente: nenhuma dependência paga obrigatória, nenhuma chave no frontend, nenhum dado fictício apresentado como atualização real e nenhuma suposição de sucesso quando coleta/extrator falhar.

O piloto decide se quatro consultas diárias cabem nas cotas com os eventos reais. Se não couberem, reduzir frequência, retenção ou cobertura de fontes caras. O objetivo funcional continua sendo etapas, prazos e histórico compartilhados.

## 13. Critérios de aceite

1. Cadastrar evento com página oficial e PDF, extraindo dados com evidência por campo.
2. Detectar nova publicação na página e alteração de um PDF substituído na mesma URL.
3. Aplicar prorrogação confirmada, preservar a data antiga e cancelar lembretes obsoletos.
4. Mudança de menu/banner não produzir alerta de edital; fonte sem alteração não chamar IA novamente.
5. Data prevista de resultado ultrapassada não virar “resultado publicado”.
6. Falha 403/429/timeout aparecer como problema de coleta, preservando o último estado conhecido.
7. Reexecutar tarefa sem duplicar fatos ou entradas de alerta; testar retomada depois de falha entre gravação e envio.
8. Documento ambíguo ou PDF ilegível entrar em revisão com acesso à evidência original.
9. Prazo internacional respeitar fuso explícito e ausência de hora não virar 23h59 inventado.
10. Permissões impedirem leitura/alteração fora da equipe; coletor rejeitar destinos internos.
11. Equipe acompanhar os mesmos dados com navegador fechado durante as checagens.
12. Piloto registrar cobertura real, latência observada, falsos alertas e custo. Não declarar cobertura universal.

## 14. Fora da primeira versão

Busca ampla de novas oportunidades; inscrição automática; consulta a contas pessoais; confirmação automática de seleção por nomes parecidos; aplicativo nativo; chat genérico; ranking de oportunidades; agente autônomo com navegação ilimitada; integração automática com o grupo atual de WhatsApp sem validação específica.

Próximo passo concreto: reunir 5–10 URLs reais e executar a prova de coleta. Esse conjunto identifica quais fontes precisam de Playwright/OCR, os limites de cobertura e o orçamento justificável para o aplicativo próprio.

## Fontes oficiais consultadas

1. changedetection.io — recursos e preço: https://changedetection.io/
2. changedetection.io — README, PDFs e métodos de coleta: https://github.com/dgtlmoon/changedetection.io/blob/master/README.md?plain=1
3. n8n — Schedule Trigger: https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/README.md
4. Next.js — Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
5. Supabase — RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
6. Supabase — preços: https://supabase.com/pricing
7. Trigger.dev — tarefas agendadas: https://trigger.dev/docs/tasks/scheduled
8. Trigger.dev — retries: https://trigger.dev/docs/errors-retrying
9. Trigger.dev — Playwright: https://trigger.dev/docs/config/extensions/playwright
10. Trigger.dev — idempotência: https://trigger.dev/docs/idempotency
11. Mozilla PDF.js — exemplo Node de texto e metadados: https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs
12. Gemini API — saídas estruturadas: https://ai.google.dev/gemini-api/docs/structured-output?hl=pt-br
13. Telegram — Bots FAQ: https://core.telegram.org/bots/faq
14. Trigger.dev — preços: https://trigger.dev/pricing
15. Vercel — preços: https://vercel.com/pricing
16. Vercel — condições do plano Hobby: https://vercel.com/docs/plans/hobby

As escolhas de stack, modelagem, frequências, escopo e estimativas são recomendações de engenharia elaboradas para este caso; não são promessas dos fornecedores.

17. Cloudflare Pages — limites: https://developers.cloudflare.com/pages/platform/limits/
18. GitHub Actions — eventos agendados: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
19. GitHub — uso incluído por plano: https://docs.github.com/en/billing/reference/product-usage-included
20. GitHub Actions — cobrança e uso: https://docs.github.com/en/actions/concepts/billing-and-usage
21. Gemini API — preço e modalidade gratuita: https://ai.google.dev/gemini-api/docs/pricing
22. Gemini API — faturamento e acesso gratuito: https://aistudio.google.com/docs/billing
