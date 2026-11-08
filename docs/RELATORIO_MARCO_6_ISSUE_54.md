# Relatório de execução — Marco 6 / issue #54

Data da verificação: 08/11/2026.

## Escopo e ponto de partida

Trabalhei na [issue #54 — Garantir que as rotas internas abrem direto](https://github.com/aggak/pixel-dfe/issues/54), correspondente à atividade [43] do enunciado. Criei a branch `issue-54-rotas-publicadas` a partir da `main` atualizada no commit `0f488bc`, depois da publicação da aplicação pela issue #53. Preservei a alteração preexistente em `db.json` na outra cópia local do repositório.

O objetivo foi conferir a aplicação publicada em `https://pixel-dfe-project.up.railway.app` quando uma pessoa abre uma rota interna em uma aba nova ou recarrega essa rota. O relatório da #53 registra `RAILPACK_SPA_OUTPUT_DIR=dist` no serviço frontend da Railway e uma sondagem inicial de `/quadro` e `/tarefas/2` com HTTP 200. Essa configuração já atendia ao primeiro critério da #54; não a alterei.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `tests/rotas-publicadas.mjs` | Teste sob demanda e somente de leitura: consulta a tarefa 2 e os projetos na API hospedada; abre cada rota diretamente no Chrome; recarrega; confere HTTP 200, HTML, endereço mantido e conteúdo esperado da tela. |
| `docs/RELATORIO_MARCO_6_ISSUE_54.md` | Este registro dos resultados e limites da verificação. |

O teste usa o apoio de navegador já existente em `tests/ui.cjs`. Ele não faz `POST`, `PATCH` ou `DELETE`, não altera `src/` e não acrescenta dependências ao projeto.

## Critérios da issue e resultados

| Critério | Resultado observado |
| --- | --- |
| Hospedagem atende às rotas do roteador. | A aplicação publicada respondeu HTTP 200 com HTML em todas as dez rotas testadas. Depois, o React exibiu o conteúdo esperado. A configuração de SPA já havia sido feita na #53. |
| Abrir `/tarefas/2` diretamente, sem erro 404 da hospedagem. | A URL abriu com HTTP 200 e mostrou o detalhe com o título da tarefa 2 obtido da API hospedada. |
| Recarregar `/tarefas/2`. | A recarga manteve a URL e mostrou novamente o detalhe correto. |
| Conferir as demais rotas. | Acesso direto e recarga passaram em `/`, `/quadro`, `/projetos`, no detalhe de um projeto, em `/tarefas/nova`, `/tarefas/2/editar`, `/projetos/novo`, na edição de um projeto e em `/rota-inexistente`. Nesta última, a hospedagem entregou a aplicação e o React exibiu “Página não encontrada”. |

O ID de projeto é escolhido a partir da resposta atual da API, para que o teste não dependa do nome dos dados de exemplo. A tarefa 2 é fixa porque a issue a cita explicitamente.

## Falhas encontradas e correções

Não encontrei falha no acesso direto ou na recarga. Antes do teste de navegador, também consultei cinco URLs publicadas por HTTP (`/`, `/tarefas/2`, `/projetos`, `/quadro` e `/projetos/1`); todas responderam 200 com o título HTML da aplicação. Não foi necessário mudar a configuração da Railway nem o código React. O commit da implementação da #54 contém somente o teste automatizado.

## Validação

| Verificação | Resultado observado |
| --- | --- |
| `node tests/rotas-publicadas.mjs` | Aprovado: dez rotas abertas diretamente e recarregadas no Chrome, sem erro JavaScript reportado pelo navegador. |
| `npm run lint` | Aprovado, sem saída de erro. |
| `node --check tests/rotas-publicadas.mjs` | Aprovado. |
| `git diff --cached --check` | Aprovado antes do commit do teste. |

Não executei `npm run build` nesta branch: a entrega não modifica os arquivos da aplicação ou a configuração de build. A issue #52 já verificou o build de produção; aqui o alvo foi o site efetivamente publicado.

## Como repetir

Com as dependências do projeto e o Playwright disponíveis, execute `node tests/rotas-publicadas.mjs`. O teste precisa de Chrome instalado e de acesso aos dois serviços públicos da Railway. Ele só faz consultas de leitura à API.

## Commits e limites

- Commit de teste: `3fe92ee` — `Verifica rotas publicadas (#54)`, integrado à `main` pelo [PR #96](https://github.com/aggak/pixel-dfe/pull/96) no merge `4fa17fd`. Este relatório foi preparado em commit separado após essa integração.
- O teste foi executado no Chrome em uma largura de 1280 px. Não prova o comportamento em todos os navegadores, tamanhos de tela ou futuros deploys.
- Se a tarefa 2 for removida da API pública ou se algum dos serviços ficar indisponível, o teste falhará mesmo que a configuração de rotas da hospedagem não tenha mudado.
