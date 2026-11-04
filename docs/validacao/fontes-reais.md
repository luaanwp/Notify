# Consultas reais — 04/11/2026

## Fontes fornecidas pelo usuário

- https://www.mwcbarcelona.com/
- https://www.expocomer.com/en/
- Cartaz da Expocomer 2027, com referência à ApexBrasil, e capturas do MWC. Imagens observadas na sessão; não copiadas de arquivos temporários para o repositório.

## Fatos observados pelo coletor

Execução manual local de `scripts/probe.mjs`, sem Supabase e sem cadastrar fontes em produção. Horários em UTC; evidências completas em `.local/probes/`, ignorada pelo Git.

| Fonte | Momento | Bytes | Caracteres extraídos | PDFs no escopo lido |
| --- | --- | ---: | ---: | ---: |
| MWC Barcelona | 2026-11-04 22:21:04 | 172672 | 3676 | 0 |
| Expocomer /en/ | 2026-11-04 22:21:05 | 66172 | 722 | 0 |

Ambas responderam via HTTP simples com conteúdo legível. O extrator foi ajustado para preservar a abertura do MWC antes de `main` e remover o contêiner de menu usado na Expocomer.

Hashes do conteúdo útil:

```text
MWC: 166f1d7299a3af2f50a2fb8b75145ccc5b45016f8542726c834a94b1a7220bd6
Expocomer: 635adea2031d4e3fb126fdb1da2e9cef5b2eafd42070d6de152416f13c5107d2
```

## Limites da conclusão

A página inicial do MWC informa edição 2027 e realização de 1 a 4 de março. A página inglesa da Expocomer identifica edição 2027, mas o conteúdo textual extraído não resolve o prazo da seleção da ApexBrasil mostrado no cartaz. Página do organizador da feira e seleção brasileira são fontes distintas; o sistema não deve equiparar seus prazos.

Encontrar zero PDFs nesta área não prova ausência de regulamentos em outras páginas. Não houve navegação automática, inscrição, extração por IA, publicação de resultado ou validação de elegibilidade da CartAI.

Isto é uma prova pontual de duas URLs, inferior ao alvo de 5–10 fontes do plano. Não demonstra detecção de mudanças reais futuras nem acompanhamento contínuo. Ainda falta obter a página da seleção brasileira e os regulamentos relevantes, conferir edição/escopo e observar por 7–14 dias.
