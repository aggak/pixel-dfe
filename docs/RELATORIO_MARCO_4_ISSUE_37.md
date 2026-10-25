# Relatório de execução — Marco 4 / issue #37 / Euclides

Data da verificação: 25/10/2026.

## Escopo e ponto de partida

Implementei a [issue #37 — Centralizar o estado de busca e filtros](https://github.com/aggak/pixel-dfe/issues/37). Parti da `main` no commit `c330eeb`, que já continha a busca por título da #35 e os filtros de status e prioridade da #36, ambos entregues pela Gabriela. Nessa base, os três valores ficavam no estado de `ListaTarefas`: ao trocar de rota, ou quando a `key` de `App.tsx` remontava as páginas depois de uma edição, a busca e os filtros voltavam às opções gerais.

O objetivo foi manter um único estado de busca e filtros, com a mesma regra de filtragem para a lista e para o quadro da #38.

## Registro de execução

1. Conferi em `App.tsx` que as rotas de fundo são remontadas pela `key` baseada em `chaveConteudo`. Por isso, o estado precisava ficar acima de `App`, e não dentro de uma página.
2. Extraí a regra de filtragem para `filtrarTarefas`, sem mudar o critério já entregue: termo sem espaços nas extremidades, comparação em minúsculas com `pt-BR`, trecho do título com `includes`, e status e prioridade combinados.
3. Criei um contexto React com o hook `useFiltros` e o `FiltrosProvider`, registrado em `main.tsx` em volta de `App`.
4. Reuni a busca e os dois seletores em `ControlesFiltro`, com o mesmo DOM e as mesmas classes de antes, para não alterar o layout da faixa de ações.
5. Passei `ListaTarefas` a consumir o estado compartilhado.

## Estrutura utilizada

| Arquivo | Alteração e responsabilidade |
| --- | --- |
| `src/derivar.ts` | Tipo `Filtros`, valores iniciais e `filtrarTarefas`, a regra única usada pelas visões de tarefas. |
| `src/contexts/filtros-contexto.ts` | Contexto e hook `useFiltros`, que falha com mensagem clara fora do provider. |
| `src/contexts/FiltrosProvider.tsx` | Estado compartilhado e `alterar(parcial)`, que atualiza só os campos informados. |
| `src/components/ControlesFiltro.tsx` | Busca e seletores de status e prioridade, reaproveitando `Input`, `Select` e os textos de `formatos.ts`. |
| `src/pages/ListaTarefas.tsx` | Deixou de guardar os três estados e passou a usar `useFiltros` e `filtrarTarefas`. |
| `src/main.tsx` | Registro do `FiltrosProvider` acima das rotas. |
| `tests/filtros-compartilhados.cjs` | Nova suíte de navegador para a preservação dos filtros. |

Não adicionei dependências. Usei React Context, já disponível no projeto. A persistência após recarregar a página não está nos critérios da issue; por isso, ao recarregar, os controles voltam às opções gerais, e a suíte confere esse comportamento.

## Falhas encontradas e correções

Não encontrei falha funcional na implementação. Para confirmar que a suíte nova detecta o problema original, executei-a com `src/main.tsx` e `src/pages/ListaTarefas.tsx` da `main`: ela falhou no primeiro cenário, porque a busca voltou vazia depois de ir a **Projetos** e voltar para **Tarefas**. Com a mudança, os 7 cenários passaram.

## Critérios da issue

| Critério | Evidência e situação |
| --- | --- |
| Centralizar o texto de busca, o status e a prioridade selecionados. | Atendido: os três valores ficam no `FiltrosProvider`, acima das rotas. |
| Fazer a lista e o quadro usarem esse mesmo estado. | Atendido em conjunto com a #38: a lista consome o estado nesta branch, e o quadro o consome em `codex/issue-38-visao-quadro`. |
| Conferir que as duas visões apresentam o mesmo conjunto filtrado de tarefas. | Atendido em conjunto com a #38: `tests/quadro.cjs` compara os IDs exibidos na lista e no quadro em oito combinações de busca e filtros. |

## Validação e resultados

Estado testado: branch `codex/issue-37-estado-compartilhado-filtros`, commit `1c5ce10`.
Ambiente: Windows 11, Node 24.19.0, npm 11.17.0, Playwright 1.64.1 instalado temporariamente com `--no-save`, Google Chrome 155.

| Verificação | Resultado observado |
| --- | --- |
| `npm run build` | Aprovado. |
| `npm run lint` | Aprovado, sem avisos. |
| `node tests/filtros-compartilhados.cjs` | 7 cenários aprovados: menu, abas de projeto, botão Voltar, abrir e fechar a ficha, edição com recarga dos dados, limpeza dos controles e recarga da página. |
| A mesma suíte com o código da `main` | Falhou como esperado no primeiro cenário. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |

As suítes de navegador usaram uma cópia temporária de `db.seed.json`. A suíte nova confere ao final que o `db.json` do repositório não mudou.

## Commits e integração

| Commit | Entrega |
| --- | --- |
| `e57ed63` | `feat: centraliza busca e filtros em estado compartilhado (#37)` |
| `1c5ce10` | `test: confere filtros preservados entre rotas e fichas (#37)` |

Situação da issue em 25/10/2026: aberta. A branch foi publicada para revisão; o PR deve usar `Relacionado à #37`, e o fechamento fica com o PR da #38, onde o quadro valida o último critério.

## Como repetir as verificações

```powershell
npm ci
npm install --no-save --package-lock=false playwright
npm run build
npm run lint
node tests/filtros-compartilhados.cjs
```

## Limites e dependências

- A comparação entre lista e quadro depende da #38 e foi executada na branch dela.
- A alternância entre as visões pelo menu pertence à #39.
- Os filtros não persistem após recarregar a página, pois isso não está nos critérios.
- A suíte cobre Chrome em 1280 px; não percorre outros navegadores.

## Referências

- [Issue #37](https://github.com/aggak/pixel-dfe/issues/37)
- [Relatório da issue #36](RELATORIO_MARCO_4_ISSUE_36.md)
