# Relatório de execução — Marco 3 / Issue #33 / Euclidespilon-Neto

Data da execução: 18/10/2026.

## Escopo e ponto de partida

Implementei a issue [#33 — Criar cadastro e edição de projeto](https://github.com/aggak/pixel-dfe/issues/33), atribuída ao meu usuário. Parti da `main` no commit `72fe536`, após a integração das issues #27 a #32 do Marco 3.

Consultei o contrato de dados, o enunciado dos marcos e a estrutura consolidada na `main` para tarefas (`FormularioTarefa`, `NovaTarefa` e `EditarTarefa`). Mantive a divisão existente entre `pages`, `components`, `hooks`, `api.ts`, `tests` e `docs`, sem alterar arquivos fora do escopo da issue #33.

## Registro de execução

1. Conferi a atribuição da issue #33 e o estado atualizado da `main`, que já dispunha de `criarProjeto`, `atualizarProjeto` e `buscarProjeto` em `src/api.ts`, além dos estilos de formulário em `src/components/FormularioTarefa.css`.
2. Criei o componente reutilizável `src/components/FormularioProjeto.tsx` seguindo o mesmo fluxo, estilo visual, validação de campos obrigatórios (`nome`, `disciplina` e `criadoEm`) e recursos de acessibilidade (`label` associado por `useId`, `aria-invalid`, `aria-describedby`, `role="alert"`, foco automático no primeiro campo inválido e bloqueio de envios duplicados) aplicados no formulário de tarefas, além de higienizar com `trim()` os valores de `nome` e `disciplina` antes de enviá-los ao callback de gravação.
3. Implementei `src/pages/NovoProjeto.tsx` para a rota `/projetos/novo`, gravando o novo registro via `criarProjeto` (`POST /projetos`) sem enviar `id` e redirecionando para `/projetos` após o sucesso, com cancelamento por `AbortController` caso o usuário saia da tela durante o envio.
4. Implementei `src/pages/EditarProjeto.tsx` para a rota `/projetos/:id/editar`, consultando o projeto atual com `useConsulta` e `buscarProjeto`, preenchendo o `FormularioProjeto` com os dados carregados e gravando as alterações via `atualizarProjeto` (`PATCH /projetos/:id`), retornando ao detalhe `/projetos/:id` após salvar.
5. Registrei `/projetos/novo` e `/projetos/:id/editar` antes de `/projetos/:id` em `src/App.tsx` (evitando que `novo` seja interpretado como um ID) e adicionei os links de acesso em `src/pages/ListaProjetos.tsx` (**Novo projeto**) e `src/pages/DetalheProjeto.tsx` (**Editar projeto**).
6. Criei a suíte `tests/projetos-cadastro-edicao.cjs` com reserva não repetida de portas, verificação de identidade dos servidores com nova tentativa automática em caso de colisão e 15 cenários cobrindo criação, edição, higienização de espaços, falhas de envio no `POST` e no `PATCH` e isolamento entre abas.

## Pontos revisados e ajustes aplicados

| Ponto revisado | Ajuste realizado | Resultado verificado |
| --- | --- | --- |
| Falhas de envio no `POST /projetos` e risco de sobrescrita por semelhança (`[P1]`) | Como o contrato de `Projeto` e o `json-server` geram `id` no servidor sem chave única de idempotência na requisição, uma busca por semelhança de campos pode atingir um projeto criado em outra aba e sobrescrevê-lo indevidamente com `PATCH`. Mantive em `src/pages/NovoProjeto.tsx` o mesmo fluxo direto de `NovaTarefa.tsx` (bloqueio de envios concorrentes durante a requisição e preservação dos campos em caso de erro, sem disparar `PATCH` em registros encontrados por semelhança) e adicionei cenários específicos de falha e concorrência entre abas na suíte. | Validado por três cenários de `POST` na suíte: falha HTTP 500 e de conexão com preservação e nova tentativa, não sobrescrita de projeto homônimo criado em outra aba e bloqueio de duplicidade com cancelamento ao sair da tela. |
| Espaços nas extremidades de `nome` e `disciplina` | Em `src/components/FormularioProjeto.tsx`, apliquei `nome.trim()` e `disciplina.trim()` na montagem de `dados: DadosProjeto` antes de chamar `onSalvar`. | Tanto o `POST` quanto o `PATCH` persistem `nome` e `disciplina` sem espaços iniciais ou finais no banco. |
| Reserva e possível colisão de portas na suíte de integração | Em `tests/projetos-cadastro-edicao.cjs`, adicionei controle `portasUsadas` para nunca repetir portas na mesma execução, função `subir` com até 3 tentativas caso a porta seja ocupada no intervalo entre `close()` e o `listen()` do processo filho, e validação da resposta inicial de cada servidor (`/projetos` com IDs do seed e HTML com `/src/main.tsx`). | Inicialização determinística dos servidores temporários da API e do Vite. |

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/components/FormularioProjeto.tsx` | Formulário reutilizável para cadastro e edição de projetos, com validação, higienização (`trim`) de `nome` e `disciplina`, acessibilidade e preservação de dados em falha de envio. |
| `src/pages/NovoProjeto.tsx` | Página da rota `/projetos/novo` que grava o projeto na API e retorna à listagem de projetos. |
| `src/pages/EditarProjeto.tsx` | Página da rota `/projetos/:id/editar` que carrega o projeto atual, preenche o formulário, salva via API e retorna ao detalhe. |
| `src/App.tsx` | Registro das rotas `/projetos/novo` e `/projetos/:id/editar` dentro do `Layout` compartilhado. |
| `src/pages/ListaProjetos.tsx` | Inclusão do link **Novo projeto** no cabeçalho da listagem. |
| `src/pages/DetalheProjeto.tsx` | Inclusão do link **Editar projeto** no cabeçalho quando os dados do projeto estão carregados. |
| `tests/projetos-cadastro-edicao.cjs` | Suíte de integração de cadastro e edição de projetos com servidores próprios, verificação de porta/identidade e banco temporário. |
| `docs/RELATORIO_MARCO_3_ISSUE_33.md` | Registro do processo, revisões, decisões e resultados da issue #33. |

Mantive React, TypeScript, React Router e json-server, sem acrescentar dependências ao projeto e sem modificar `src/tipos.ts`, `src/api.ts`, `db.json` ou `db.seed.json`.

## Critérios da issue

| Critério | Resultado |
| --- | --- |
| Criar a rota `/projetos/novo`, sem interpretar `novo` como um ID | Validado por navegação a partir de `/projetos`, abertura direta e recarga da página, confirmando que nenhuma requisição `GET /projetos/novo` é disparada à API e que `/projetos/1` continua abrindo o detalhe. |
| Criar a rota `/projetos/:id/editar`, carregando os dados atuais | Validado pelo link **Editar projeto**, acesso direto, recarga e troca de parâmetro de rota. Os quatro campos (`Nome`, `Descrição`, `Disciplina` e `Criado em`) são preenchidos com os valores atuais e IDs inexistentes exibem mensagem de erro sem abrir o formulário. |
| Gravar o cadastro e as alterações na API, respeitando o contrato de Projeto | Validado com `POST /projetos` (sem `id` no payload, sem espaços nas pontas de `nome` e `disciplina` e disponibilizando o projeto no seletor de tarefas) e `PATCH /projetos/:id` (preservando `id` e tarefas vinculadas via `_embed=tarefas`). |

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado. Verificação TypeScript por `tsc -b` e geração do pacote de produção. |
| `npm run lint` | Aprovado, sem avisos ou erros em 24 arquivos. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados no Microsoft Edge. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados no Microsoft Edge. |
| `node tests/nova-tarefa.cjs` | 14 cenários aprovados no Google Chrome. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados no Google Chrome. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/marco-2.cjs` | 12 cenários aprovados no Microsoft Edge. |
| `git diff --check` | Aprovado, sem problemas de formatação ou espaços no diff. |

**Resultado final: 82 cenários de integração aprovados.** As suítes não registraram erros JavaScript não tratados, e `db.json` e `db.seed.json` permaneceram idênticos ao estado original.

Na suíte `tests/projetos-cadastro-edicao.cjs`, verifiquei:

1. Acesso a `/projetos/novo` pela lista, abertura direta e recarga sem requisitar `GET /projetos/novo` na API, preservando `/projetos/1` como detalhe.
2. Validação de campos obrigatórios (`Nome`, `Disciplina` e `Criado em`), recusa de valores preenchidos apenas com espaços, atributos `aria-invalid` e `aria-describedby` e foco automático no primeiro campo com erro.
3. `POST /projetos` real sem `id` no corpo e sem espaços nas pontas de `nome` e `disciplina`, persistência no banco temporário, retorno a `/projetos` com o novo projeto listado e presença imediata no seletor de projetos em `/tarefas/nova`.
4. Falha HTTP 500 e falha de conexão (`connectionrefused`) no `POST /projetos` preservando os valores digitados e criando um único registro ao tentar novamente.
5. Nova tentativa após falha de `POST` quando outra aba criou um projeto com os mesmos campos iniciais, garantindo que o registro da outra aba nunca seja sobrescrito por `PATCH`.
6. `POST /projetos` pendente bloqueando envio duplicado e saída pelo menu cancelando redirecionamento atrasado.
7. Cancelamento e link de retorno em `/projetos/novo` voltando para `/projetos` sem gravar dados.
8. Link **Editar projeto** no detalhe, acesso direto e recarga em `/projetos/1/editar` com todos os campos preenchidos.
9. `PATCH /projetos/1` real removendo espaços nas pontas de `nome` e `disciplina`, preservando `id` e as tarefas vinculadas ao projeto (`_embed=tarefas`), persistindo no banco e retornando ao detalhe atualizado.
10. Cancelamento e link de retorno em `/projetos/1/editar` voltando ao detalhe sem gravar alterações.
11. Projeto inexistente (`/projetos/999/editar`) encerrando o carregamento e exibindo `Projeto não encontrado.` sem renderizar o formulário.
12. Falha de leitura da API exibindo mensagem de erro e encerrando o carregamento sem renderizar o formulário.
13. Troca de ID (`/projetos/1/editar` para `/projetos/2/editar`) reiniciando os campos e ignorando respostas atrasadas do ID anterior.
14. Falha HTTP 500 na gravação da edição preservando os valores digitados e permitindo nova tentativa, bloqueio contra envio duplicado e cancelamento de redirecionamento ao sair da página durante a gravação.
15. Layout sem transbordamento horizontal em largura de 320 px, foco visível, envio por teclado (`Enter`), ausência de erros JavaScript e preservação de `db.json` e `db.seed.json`.
