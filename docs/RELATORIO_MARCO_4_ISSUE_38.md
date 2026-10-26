# Relatório de execução — Marco 4 / issue #38

Data da execução: 25/10/2026.

## Escopo e ponto de partida

Implementei a [issue #38 — Criar a visão de quadro](https://github.com/aggak/pixel-dfe/issues/38), atribuída ao meu usuário e correspondente à issue 27 do enunciado. A branch `issue-38-visao-de-quadro` parte da `issue-37-estado-busca-filtros` (commit `199b544`), porque o quadro lê o estado compartilhado criado na #37. Por isso, o PR desta issue deve ser integrado depois do PR da #37.

Segui o enunciado dos marcos, o material da Aula 12 (slides 15 a 21) e o guia técnico do Marco 4. A issue pede a rota `/quadro`, uma coluna por status do contrato e os cartões agrupados na coluna correspondente.

## Registro de execução

1. Acrescentei a `src/derivar.ts` a lista fixa `STATUS`, o tipo `ColunaStatus` e a função pura `agruparPorStatus`. Ela usa `STATUS.map`, e não `Object.groupBy`: o `groupBy` perderia as colunas sem tarefas e não compila com o `lib` ES2023 do `tsconfig.app.json`, como mostra a Aula 12.
2. Adicionei ao `CartaoTarefa` a propriedade opcional `variante` (`"lista"` por padrão). No quadro, o cartão usa a classe `e-card`, destaca tarefas abertas de prioridade alta (`e-card-high`) e atenua as concluídas (`e-card-done`). As etiquetas trocam de ordem: prioridade à esquerda e status à direita. Links de detalhe e menu de edição continuam iguais.
3. Escrevi o CSS de `.e-board`, `.e-column` e `.e-card` em `src/App.css`, com quatro colunas no desktop, duas até 850 px e uma até 650 px.
4. Criei `src/pages/QuadroTarefas.tsx`. A página busca as tarefas na API como a lista, lê `useFiltros()`, aplica `filtrarTarefas` e depois `agruparPorStatus`, os dois em `useMemo`. O cabeçalho reutiliza `FiltrosTarefas` da #37, então busca e filtros do quadro alteram o mesmo estado da lista. Cada coluna mostra ícone, nome, contador e "Nenhuma tarefa" quando está vazia; os cartões usam o `id` como chave.
5. Registrei `/quadro` dentro do `Layout` em `src/App.tsx` e incluí `/quadro` entre as rotas de fundo aceitas pela ficha. Assim, detalhe, edição e nova tarefa abrem sobre o quadro. Fechar uma nova tarefa aberta no quadro volta para `/quadro`.
6. Em `NovaTarefa.tsx`, a tarefa criada a partir do quadro volta para `/quadro`. Nos outros casos, o retorno à lista continua como antes.
7. Criei `tests/quadro-filtros.cjs`, conferi capturas em 1280 px e 320 px e repeti todas as suítes do projeto.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/derivar.ts` | `STATUS`, `ColunaStatus` e `agruparPorStatus`. |
| `src/components/CartaoTarefa.tsx` | Variante `quadro`, classes de destaque e ordem das etiquetas. |
| `src/App.css` | Quadro, colunas e cartões, com três larguras de grade. |
| `src/pages/QuadroTarefas.tsx` | Página do quadro com estados de carregando, erro, banco vazio e busca sem resultado. |
| `src/App.tsx` | Rota `/quadro` e quadro aceito como fundo da ficha. |
| `src/pages/NovaTarefa.tsx` | Retorno a `/quadro` depois de salvar uma tarefa criada no quadro. |
| `tests/quadro-filtros.cjs` | Suíte de navegador com API real e banco temporário. |

Não adicionei dependências. Reaproveitei `Badge`, `Button`, `Icon`, `statusTexto`, `listarTarefas`, `listarProjetos`, `useConsulta`, `AbasProjetos`, `Carregando` e `EstadoVazio`. Não alterei `src/tipos.ts`, `db.json` nem `db.seed.json`.

## Critérios da issue

| Critério | Resultado |
| --- | --- |
| Criar a rota `/quadro` | A rota abre por acesso direto e por recarga, dentro do layout comum. |
| Uma coluna para cada status do contrato | Sempre quatro colunas, na ordem A fazer, Em andamento, Em revisão e Concluída, também quando os filtros esvaziam três delas. |
| Agrupar os cartões na coluna do status | Cada tarefa do `db.seed.json` aparece uma única vez, na coluna do seu `status`, e o contador do cabeçalho confere. |

## Falhas encontradas e correções

- Ao rodar a suíte nova pela primeira vez, o `require("playwright")` falhou: o pacote instalado com `--no-save` tinha saído do `node_modules`. Reinstalei com o mesmo comando e repeti as suítes. Não houve mudança no código.
- A primeira versão da suíte terminava com "9 cenários aprovados", mas imprimia oito linhas de cenário. Corrigi a contagem para 8, com a conferência final de erros e bancos à parte, como nas outras suítes.
- Na primeira versão de `App.tsx`, o comentário sobre o retorno ao quadro ficou no meio da expressão de `destinoFechar`. Movi o comentário para a linha anterior antes do commit.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado; `oxlint --deny-warnings` sem avisos. |
| `node tests/quadro-filtros.cjs` | 8 cenários aprovados. |
| `node tests/estado-filtros.cjs` | 6 cenários aprovados. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |
| `git diff --check` | Aprovado. |

A suíte `quadro-filtros.cjs` verifica:

1. `/quadro` abre com as quatro colunas na ordem do contrato.
2. Cada tarefa aparece uma vez na coluna do seu status, com título clicável, `data-task-id` e contador correto.
3. Com o filtro **A fazer**, as outras três colunas continuam na tela com "Nenhuma tarefa".
4. Busca e status escolhidos no quadro aparecem na lista, com os mesmos cartões. Uma prioridade escolhida na lista aparece no quadro, com o mesmo conjunto.
5. Uma busca sem resultado mantém as colunas, e **Limpar busca e filtros** restaura o quadro.
6. O detalhe abre na ficha sobre o quadro. Editar o status para **Em revisão** grava na API, o cartão muda de coluna e fechar a ficha mantém `/quadro`.
7. Fechar uma nova tarefa sem salvar volta para `/quadro`. Ao salvar uma tarefa **Concluída**, a ficha volta para `/quadro` e o cartão aparece na coluna certa.
8. Recarregar mantém a rota. A grade tem 4, 2 e 1 colunas em 1280, 800 e 320 px, sem rolagem horizontal.

Ao final, a suíte confere que não houve erro JavaScript não tratado e que `db.json`, `db.seed.json` e `src/tipos.ts` não mudaram. As gravações ocorrem em uma cópia temporária do `db.seed.json`.

A ligação entre lista e quadro pelo menu é da #39. Por isso, a suíte troca de rota com `history.pushState` e um evento `popstate`. É a mesma navegação interna do roteador, sem recarregar o documento e sem desmontar o `FiltrosProvider`.

## Como repetir as verificações

Com Node.js 24 ou superior:

```powershell
npm ci
npm run build
npm run lint
npm install --no-save --package-lock=false playwright
node tests/quadro-filtros.cjs
node tests/estado-filtros.cjs
```

As suítes usam o Google Chrome instalado (ou o canal de `TEST_BROWSER`) e sobem os próprios servidores em portas livres. Para salvar capturas do quadro em 1280 px e 320 px, defina `QUADRO_EVIDENCIAS` com uma pasta existente.

Para conferir manualmente, siga o README: `npx json-server db.json` em um terminal, `npm run dev` em outro e abra `http://localhost:5173/quadro`. Mudanças feitas pela ficha gravam no `db.json`.

## Commits

- `Agrupa tarefas por status e adapta o cartão ao quadro`: derivação por status, variante do cartão e CSS.
- `Cria a visão de quadro na rota /quadro`: página, rota, fundo da ficha e retorno da nova tarefa.
- `Testa o quadro por status e o estado compartilhado com a lista`: suíte `tests/quadro-filtros.cjs`.
- `Documenta a implementação da issue 38`: este relatório.

## Limites

- O menu principal ainda não tem link para `/quadro`, e nenhum item do menu fica marcado nessa rota. A alternância entre as visões é da #39 (Linnek).
- O status muda pela ficha de edição. O seletor ou botão no próprio cartão é da #40. Como as colunas são recalculadas a partir do campo `status`, o cartão vai mudar de coluna sem outra alteração no quadro.
- Arrastar e soltar é o desafio opcional da issue 46 do enunciado e não faz parte desta entrega.
- A aba **Todas** fica marcada no quadro porque o quadro mostra as tarefas de todos os projetos. Ao clicar nela, o usuário vai para a lista em `/`.
