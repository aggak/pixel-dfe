# Relatório de execução — Marco 4 / issue #39

Data da execução: 26/10/2026.

## Escopo e ponto de partida

Implementei a [issue #39 — Alternar entre lista e quadro](https://github.com/aggak/pixel-dfe/issues/39), correspondente à issue 28 do enunciado. A branch `issue-39-alternar-lista-quadro` parte do `main` no merge do PR #76 (commit `f658ee7`), que já traz o estado compartilhado da #37 e a rota `/quadro` da #38.

A issue pede a navegação entre as duas visões e a preservação do texto de busca e dos filtros de status e prioridade ao alternar. A preservação já vinha do `FiltrosProvider`, montado acima das rotas na #37; faltava o caminho de uma visão para a outra na interface.

## Registro de execução

1. Criei `AlternarVisao` em `src/components/Layout.tsx`: um `nav` "Visualização das tarefas" com dois links, Lista (`/`) e Quadro (`/quadro`). São links, e não botões, porque cada visão tem sua rota, funciona com voltar/avançar e pode ser aberta direto.
2. Coloquei o controle na faixa de ações de `ListaTarefas` e `QuadroTarefas`, entre os filtros e o botão "Nova tarefa".
3. O link "Tarefas" do menu principal passou a ficar marcado também em `/quadro`, já que lista e quadro são duas visões da mesma seção.
4. A visão ativa é calculada por `caminhoNormalizado`, que remove a barra final e ignora maiúsculas, do mesmo jeito que o roteador casa as rotas. Assim `/quadro/` e `/QUADRO` marcam "Quadro", e o menu e o controle sempre concordam.
5. A troca de rota remonta a página (a chave do `<Routes>` em `App.tsx` muda a cada navegação), e o foco caía no `body`. Os links passam `state={{ focoVisao: true }}`, e o controle recém-montado devolve o foco ao link da visão ativa. Quem alterna pelo teclado continua no controle.
6. Escrevi o CSS de `.e-view-switch`. O ativo se distingue por peso e contorno, não só pela cor. O anel de foco fica dentro do link, sem invadir o vizinho. Entre 651 e 940 px, a busca ocupa a primeira linha e filtros, controle e botão dividem a segunda. No mobile, controle e botão têm 44 px de altura e ficam na mesma linha; em 360 px ou menos os ícones do controle somem para caber.
7. Em `tests/quadro-filtros.cjs`, a troca de rota passou a clicar no controle, em vez de `history.pushState`.
8. Criei `tests/alternar-visao.cjs`.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/components/Layout.tsx` | `caminhoNormalizado`, `AlternarVisao` e "Tarefas" ativo nas duas visões. |
| `src/pages/ListaTarefas.tsx` | Controle na faixa de ações. |
| `src/pages/QuadroTarefas.tsx` | Controle na faixa de ações. |
| `src/App.css` | Estilo do controle e ajuste da faixa de ações entre 320 e 940 px. |
| `tests/alternar-visao.cjs` | Suíte de navegador com API real, banco temporário e build do GitHub Pages. |
| `tests/quadro-filtros.cjs` | Troca de visão pelo controle e espera da URL depois de fechar a ficha. |

Não adicionei dependências. Reaproveitei `ListIcon` e `BoardIcon`, que já existiam em `src/design/icon.tsx` sem uso. Não alterei `src/tipos.ts`, `db.json` nem `db.seed.json`.

## Critérios da issue

| Critério | Resultado |
| --- | --- |
| Disponibilizar a navegação entre as duas visões | Controle Lista/Quadro na faixa de ações das duas visões, por mouse, teclado e histórico do navegador. |
| Preservar o texto de busca ao alternar | A busca segue igual nos dois sentidos, sem recarregar o documento, também no build com HashRouter. |
| Preservar os filtros de status e prioridade ao alternar | Busca, status e prioridade fora do padrão numa mesma troca chegam iguais à outra visão, com o mesmo conjunto de tarefas e o mesmo contador. |

## Revisão

Validei a mudança com revisões independentes de quatro agentes externos (muse, agy, Codex e Grok), além de revisão, auditoria visual e bateria de testes feitas por subagentes do Claude Code. Os achados aplicados:

- Barra final e maiúsculas deixavam o controle sem nenhuma visão marcada (todos os revisores).
- O foco se perdia ao trocar de visão pelo teclado, e o cenário de teclado da primeira versão da suíte chamava `.focus()` e não detectava isso.
- O ativo se distinguia quase só pela cor (contraste de 1,1:1 entre o fundo ativo e o inativo).
- Entre 778 e 931 px e em 320 px, "Nova tarefa" caía sozinho numa linha; no mobile, controle e botão tinham alturas diferentes.
- O anel de foco de um link invadia o vizinho.
- A suíte não cobria os três filtros juntos, a ficha sobre a lista nem o HashRouter, e não esperava os servidores encerrarem.

Ficaram de fora, por serem anteriores a esta issue:

- O `App.tsx` aceita fundo de ficha só para `/quadro` exato; uma ficha aberta a partir de `/quadro/` fecha na lista.
- No mobile, a regra `.e-tools{display:flex}` perto da linha 358 de `App.css` anula o grid de `.e-task-tools`, então os `grid-column`/`grid-row` dessa faixa não têm efeito.

## Falhas encontradas e correções

- `tests/quadro-filtros.cjs` falhava de forma intermitente (cerca de 2 em 5), também no `main`, na asserção de `/quadro` depois de fechar a ficha. A causa é do teste: o dialog sai do DOM antes do `history.back()` terminar, e a URL era lida na hora. Troquei as quatro leituras por `page.waitForURL`. Depois disso, 5 de 5 execuções passaram.
- Em 700 px, os filtros de largura fixa empurravam o botão para outra linha mesmo com a busca isolada. Os filtros passaram a encolher até 110 px cada nessa faixa.
- Para confirmar que o cenário de teclado detecta a perda de foco, desliguei temporariamente a devolução do foco: a suíte falhou no `waitForFunction`. Restaurei o código e ela voltou a passar.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado; `oxlint --deny-warnings` sem avisos. |
| `node tests/alternar-visao.cjs` | 9 cenários aprovados; 5 de 5 execuções. |
| `node tests/quadro-filtros.cjs` | 8 cenários aprovados; 5 de 5 execuções. |
| `node tests/estado-filtros.cjs` | 6 cenários aprovados. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |
