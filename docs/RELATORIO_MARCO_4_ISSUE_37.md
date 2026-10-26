# Relatório de execução — Marco 4 / issue #37

Data da execução: 25/10/2026.

## Escopo e ponto de partida

Implementei a [issue #37 — Centralizar o estado de busca e filtros](https://github.com/aggak/pixel-dfe/issues/37), atribuída ao meu usuário e correspondente à issue 26 do enunciado. Parti da `main` no commit `c330eeb`, que já continha a busca por título da #35 e os filtros de status e prioridade da #36.

Segui o enunciado dos marcos, o material da Aula 12 (estado compartilhado e visão de quadro) e o guia técnico do Marco 4. Até aqui, busca e filtros eram `useState` dentro de `ListaTarefas`: o estado morria com a rota e não podia ser lido pelo quadro da #38.

## Registro de execução

1. Conferi a atribuição da issue, o estado da `main` e as convenções do Marco 3: a regra `react/only-export-components` do `.oxlintrc.json` e a separação entre `ficha-contexto.ts` e `Ficha.tsx`.
2. Criei `src/derivar.ts` com o tipo de tela `Filtros`, os valores iniciais e a função pura `filtrarTarefas`, sem importar React e sem alterar `src/tipos.ts`. A regra de filtragem é a mesma que a #36 aplicava dentro da página.
3. Separei o contexto do componente, no mesmo padrão da ficha: `filtros-contexto.ts` exporta `ContextoFiltros` e o hook `useFiltros`; `FiltrosProvider.tsx` exporta apenas o provedor. As mudanças passam por funções com nome, `alterar(parcial)` e `limpar()`.
4. Montei o `FiltrosProvider` em `src/main.tsx`, dentro do roteador e acima de `App`. Assim ele funciona com `BrowserRouter` e com `HashRouter` (GitHub Pages) e não é desmontado quando a rota de fundo é recriada pela ficha.
5. Extraí o campo de busca e os dois seletores para `FiltrosTarefas.tsx`, ligados ao estado compartilhado. A estrutura e as classes do DOM continuam as mesmas da #36, o que preserva o layout e o teste `busca-titulo.cjs`. O quadro da #38 reutiliza esse componente.
6. Em `ListaTarefas.tsx`, troquei os três `useState` por `useFiltros()` e calculo `tarefasExibidas` com `useMemo(() => filtrarTarefas(tarefas, filtros))`, sem `useEffect`, como pede a Aula 12. A mensagem "Nenhuma tarefa encontrada." ganhou o botão **Limpar busca e filtros**, que usa `limpar()`.
7. Criei a suíte `tests/estado-filtros.cjs` e repeti as suítes dos Marcos 2 e 3.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/derivar.ts` | Tipo `Filtros`, `FILTROS_INICIAIS` e função pura `filtrarTarefas`. |
| `src/components/filtros-contexto.ts` | `ContextoFiltros`, tipo do valor e hook `useFiltros`, com erro claro fora do provedor. |
| `src/components/FiltrosProvider.tsx` | Estado único com `alterar` e `limpar` estáveis (`useCallback`) e valor memorizado (`useMemo`). |
| `src/components/FiltrosTarefas.tsx` | Busca e seletores de status e prioridade ligados ao estado compartilhado. |
| `src/main.tsx` | `FiltrosProvider` entre o roteador e `App`. |
| `src/pages/ListaTarefas.tsx` | Lista derivada do estado compartilhado e botão de limpeza no resultado vazio. |
| `src/App.css` | Espaçamento da mensagem de resultado vazio com o botão. |
| `tests/estado-filtros.cjs` | Suíte de navegador com API real e banco temporário. |

Não adicionei dependências ao `package.json`. Usei `createContext`, `useContext`, `useState`, `useCallback` e `useMemo` do React 19, que dispensa o `.Provider` no contexto.

## Decisão sobre onde o estado mora

A Aula 12 compara três lugares. Escolhi o provedor acima das rotas: busca e filtros sobrevivem à troca entre lista, projetos e quadro, mas recomeçam ao recarregar a página. A URL também manteria o estado no F5, porém exigiria validar texto vindo da query string e levar a query em todos os links do menu. O material pede um lugar só, nunca store e URL alterados por caminhos diferentes; por isso não usei os dois.

## Critérios da issue

| Critério | Resultado |
| --- | --- |
| Centralizar o texto de busca, o status e a prioridade | Os três campos ficam em um único `useState<Filtros>` no `FiltrosProvider`. |
| Lista e quadro usam o mesmo estado | A lista lê `useFiltros()`. O quadro da #38 lê o mesmo hook e a mesma `filtrarTarefas`. |
| As duas visões apresentam o mesmo conjunto filtrado | A função é única e pura. A conferência entre lista e quadro em navegador está na suíte da #38. |

## Falhas encontradas e correções

- Na primeira execução de `tests/busca-titulo.cjs`, o json-server não respondeu dentro de 10 s, o limite da suíte. Iniciei a API manualmente com uma cópia do `db.seed.json` e ela respondeu normalmente; repeti a suíte e ela passou. Foi demora na primeira partida dos servidores, não falha da aplicação. Na suíte nova, deixei o limite de espera em 30 s.
- No cenário da ficha de detalhe, o localizador `getByRole("dialog")` encontrou dois elementos: a ficha e o popover do seletor de prioridade, que ainda fazia a animação de saída. Restringi o localizador ao nome **Detalhes da tarefa** e passei a esperar o fechamento da opção escolhida, como faz `tests/ui.cjs`.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado, sem erros e sem avisos. |
| `node tests/estado-filtros.cjs` | 6 cenários aprovados. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |

A suíte `estado-filtros.cjs` verifica:

1. A lista mostra exatamente o conjunto que a busca e o status produzem sobre o `db.seed.json`.
2. Ir para **Projetos** pelo menu desmonta a lista; ao voltar, busca, status e cartões continuam iguais.
3. Depois de visitar a página de um projeto, um novo filtro de prioridade se combina com os anteriores.
4. Abrir e fechar a ficha de detalhe não altera busca nem filtros.
5. **Limpar busca e filtros** volta os três campos aos valores iniciais e mostra todas as tarefas.
6. Recarregar a página reinicia os filtros, como esperado para estado em memória.

Ao final, a suíte confere que `db.json`, `db.seed.json` e `src/tipos.ts` não mudaram e que não houve erro JavaScript não tratado.

## Como repetir as verificações

Com Node.js 24 ou superior:

```powershell
npm ci
npm run build
npm run lint
npm install --no-save --package-lock=false playwright
node tests/estado-filtros.cjs
node tests/busca-titulo.cjs
node tests/marco-2.cjs
```

As suítes de navegador usam o Google Chrome instalado (ou o canal definido em `TEST_BROWSER`), sobem os próprios servidores em portas livres e gravam apenas em uma cópia temporária do banco. A suíte do Marco 2 precisa das portas 3100 e 4174 livres.

## Commits

- `Centraliza busca e filtros em um provedor acima das rotas`: derivação pura, contexto, provedor, componente de filtros e integração na lista.
- `Testa a permanência de busca e filtros entre rotas`: suíte `tests/estado-filtros.cjs`.
- `Documenta a implementação da issue 37`: este relatório.

## Limites

- O estado não sobrevive ao F5 nem vai junto em um link copiado, porque não está na URL. Essa foi a escolha descrita acima.
- A navegação entre lista e quadro é da #39 e a mudança de status pelo cartão é da #40. Esta entrega só oferece o estado que elas vão usar.
- As páginas de projeto continuam mostrando todas as tarefas do projeto, sem aplicar busca e filtros, como antes.
