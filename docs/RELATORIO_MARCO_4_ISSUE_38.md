# Relatório de execução — Marco 4 / issue #38 / Euclides

Data da verificação: 25/10/2026.

## Escopo e ponto de partida

Implementei a [issue #38 — Criar a visão de quadro](https://github.com/aggak/pixel-dfe/issues/38). Parti da branch `codex/issue-37-estado-compartilhado-filtros`, que já continha o estado compartilhado de busca e filtros e a regra `filtrarTarefas` da #37. A dependência é intencional: o quadro precisa consumir o mesmo estado da lista.

O objetivo foi apresentar as tarefas na rota `/quadro`, com uma coluna para cada status do contrato e os cartões agrupados pelo status depois da aplicação dos filtros.

## Registro de execução

1. Criei `agruparPorStatus` a partir de uma lista fixa `STATUS`, na ordem do contrato, para que colunas sem tarefas nunca desapareçam.
2. Adicionei a `variante="coluna"` ao `CartaoTarefa`. A variante padrão continua sendo a linha, então a lista e a página do projeto não mudam.
3. Criei a página `QuadroTarefas`, com os mesmos controles da lista e os estados de carregamento, erro, ausência de tarefas e busca sem resultado.
4. Registrei a rota `/quadro` em `App.tsx` e incluí `/quadro` entre as origens aceitas para as fichas, para que detalhes e edição abertos pelo quadro voltem a ele.
5. Escrevi os estilos em `App.css` e conferi o visual em 1280 px, 375 px e no tema escuro.
6. Escrevi a suíte `tests/quadro.cjs`, que também valida o último critério da #37.

## Estrutura utilizada

| Arquivo | Alteração e responsabilidade |
| --- | --- |
| `src/derivar.ts` | `STATUS` e `agruparPorStatus`, ao lado de `filtrarTarefas`. |
| `src/components/CartaoTarefa.tsx` | Propriedade `variante` (`"linha"` ou `"coluna"`). Na coluna, o cartão usa a classe `e-card` e omite o selo de status. |
| `src/pages/QuadroTarefas.tsx` | Página do quadro: consulta as tarefas e projetos, aplica `filtrarTarefas` com `useFiltros` e desenha as quatro colunas com contador. |
| `src/App.tsx` | Rota `/quadro` e aceitação do quadro como fundo das fichas. |
| `src/App.css` | Classes `e-board*` e `e-card`: quatro colunas no desktop, duas até 1000 px e uma até 650 px. |
| `tests/quadro.cjs` | Nova suíte de navegador do quadro e da comparação com a lista. |

Reutilizei `CartaoTarefa`, `ControlesFiltro`, `AbasProjetos`, `Carregando`, `EstadoVazio`, `useConsulta`, `listarTarefas` e os textos de `formatos.ts`. Não adicionei dependências nem alterei o contrato de dados.

## Decisões para revisão

- Não há link no menu para `/quadro`, porque a alternância entre as visões é escopo da #39. Por enquanto, o quadro abre pela URL.
- O cartão no quadro não mostra o selo de status, já que a coluna informa isso.
- Uma tarefa criada a partir do quadro volta para a lista, que é o comportamento atual de `NovaTarefa`. Mudar esse retorno ficou fora desta entrega.

## Falhas encontradas e correções

| Situação encontrada | Correção | Resultado verificado |
| --- | --- | --- |
| Na primeira execução de `tests/quadro.cjs`, a combinação com o termo `o`, **A fazer** e **Média** não retornou tarefas, e a suíte esperava apenas uma combinação vazia. | O erro estava no dado do teste: o título "Listar as tarefas na tela" não contém `o`. Troquei o termo por `tela`. A lista e o quadro já mostravam os mesmos IDs nessa combinação. | 11 cenários aprovados. |

Não encontrei falha na aplicação.

## Critérios da issue

| Critério | Evidência e situação |
| --- | --- |
| Criar a rota `/quadro`. | Atendido: acesso direto testado. |
| Disponibilizar uma coluna para cada status definido no contrato. | Atendido: quatro colunas na ordem do contrato, mantidas mesmo quando vazias. |
| Agrupar os cartões de tarefa na coluna correspondente ao status. | Atendido: a suíte compara a coluna de cada cartão com o status gravado na API e confere que cada tarefa aparece uma única vez. |

Esta branch também valida o terceiro critério da [#37](https://github.com/aggak/pixel-dfe/issues/37): a lista e o quadro exibem os mesmos IDs em oito combinações de busca e filtros.

## Validação e resultados

Estado testado: branch `codex/issue-38-visao-quadro`. O código testado é o mesmo do commit `8533bb0`; depois da execução, a branch só foi reposicionada sobre o commit do relatório da #37, sem mudança de código.
Ambiente: Windows 11, Node 24.19.0, npm 11.17.0, Playwright 1.64.1 instalado temporariamente com `--no-save`, Google Chrome 155.

| Verificação | Resultado observado |
| --- | --- |
| `npm run build` | Aprovado. |
| `npm run lint` | Aprovado, sem avisos. |
| `node tests/quadro.cjs` | 11 cenários aprovados. |
| `node tests/filtros-compartilhados.cjs` | 7 cenários aprovados. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |
| Capturas em 1280 px, 375 px e tema escuro | Quatro colunas lado a lado no desktop e empilhadas no celular, sem rolagem horizontal. |

Cenários de `tests/quadro.cjs`:

1. Acesso direto a `/quadro` com quatro colunas na ordem do contrato.
2. Cada tarefa aparece uma vez, na coluna do seu status, com contadores e rodapé corretos.
3. Colunas vazias continuam visíveis.
4. Busca sem resultado mostra **Nenhuma tarefa encontrada.**
5. Lista e quadro exibem os mesmos IDs em oito combinações de filtros, com os filtros preservados entre as duas rotas.
6. A ficha aberta pelo quadro volta para o quadro, com o foco no título da tarefa.
7. A edição pelo cartão move a tarefa para a nova coluna e grava o status na API.
8. O cartão do quadro omite o selo de status, e a lista e o projeto mantêm o selo.
9. Larguras de 1000 px e 375 px sem rolagem horizontal.
10. Carregamento e falha da API, com a requisição retida e depois abortada.
11. Sem tarefas cadastradas, o quadro mostra o estado vazio.

As suítes usaram uma cópia temporária de `db.seed.json`, e a falha e a lista vazia foram simuladas por interceptação de rede. `db.json` e `db.seed.json` permaneceram intactos.

## Commits e integração

| Commit | Entrega |
| --- | --- |
| `49fa3b1` | `feat: agrupa tarefas por status na ordem do contrato (#38)` |
| `7306066` | `feat: apresenta tarefas em colunas por status (#38)` |
| `41d171e` | `feat: adiciona a rota /quadro e o quadro como origem das fichas (#38)` |
| `8533bb0` | `test: compara tarefas filtradas na lista e no quadro (#38)` |

Situação da issue em 25/10/2026: aberta. A branch foi publicada para revisão e depende da branch da #37. Com o quadro validado, o PR desta branch pode usar `Closes #38` e `Closes #37`.

## Como repetir as verificações

```powershell
npm ci
npm install --no-save --package-lock=false playwright
npm run build
npm run lint
node tests/quadro.cjs
node tests/filtros-compartilhados.cjs
```

## Limites e dependências

- A navegação entre lista e quadro pelo menu pertence à #39.
- Alterar o status pelo cartão pertence à #40.
- Os testes usam Chrome. Não verifiquei outros navegadores, leitor de tela nem a publicação no GitHub Pages.

## Referências

- [Issue #38](https://github.com/aggak/pixel-dfe/issues/38)
- [Issue #37](https://github.com/aggak/pixel-dfe/issues/37)
- [Relatório da issue #37](RELATORIO_MARCO_4_ISSUE_37.md)
