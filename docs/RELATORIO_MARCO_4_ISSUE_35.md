# Relatório de execução — Marco 4 / issue #35

Data da verificação: 25/10/2026.

## Escopo e ponto de partida

Implementei a [issue #35 — Implementar a busca por título](https://github.com/aggak/pixel-dfe/issues/35) na lista geral de tarefas. Parti da `main` no commit `adef238`, que já carregava as tarefas pela API, mas ainda não oferecia um campo de busca. O objetivo era filtrar os cartões pelo texto do título e restaurar a lista ao limpar o campo. Os filtros de status e prioridade vieram depois, na issue #36; na `main` atual, a busca também se combina com eles.

## Estrutura utilizada

- `src/pages/ListaTarefas.tsx`: adicionei o campo identificado como **Buscar por título** e guardei seu valor no estado da página. A lista exibida é calculada a partir das tarefas recebidas por `listarTarefas`: retiro espaços das extremidades do termo, comparo em minúsculas com `toLocaleLowerCase("pt-BR")` e procuro o trecho com `includes`. Os cartões e a contagem do rodapé usam o resultado filtrado. Quando não há correspondência, a página mostra **Nenhuma tarefa encontrada.**
- `src/App.css`: incluí o tamanho e a adaptação inicial do campo para telas menores, além do estilo da mensagem sem resultados. A posição definitiva da busca foi ajustada posteriormente no PR da #36.
- `tests/busca-titulo.cjs`: criei um teste de navegador com Vite e `json-server`, usando uma cópia temporária de `db.seed.json`. Ele confere busca por parte do título com letras maiúsculas, texto sem correspondência, limpeza por teclado, contagem e navegação pelas abas de projeto.

Reutilizei a leitura da API e o cartão existentes, sem alterar `src/api.ts`, `src/tipos.ts` ou os dados do projeto.

## Falhas encontradas e correções

Não encontrei registro de falha funcional da busca ou de correção posterior aos commits da #35. A falta do campo na versão inicial era o requisito da issue, não um erro surgido durante a implementação. O [PR #72](https://github.com/aggak/pixel-dfe/pull/72) não recebeu comentários de revisão que apontassem defeitos.

Na publicação, a primeira tentativa de `git push` falhou porque o terminal não conseguiu se conectar a `github.com:443`. Confirmei em seguida que o acesso remoto havia voltado com `git ls-remote` e repeti o push com sucesso. Essa ocorrência não exigiu alteração no código.

## Validação e resultados

**Registrado na descrição do PR #72:** `npm run build`, `npm run lint`, `node tests/busca-titulo.cjs` e `node tests/marco-2.cjs` foram informados como verificações da implementação. O teste da #35 exercitou o campo com `JSON`, um texto sem resultado e a limpeza que restaurou as cinco tarefas do banco de teste. A suíte existente da listagem aprovou 12 cenários. Esses registros pertencem à entrega original.

**Executado agora na `main` integrada, commit `13e9b55`:** `npm run build` e `npm run lint` terminaram sem erro. Executei novamente `tests/busca-titulo.cjs`, que passou com a busca e os filtros já integrados, e `tests/marco-2.cjs`, que aprovou 12 cenários sem erro JavaScript não tratado. As suítes usaram banco temporário; não escreveram no `db.json` local.

A implementação foi dividida nos commits `a9f3488` (campo e filtragem) e `dd76ab0` (teste de comportamento), ambos com minha autoria. O PR #72 foi integrado à `main` pelo merge `77e19c5`, e a issue #35 está fechada.

## Limites

A busca consulta somente o título das tarefas da lista geral. O valor fica no estado de `ListaTarefas`; ao sair dessa rota ou recarregar a página, ele não é preservado. A persistência e o compartilhamento dos filtros entre outras visões não fizeram parte da #35. O teste automatizado confirma os cenários descritos com o banco de exemplo, sem cobrir todos os títulos possíveis ou todos os navegadores.
