# Validação da segunda entrega — 04/11/2026

## Resultado verificado

- `npm test`: 26 testes passaram, incluindo migrações em PGlite, RLS entre equipes, leitor sem escrita, conflito de revisão, auditoria imutável, Storage privado simulado, deduplicação, preservação do último sucesso, pausa durante coleta e conferência manual com autoria.
- `npm run test:ui`: quatro testes passaram, cobrindo fluxo local de cadastro/etapa/participação/favorito/persistência e preservação de arquivo inválido, em 1440×1000 e 390×844.
- `npm run build`: TypeScript e bundle de produção concluídos.
- `npm run check:design`: três gaps, três pesos, fontes em múltiplos de oito e uso da primária no botão principal passaram na verificação de CSS.
- Capturas desktop/mobile da lista e do detalhe foram inspecionadas. A tabela inicialmente falhou no celular; foi adaptada para cartões. As capturas finais ficam em `test-results/`, ignorado pelo Git.
- Duas URLs reais foram consultadas com o coletor. Evidências e limitações em `fontes-reais.md`.

## O que estes testes não comprovam

Não foram configurados Supabase hospedado, Google OAuth, Secrets do GitHub, execução do workflow na nuvem ou Cloudflare Pages. A simulação dos schemas Auth/Storage em PGlite não cobre seus serviços HTTP reais. Os testes de interface usam modo local, não a conexão hospedada.

Não houve piloto contínuo ou detecção de retificação real. O workflow permanece desativado sem `MONITOR_ENABLED=true`. IA, Telegram e lembretes não fazem parte desta entrega.

## Revisão técnica registrada

Controle de revisão foi adicionado tanto ao modo local quanto à RPC compartilhada. Fatos oficiais não são inferidos da passagem do tempo. A conferência manual registra o hash efetivamente lido e rejeita uma versão desatualizada. O coletor preserva o histórico de versões, verifica rede/DNS antes de cada destino e separa falha de coleta de ausência de mudanças. Tetos e limitações operacionais estão no README.
