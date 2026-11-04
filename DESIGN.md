# Sistema visual do Notify

## Autoridade
Regras de tokens solicitadas pelo usuário em 04/11/2026. A navegação superior alinhada à esquerda foi solicitada explicitamente pelo usuário, que rejeitou a barra lateral. Paleta preservada da primeira versão.

## Direção
Ferramenta de operação para acompanhar oportunidades com evidência. Caráter: sóbrio, organizado, preciso. Superfícies claras para leitura de tabelas durante o trabalho; cinzas com leve matiz verde. Informação e ação têm prioridade sobre decoração. Prazos mantêm precisão de dia e não fabricam horários.

## Tokens
- Gaps: `--gap-sm: 8px`, `--gap-md: 16px`, `--gap-lg: 24px`.
- Espaçamento: 8, 16, 24, 32, 40, 48 e 64 px.
- Fontes: corpo 16 px, seção 24 px, título 32 px. Família Segoe UI/system-ui.
- Pesos: 400, 500 e 700.
- Primária: `#165b48`, hover `#104635`; exclusiva dos botões de ação principal.
- Texto `#25332f`, secundário `#596760`, fundo `#f5f7f6`, superfície `#fff`, borda `#dce2de`.
- Foco com contorno visível; erro com cor semântica; navegação e favoritos neutros.

## Componentes e adaptação
Cabeçalho horizontal com logo e navegação juntos à esquerda; equipe e conta à direita. Abaixo de 900 px, logo/conta ficam na primeira linha e navegação à esquerda na segunda. Conteúdo central limitado a 1440 px, sem coluna reservada para navegação. Resumo em uma linha compacta acima da lista; o aviso de armazenamento local é texto contextual.

Tabela para desktop, cartões rotulados abaixo de 700 px. Fontes e evidências usam os mesmos tokens e controles neutros; salvar etapa e cadastrar oportunidade continuam sendo as ações primárias. Revisão é confirmação de leitura de evidência, com nota e autoria, sem representar uma publicação de resultado. Os fluxos locais foram exercitados em navegador desktop e celular; estados conectados ainda exigem Supabase real.

## Skills locais
Originais preservados em `.agents/skills/`. Unslop: Damir Sokolovsky, https://heydamir.design/unslop, licença CC BY 4.0. Impeccable fornecida: versão 4.8.0, Apache 2.0. Pacotes de apoio não fornecidos; instalação local contém apenas os documentos originais.
