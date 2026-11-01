# Relatório de execução — Marco 5 / issue #48

Data da execução: 01/11/2026.

## Escopo e ponto de partida

Implementei a [issue #48 — Auditar acessibilidade e responsividade](https://github.com/aggak/pixel-dfe/issues/48), atribuída ao meu usuário e correspondente à issue [37] do enunciado. Parti da branch `issue-47-falha-gravar-excluir` no commit `1e81d34`.

Fiz a auditoria do Lighthouse sobre o build de produção antes e depois das correções, nos temas claro e escuro, no celular e no computador. Também conferi com Playwright a navegação por teclado, o foco visível e o uso em telas de até 320 px. Corrigi os problemas encontrados e transformei as verificações em testes que podem ser repetidos.

## Registro de execução

1. Criei `tests/auditoria-lighthouse.mjs`. O script gera um build de produção numa pasta temporária, com a API temporária embutida e sem tocar no `dist/` do projeto. Em seguida, sobe o json-server com uma cópia de `db.seed.json`, serve o build com `vite preview` e roda o Lighthouse 13.6.0 (só a categoria de acessibilidade) por `npx`. Ele audita 7 telas (lista, quadro, projetos, projeto, detalhe da tarefa, nova tarefa e edição de projeto) nos perfis mobile e desktop e nos temas claro e escuro: 28 relatórios. A Pixel segue `prefers-color-scheme`. Forcei o tema escuro com `--blink-settings=preferredColorScheme=0` e confirmei a flag no Chrome headless antes de usá-la.
2. Rodei uma sondagem com Playwright em 8 rotas, 6 larguras e 2 temas. Ela mediu a rolagem horizontal, os elementos fora da tela e os alvos de toque, e percorreu cada tela com Tab conferindo o foco visível.
3. Registrei os achados e o escopo em `.agent/handoff/issue-atual.md`.
4. Escrevi `tests/acessibilidade-responsividade.cjs`. Os cenários de rolagem horizontal e de teclado passaram logo na primeira execução, porque o comportamento já era correto e a suíte o protege daqui em diante. Os cenários de contraste e de alvos de toque falharam. O contraste medido pelo teste foi 3,68:1, o mesmo valor do Lighthouse.
5. Corrigi o contraste e os alvos de toque em `src/App.css`, um cenário de cada vez. Comparei capturas de tela a 375 px antes e depois: o desenho se manteve, mas os controles do topo da lista ficaram mais altos. A busca e a troca Lista/Quadro passaram a 44 px, e a primeira tarefa desceu cerca de 19 px. Isso é consequência pretendida da regra de 44 px.
6. Rodei a suíte nova três vezes, as suítes da #46 e da #47, a validação completa e a auditoria do Lighthouse de novo.
7. A revisão final do branch apontou três fragilidades, que corrigi e registrei em "Falhas encontradas e correções".

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/App.css` | "opcional" sem `opacity:.8`; até 650 px, alvos de toque com pelo menos 44 px (logo, busca, filtros, Lista/Quadro, título do cartão de projeto, link do projeto no detalhe, "Voltar para tarefas"). Nos dois links em linha, a área de toque é um `::after` invisível. |
| `tests/acessibilidade-responsividade.cjs` | Nova suíte: transbordo (página e contêineres roláveis), teclado e foco (com cobertura de todos os elementos tabuláveis), contraste do achado, alvos de toque, anel de foco dos links ampliados e Enter/Esc na ficha. |
| `tests/auditoria-lighthouse.mjs` | Auditoria reproduzível do Lighthouse sobre o build de produção. |

### Dependências externas

| Dependência | Tipo | Adicionada ao `package.json`? | Uso |
| --- | --- | --- | --- |
| Playwright | Já presente em `node_modules` | Não | Suítes de navegador |
| Lighthouse 13.6.0 | `npx --yes lighthouse@13.6.0` (cache do npx) | Não | Auditoria de acessibilidade |
| Google Chrome | Instalado no sistema | Não | Navegador das suítes e do Lighthouse |

## Auditoria do Lighthouse (categoria acessibilidade)

| Tela | Antes: mobile claro / escuro | Antes: desktop claro / escuro | Depois: todas |
| --- | --- | --- | --- |
| Lista | 100 / 100 | 100 / 100 | 100 |
| Quadro | 100 / 100 | 100 / 100 | 100 |
| Projetos | 100 / 100 | 100 / 100 | 100 |
| Projeto | 100 / 100 | 100 / 100 | 100 |
| Detalhe da tarefa | 100 / 100 | 100 / 100 | 100 |
| Nova tarefa | **96** / 100 | **96** / 100 | 100 |
| Edição de projeto | 100 / 100 | 100 / 100 | 100 |

- **`color-contrast` (corrigido):** na ficha "Nova tarefa", tema claro, o "opcional" do botão "Adicionar descrição" tinha contraste de 3,68:1 (`#858389` sobre `#fdfdfd`, 10 px). A causa era `opacity:.8` aplicada sobre `--e-muted`. Sem a opacidade, o texto usa `--e-muted` puro, a mesma cor dos demais textos secundários, e passa de 4,5:1.
- **`label-content-name-mismatch` (analisado, mantido):** auditoria de peso 0, apontada nos 5 seletores de status da lista e do quadro, antes e depois. O nome acessível é "Mudar status de <título> (atual: <status>)", e o axe 4.14 descarta o trecho entre parênteses antes de procurar o texto visível. O nome contém o texto visível, o que atende ao WCAG 2.5.3. O formato também é exigido pelas suítes (`tests/status-cartao.cjs`) e pela regra do projeto que evita colisão com os filtros chamados "Status". Por isso não o alterei.

## Teclado, foco visível e telas pequenas

| Verificação | Antes | Depois |
| --- | --- | --- |
| Rolagem horizontal em 1280, 850, 800, 650, 375 e 320 px (10 rotas, 2 temas) | Nenhuma | Nenhuma |
| Elementos fora da tela fora de faixa rolável | Nenhum (as abas de projetos rolam na própria faixa) | Nenhum |
| Foco visível e na tela em todas as paradas do Tab (1280 e 375 px, 2 temas) | Sim | Sim |
| Tab alcança todos os elementos tabuláveis (sem armadilha) e, na ficha, não sai dela | Sim | Sim |
| Esc fecha a ficha e devolve o foco ao link | Sim | Sim |
| Alvos de toque ≥ 44 × 44 px em 375 e 320 px | Logo 36 px, busca 37, filtros 38, Lista/Quadro 38, título do cartão de projeto 23, link do projeto no detalhe 18, "Voltar para tarefas" 21 | Todos ≥ 44 px |

No título do cartão de projeto e no link do projeto no detalhe, a área de toque é um `::after` invisível (11 e 13 px acima e abaixo). O desenho e o anel de foco continuam sobre o texto. Os seletores de status já tinham uma área de 44 px por `::after`, e o teste a considera. A regra de 44 px segue a orientação do projeto e o critério 2.5.5 (AAA). O Lighthouse aplica o 2.5.8 (AA, 24 px), que já passava.

## Critérios da issue

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Executar a auditoria do Lighthouse. | 28 relatórios antes e 28 depois, sobre o build de produção. | `tests/auditoria-lighthouse.mjs` |
| Conferir navegação por teclado e foco visível. | Foco visível em todas as paradas, ficha com o foco preso, Enter/Esc. | `tests/acessibilidade-responsividade.cjs` |
| Conferir o uso da aplicação em tela pequena. | Sem rolagem horizontal até 320 px e com alvos de 44 px. | `tests/acessibilidade-responsividade.cjs` |
| Aplicar e verificar as correções identificadas na auditoria. | Contraste e alvos de toque corrigidos; Lighthouse 100 em todas as combinações. | Commits `7270c82` e `33ec66e`; auditoria repetida sobre `33ec66e` |

## Falhas encontradas e correções

- **Falhas reais corrigidas:** o contraste do "opcional" e os alvos de toque menores que 44 px no celular.
- **Falha introduzida e corrigida na revisão:** na primeira versão, ampliei esses dois links com padding e margem negativa. No celular, o anel de foco do título do cartão passava sobre a primeira linha da descrição. Passei a área de toque para o `::after`, e um cenário novo confere que o anel não cobre o texto vizinho (commit `33ec66e`).
- **Asserções fortalecidas na revisão (commit `91c9298`):**
  - O percurso de Tab só conferia o número de paradas e passaria com uma armadilha de quatro ou mais controles. Agora ele exige que todos os elementos tabuláveis do escopo tenham sido alcançados.
  - A checagem de elementos fora da tela isentava todo o conteúdo da ficha, porque o corpo dela tem `overflow-y:auto`. Agora qualquer contêiner rolável fora das abas de projetos falha se transbordar na horizontal.
  - Confirmei as duas asserções com mutações temporárias, não commitadas: uma armadilha de Tab e um campo de 520 px na ficha. Cada uma fez a suíte falhar.
- **Ajuste só de teste:** na primeira medição, a ficha aparecia com botões de 42 px. Eram os botões de 44 px medidos durante a animação de entrada, que escala de 95% para 100%. A função `abrir` da suíte passou a esperar o fim das animações finitas. Não houve mudança na aplicação.
- **Fora do escopo:** `label-content-name-mismatch`, explicado acima. Também não há link "pular para o conteúdo". O Lighthouse não o exigiu, porque a página tem `main`, `nav` e títulos, e o percurso de Tab alcançou todos os elementos tabuláveis em todas as telas.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado, sem erros e sem avisos. |
| `node tests/acessibilidade-responsividade.cjs` | 9 cenários e a checagem dos bancos aprovados; 3 de 3 execuções. |
| `node tests/registro-inexistente.cjs`, `node tests/falha-gravar-excluir.cjs` | Aprovados (regressões da #46 e da #47). |
| `node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs` | Aprovado: arquivos protegidos intactos, build, lint, `git diff --check` e as 15 suítes existentes. |
| `node tests/auditoria-lighthouse.mjs` | 28 de 28 combinações com nota 100, em `7270c82` e de novo em `33ec66e`. |

## Como repetir as verificações

```powershell
npm ci
npm run build
npm run lint
node tests/acessibilidade-responsividade.cjs
node tests/auditoria-lighthouse.mjs $env:TEMP\pixel-lighthouse
```

## Commits e limites

- Commits: `7270c82` (Corrige contraste e amplia alvos de toque no celular (#48)), `92c30bc` (Testa teclado, foco visível e telas pequenas (#48)), `bbbda03` (Adiciona a auditoria do Lighthouse sobre o build de produção (#48)), `91c9298` (Fortalece as verificações de teclado e de transbordo (#48)), `33ec66e` (Amplia o toque dos links em linha sem deslocar o anel de foco (#48)) — PR: `pendente`.
- Ordem dos commits: o commit da correção `7270c82` veio antes do commit da suíte `92c30bc`, mas a suíte foi escrita e vista falhando antes da correção.
- Limites: o Lighthouse avalia cada tela no estado inicial, sem menus abertos nem avisos de erro. Esses estados são cobertos pelas suítes de navegador, não pela nota. Não testei com leitor de tela real. A auditoria depende de rede para as fontes externas e, na primeira execução, para baixar o Lighthouse pelo `npx`.
- Observação: a issue #48 aparece como fechada no GitHub. Mantive a entrega apenas na branch local, sem alterar o estado da issue.