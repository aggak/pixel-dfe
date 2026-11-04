# Relatório de execução — Marco 5 / issue #46

Data da execução: 01/11/2026.

## Escopo e ponto de partida

Implementei a [issue #46 — Tratar tarefa ou projeto inexistente](https://github.com/aggak/pixel-dfe/issues/46), atribuída ao meu usuário e correspondente à issue [35] do enunciado. Parti da `main` no commit `85b3e00`. Nessa base, abrir `/tarefas/999`, `/tarefas/999/editar`, `/projetos/999` e `/projetos/999/editar` já encerrava o carregamento e mostrava a mensagem de não encontrado. Por isso concentrei a entrega nos registros que deixam de existir depois que a tela foi aberta, por exemplo quando outra aba ou outro colega os exclui. Nesses casos a aplicação mostrava um aviso genérico de "tente novamente", e tentar de novo nunca funcionava.

## Registro de execução

1. Antes de alterar o código, rodei uma sondagem com o json-server real e um banco temporário. Ela confirmou o tratamento das quatro rotas e encontrou quatro lacunas: excluir uma tarefa já excluída, mudar o status de uma tarefa excluída, salvar a edição de uma tarefa ou de um projeto excluídos e abrir uma tarefa cujo projeto não existe.
2. Registrei o escopo, os arquivos autorizados, os textos e os cenários em `.agent/handoff/issue-atual.md`, um arquivo local que não entra no repositório.
3. Escrevi primeiro `tests/registro-inexistente.cjs`. Os cenários das quatro rotas passaram logo na primeira execução porque descrevem um comportamento que já existia. O primeiro cenário novo falhou porque o diálogo de exclusão continuava aberto.
4. Criei `excluirTarefaSeExistir` em `src/api.ts`. Para a tela, uma resposta 404 na exclusão quer dizer que a tarefa já não existe, ou seja, o pedido do usuário já foi atendido. `excluirTarefa` continua rejeitando o 404, como exige `tests/api-escrita.mjs`. A lista, o quadro e a página do projeto passaram a usar a nova função.
5. Em `CartaoTarefa`, uma resposta 404 ao mudar o status agora mostra "Esta tarefa não existe mais. Ela pode ter sido excluída." no lugar de "Tente de novo".
6. Em `FormularioTarefa` e `FormularioProjeto`, uma resposta 404 ao salvar agora mostra que o registro não existe mais e confirma que os dados digitados foram mantidos. As outras falhas continuam com a mensagem anterior.
7. Em `DetalheTarefa`, quando a lista de projetos já carregou e o projeto da tarefa não está nela, a ficha mostra "Projeto não encontrado" sem link. Se a lista de projetos falhar, o link com o identificador continua, como antes.
8. Rodei cada cenário até passar, depois a suíte inteira três vezes seguidas e por fim a validação completa.
9. Na revisão das entregas, apareceu um defeito no passo 6: um 404 ao **criar** tarefa ou projeto (`POST /tarefas` ou `POST /projetos`) também mostrava "não existe mais", para um registro que nunca existiu. Escrevi dois cenários com o `POST` respondido com 404. O de tarefa falhou mostrando "Esta tarefa não existe mais". Então acrescentei a prop opcional `edicao` aos dois formulários, passada só por `EditarTarefa` e `EditarProjeto`. Não usei `valoresIniciais` para distinguir edição, porque o cadastro de tarefa também o recebe (`{ projetoId }`, vindo de `?projetoId=`).

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/api.ts` | Nova função `excluirTarefaSeExistir`; `excluirTarefa` mantém o contrato. |
| `src/pages/ListaTarefas.tsx`, `src/pages/QuadroTarefas.tsx`, `src/pages/DetalheProjeto.tsx` | Exclusão por `excluirTarefaSeExistir`. |
| `src/components/CartaoTarefa.tsx` | Aviso próprio para o status de uma tarefa inexistente. |
| `src/components/FormularioTarefa.tsx`, `src/components/FormularioProjeto.tsx` | Aviso próprio para a gravação de um registro inexistente, só na edição (prop `edicao`); os campos são preservados. |
| `src/pages/EditarTarefa.tsx`, `src/pages/EditarProjeto.tsx` | Passam `edicao` ao formulário. |
| `src/pages/DetalheTarefa.tsx` | Projeto inexistente aparece sem link quebrado. |
| `tests/registro-inexistente.cjs` | Nova suíte de navegador com 13 cenários e a checagem final dos bancos. |

### Dependências externas

| Dependência | Tipo | Adicionada ao `package.json`? | Uso |
| --- | --- | --- | --- |
| Playwright | Já presente em `node_modules` | Não | Suítes de navegador |

## Critérios da issue

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Conferir o acesso a `/tarefas/999` e `/projetos/999`. | Conferido também em `/tarefas/999/editar` e `/projetos/999/editar`. | `tests/registro-inexistente.cjs`, quatro primeiros cenários |
| Mostrar uma mensagem de não encontrado para registros inexistentes. | Mensagens nas rotas e também no status, na gravação e no projeto de uma tarefa órfã. | `tests/registro-inexistente.cjs` |
| Encerrar o carregamento, sem deixar a indicação ativa indefinidamente. | Nenhum `role="status"` fica ativo depois do 404, inclusive com resposta atrasada em 600 ms. | Cenário "resposta lenta com 404" |

## Falhas encontradas e correções

- **Falhas reais corrigidas:** excluir uma tarefa já excluída deixava o diálogo aberto com um erro permanente. Mudar o status ou salvar a edição de um registro excluído sugeria tentar de novo, o que nunca funcionaria. A tarefa órfã levava a um link que abria uma página de não encontrado.
- **Falha introduzida e corrigida na revisão:** minha primeira versão tratava qualquer 404 ao salvar como registro excluído, inclusive na criação. Agora o cadastro mostra "Não foi possível salvar a tarefa/o projeto. Seus dados foram mantidos; tente novamente." e preserva o que foi digitado (commit `508450f`).
- **Ajuste só de teste:** na primeira versão, o cenário `/projetos/999/editar` conferia a ausência de carregamento assim que surgia o primeiro aviso. A ficha respondia antes da página de fundo, que ainda carregava. Passei a esperar os dois avisos antes da checagem. Não houve mudança na aplicação.
- **Fora do escopo:** a lista de tarefas não mostra o nome do projeto de uma tarefa órfã, o que já acontecia antes, e a interface não oferece exclusão de projetos.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado, sem erros e sem avisos. |
| `node tests/registro-inexistente.cjs` | 13 cenários e a checagem dos bancos aprovados; 3 de 3 execuções, também depois da correção da revisão. |
| `node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs` | Aprovado: arquivos protegidos intactos, build, lint, `git diff --check` e as 15 suítes existentes (`api-escrita` até `estado-vazio`). |

## Como repetir as verificações

```powershell
npm ci
npm run build
npm run lint
node tests/registro-inexistente.cjs
node tests/api-escrita.mjs
```

## Commits e limites

- Commits: `4cf451c` (Trata registros excluídos durante o uso (#46)), `4213408` (Testa tarefa e projeto inexistentes (#46)), `508450f` (Restringe o aviso de registro inexistente à edição (#46)) — [PR #89](https://github.com/aggak/pixel-dfe/pull/89) integrado à `main`.
- Limites: os cenários de exclusão concorrente apagam o registro direto na API do banco temporário para simular outra aba. Eles não cobrem um registro que some durante uma resposta ainda pendente.