# Apresentação do Marco 2 — issue #26

**Slide:** [Projeto Pixel Marco 2 no Canva](https://www.canva.com/design/DAHX6U1HIv0/639xmRJDw94uibb8rfJqxQ/edit)

Esta apresentação usa dados da API local em `db.json`. As quatro capturas em `docs/slide-marco-2/` foram produzidas com a aplicação e o `json-server` em execução. Elas correspondem a `/`, `/tarefas/2`, `/projetos` e `/projetos/1`.

## Preparação da demonstração

Na pasta do projeto, instalar as dependências uma vez com `npm ci`. Abrir dois terminais e mantê-los ativos:

```powershell
# Terminal 1 — API
npx json-server db.json
```

```powershell
# Terminal 2 — aplicação
npm run dev
```

Conferir `http://localhost:3000/tarefas` e abrir no navegador o endereço informado pelo Vite, normalmente `http://localhost:5173`. Deixar a aplicação aberta em `/` antes de começar a apresentação. Se alguma das portas estiver ocupada, encerrar o processo anterior ou iniciar a aplicação com a variável `VITE_API_URL` apontando para a porta da API escolhida.

## Roteiro de até cinco minutos

| Tempo aproximado | Slide | Fala e demonstração |
| --- | --- | --- |
| 0:00–0:30 | 1. Marco 2 | Apresentar o Pixel e o objetivo: consultar tarefas e projetos da API local e navegar entre listas e detalhes. |
| 0:30–1:25 | 2. Lista de tarefas | Mostrar as cinco tarefas, seus status, prioridades, responsáveis e prazos. Abrir **Subir o json-server** pelo título. |
| 1:25–2:15 | 3. Detalhe da tarefa | Mostrar `/tarefas/2`: identificador, descrição, projeto relacionado e campos do cartão. Voltar para a lista pelo link. |
| 2:15–3:25 | 4. Projetos | Clicar em **Projetos** no menu. Mostrar os dois projetos; abrir **Gerenciador de Tarefas** e indicar as quatro tarefas relacionadas. Voltar e mencionar que **Modelagem da Biblioteca** tem uma tarefa. |
| 3:25–4:20 | 5. Validação | Explicar que `npm run build`, `npm run lint` e 12 cenários de integração passaram. Citar recarregamento direto, IDs inexistentes e falha de rede. |
| 4:20–5:00 | Encerramento | Resumir o fluxo `lista → detalhe → projetos → tarefas do projeto`. Reservar o tempo restante para uma pergunta. |

As capturas no slide servem como apoio caso a demonstração ao vivo demore a carregar. Durante a apresentação, usar a aplicação aberta para provar a navegação e a leitura real da API.

## Estrutura apresentada

- `db.json`: dois projetos e cinco tarefas de exemplo.
- `src/api.ts`: consultas HTTP à API local e tratamento de respostas com erro.
- `src/components/CartaoTarefa.tsx`: exibição reutilizável dos campos de tarefa.
- `src/components/Layout.tsx`: menu compartilhado de tarefas e projetos.
- `src/pages/ListaTarefas.tsx`, `DetalheTarefa.tsx`, `ListaProjetos.tsx` e `DetalheProjeto.tsx`: quatro telas do Marco 2.
- `src/App.tsx`: rotas `/`, `/tarefas/:id`, `/projetos` e `/projetos/:id`.

## Verificações e limitações

Em 13/10/2026, `npm run build` e `npm run lint` terminaram sem erros. A suíte `tests/marco-2.cjs` aprovou 12 cenários em Edge com a API local: listagens, detalhes, navegação, recarregamento, registros ausentes, falha de rede e largura de 375 px. Não houve erro JavaScript não tratado. Para executar essa suíte nesta máquina foi necessário instalar `playwright` localmente com `npm install --no-save --package-lock=false playwright`; `package.json` e `package-lock.json` não foram alterados por isso.

As capturas refletem o estado do `db.json` nesta data. Se os dados forem alterados antes da apresentação, os números e imagens do slide precisarão ser atualizados. O teste automatizado confirma os fluxos técnicos; a equipe ainda precisa ensaiar a fala e conferir áudio, projeção e tempo no ambiente da aula.
