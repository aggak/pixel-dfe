# Relatório de execução — Marco 5 / issue #42

Data da verificação: 31/10/2026.

## Escopo e ponto de partida

Implementei a [issue #42 — Excluir tarefa com confirmação](https://github.com/aggak/pixel-dfe/issues/42) a partir da `main` no commit `6fecebb`. A aplicação já listava tarefas, mostrava cartões na lista, no quadro e na página de cada projeto, mas não oferecia a exclusão. O objetivo era pedir confirmação, excluir pela API e atualizar a tela somente após uma resposta bem-sucedida. Trabalhei em uma branch própria, sem incluir o estado de carregamento da issue #43.

## Estrutura utilizada

- `src/api.ts`: acrescentei `excluirTarefa`, que envia `DELETE /tarefas/:id`, codifica o identificador na URL e lança `ErroApi` quando a resposta não é bem-sucedida.
- `src/components/CartaoTarefa.tsx` e `src/App.css`: acrescentei **Excluir tarefa** ao menu de ações e uma caixa de confirmação no padrão visual do projeto. O envio fica bloqueado enquanto a exclusão está pendente. Se a API falha, a caixa permanece aberta com uma mensagem para tentar novamente.
- `src/pages/ListaTarefas.tsx`, `src/pages/QuadroTarefas.tsx` e `src/pages/DetalheProjeto.tsx`: cada tela chama a função da API e retira a tarefa de sua lista apenas depois do sucesso. As contagens da lista, das colunas e do projeto acompanham os dados exibidos.
- `tests/api-escrita.mjs` e `tests/exclusao-tarefa.cjs`: ampliei a verificação da API e criei um teste de navegador para cancelamento, falha e sucesso nas três telas. O teste usa uma cópia temporária de `db.seed.json`.

Reutilizei o cartão, o menu e os componentes de diálogo existentes. Não alterei o contrato das tarefas nem os bancos do projeto.

## Falhas encontradas e correções

A falta da função e da ação de excluir era o requisito da issue. Durante a implementação, não encontrei falha funcional anterior que exigisse outra correção. No teste de navegador, uma expectativa inicial usava **1 tarefas**; a interface mostrava corretamente **1 tarefa**. Corrigi a expectativa antes de concluir o commit do teste.

Simulei uma resposta `500` para a exclusão. A tarefa e a contagem permaneceram na tela, a mensagem de erro apareceu e foi possível tentar novamente. Essa resposta foi provocada pelo teste para verificar a falha; não foi um erro observado na API normal.

## Validação e resultados

**Na entrega da issue:** `npm run build` e `npm run lint` passaram. `tests/api-escrita.mjs` aprovou 13 cenários, incluindo exclusão, identificador especial, resposta `404` e cancelamento por sinal. `tests/exclusao-tarefa.cjs` confirmou que **Cancelar** não envia `DELETE`, que a falha não remove a tarefa e que o sucesso atualiza lista, quadro e página do projeto. A suíte existente `tests/status-cartao.cjs` aprovou 10 cenários, sem regressão na mudança de status.

**Executado agora na `main` integrada, commit `4d061fd`:** o build, o lint, os 13 cenários da API e o teste de exclusão passaram novamente. Os testes informaram ausência de erros JavaScript não tratados e preservação de `db.json` e `db.seed.json`.

Separei a implementação nos commits `81e6ade` (API), `8b20801` (confirmação e atualização das telas) e `aba9668` (testes), todos com minha autoria. O [PR #81](https://github.com/aggak/pixel-dfe/pull/81) foi integrado à `main` pelo merge `2173a49`, e a issue #42 está fechada.

## Limites

A exclusão definitiva depende da confirmação e de uma resposta bem-sucedida da API; a interface não oferece recuperação depois disso. O teste de falha usa uma resposta simulada, e os testes de navegador cobrem os fluxos descritos com o banco de exemplo, sem percorrer todos os navegadores ou todas as tarefas possíveis.
