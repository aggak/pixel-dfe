# Relatório de execução — Marco 2 / Euclidespilon-Neto

Data da verificação: 12/10/2026.

## Escopo e estado inicial

Implementação das issues [#22](https://github.com/aggak/pixel-dfe/issues/22), [#23](https://github.com/aggak/pixel-dfe/issues/23), [#24](https://github.com/aggak/pixel-dfe/issues/24) e [#25](https://github.com/aggak/pixel-dfe/issues/25), atribuídas a Euclidespilon-Neto.

O arquivo `issues-por-marco.md` foi usado como referência dos requisitos. Seus responsáveis e estados foram comparados com o GitHub: o arquivo ainda indicava essas quatro issues sem responsável, mas a atribuição já estava registrada no repositório.

A cópia local estava no commit `209c680`. A implementação partiu de `919f1a5`, versão da `main` obtida após atualizar as referências remotas, que já incorporava a entrega da Gabriela pelo PR #59.

| Issues | Situação consultada | Evidência e tratamento |
| --- | --- | --- |
| #18, #19 e #20 | Fechadas; atribuídas a GabrielaAraujoReis | Módulo `src/api.ts`, `CartaoTarefa` e `ListaTarefas` presentes. Foram reutilizados e a listagem original foi verificada. |
| #21 | Fechada; atribuída a aggak | Roteador com quatro rotas e fallback. As páginas de detalhes e projetos ainda exibiam títulos provisórios. |
| #22, #23, #24 e #25 | Abertas; atribuídas a Euclidespilon-Neto | Implementadas nesta branch, com um commit individual por issue. |
| #26 | Aberta; atribuída a GabrielaAraujoReis | Apresentação fora do escopo desta entrega. |

O estado fechado de uma issue não foi usado como única evidência de funcionamento. A verificação desta entrega se concentrou no código e nos fluxos do Marco 2; permissões da equipe, quadro de projetos e publicação não foram auditados.

## Estrutura utilizada

Mantidos React, TypeScript, Vite, React Router e json-server, sem adicionar dependências de produção ou alterar o contrato em `src/tipos.ts`.

- `src/components/Layout.tsx`: cabeçalho Pixel, navegação com `NavLink` para Tarefas e Projetos e `Outlet` para as telas. A página não encontrada também utiliza o layout.
- `src/pages/DetalheTarefa.tsx`: consulta o ID da URL, reutiliza o cartão e complementa a exibição com identificador, projeto e descrição. Os nove campos de `Tarefa` ficam disponíveis na tela.
- `src/pages/ListaProjetos.tsx`: consulta projetos pelo módulo da API, apresenta nome, descrição e disciplina e cria links pelo ID, usado também como chave estável.
- `src/pages/DetalheProjeto.tsx`: busca o projeto e suas tarefas usando as funções existentes. A consulta de tarefas utiliza `GET /projetos/:id?_embed=tarefas`. Exibe os cinco campos de `Projeto` e reutiliza `CartaoTarefa` para as tarefas relacionadas.
- `src/hooks/useConsulta.ts`: compartilha os estados de leitura entre as três telas novas. Cancela requisições ao sair da tela ou trocar o ID e ignora respostas de consultas canceladas. Uma nova consulta não mostra os dados do endereço anterior.
- `src/api.ts`: mantém a API pública de leitura existente e acrescenta `ErroApi`, que preserva o status HTTP para distinguir registros inexistentes de indisponibilidade.
- `src/App.css`: mantém o padrão visual existente e acrescenta estilos do cabeçalho, dos dados complementares e do foco de links.
- `tests/marco-2.cjs`: suíte de integração em navegador com dados temporários, servidores próprios e encerramento dos processos ao final.

## Falhas e lacunas tratadas

| Problema encontrado | Correção | Resultado verificado |
| --- | --- | --- |
| Cópia local anterior à integração das issues #18–#20 | Criação da branch sobre a `main` atualizada | Reutilização do código entregue pela equipe, com cinco tarefas mantidas na lista. |
| Telas de detalhe e projetos mostravam apenas títulos | Substituição pelas três páginas que consultam a API | Tarefa, projetos e tarefas relacionadas exibidos com dados reais. |
| Navegação tinha atalhos fixos para o registro `1` e não havia componente de layout | Cabeçalho compartilhado e navegação das áreas principais | Links dos cartões e das listas levam ao registro escolhido sem recarregar a página. |
| Erro HTTP não possuía status acessível de forma tipada | Classe `ErroApi` com propriedade `status` | IDs inexistentes exibem mensagem específica e encerram o carregamento. |
| Novas consultas poderiam exibir dados anteriores ou aceitar respostas atrasadas | Cancelamento com `AbortController`, proteção de atualização e associação do resultado à consulta | Troca de tarefa e projeto validada com resposta atrasada. |

A execução inicial dos testes ficou limitada pelo acesso aos servidores locais no ambiente restrito. A execução com acesso local autorizado aprovou a suíte. Esse impedimento era do ambiente de execução, não uma falha da aplicação.

## Validação e resultados

Cada uma das quatro implementações passou por `npm.cmd run build` e `npm.cmd run lint` antes de seu commit. O build verifica TypeScript e gera o pacote de produção.

A suíte executou 12 cenários em Microsoft Edge sem interface, com Playwright disponível no ambiente:

1. Lista original com cinco tarefas, sem duplicações.
2. Acesso direto a `/tarefas/2`, campos completos e recarregamento.
3. Cabeçalho persistente, navegação sem recarregamento e indicação da área ativa.
4. Dois projetos com links correspondentes aos seus IDs.
5. Consulta `_embed` efetivamente realizada: projeto `1` com quatro tarefas e projeto `2` com uma, sem mistura entre projetos.
6. Troca de parâmetro de tarefa sem manter dados da tarefa anterior durante o carregamento.
7. Resposta atrasada de projeto sem substituir os dados do projeto atual.
8. `/tarefas/999` e `/projetos/999` com mensagens de não encontrado e carregamento encerrado.
9. Lista de projetos vazia e projeto sem tarefas, por respostas controladas no navegador.
10. Falha de conexão simulada nas três telas novas, com mensagem de erro.
11. Rota desconhecida com fallback, menu e retorno à lista.
12. Quatro telas sem transbordamento horizontal em largura de 375 px e link alcançável pelo teclado.

**Resultado: 12 cenários aprovados, sem erros JavaScript não tratados.** As consultas normais utilizaram json-server real com uma cópia temporária de `db.seed.json`; `db.json` e `db.seed.json` do projeto permaneceram intactos. Os testes de vazio, atraso e falha usam interceptação de rede explícita.

## Commits por issue

| Issue | Commit | Entrega |
| --- | --- | --- |
| #22 | `3257155` | Dados completos da tarefa, consulta compartilhada e erro HTTP tipado. |
| #23 | `99517ef` | Layout compartilhado e navegação. |
| #24 | `3810df4` | Lista de projetos e links por ID. |
| #25 | `a8a3022` | Dados do projeto e cartões das tarefas relacionadas. |

Os testes de integração e este relatório compõem um commit adicional de validação.

## Execução e reprodução

Com as dependências do projeto instaladas, iniciar em terminais separados:

```powershell
npm.cmd exec -- json-server db.json --host 127.0.0.1 --port 3000
npm.cmd run dev -- --host 127.0.0.1
```

Abrir o endereço exibido pelo Vite. O módulo existente aceita `VITE_API_URL`; sem configuração, utiliza `http://localhost:3000`.

Para repetir as verificações:

```powershell
npm.cmd run build
npm.cmd run lint
node tests/marco-2.cjs
```

A suíte requer Windows com Microsoft Edge e o pacote `playwright` resolvível pelo Node. Caso não esteja disponível, ele pode ser instalado apenas para validação com `npm.cmd install --no-save --package-lock=false playwright`. A execução desta entrega utilizou o pacote já disponível no ambiente, sem modificar `package.json` ou o lockfile para esse fim. As portas `3100` e `4174` devem estar livres. Não é necessário iniciar os servidores manualmente para a suíte.

## Limites e alterações locais preservadas

- README, script local `api` em `package.json` e `docs/issues-por-marco.md` já tinham alterações ou conteúdo não versionado antes desta execução. Foram preservados e não incluídos nos commits desta entrega.
- A `main` consultada ainda não versionava o script `api` nem as instruções locais de execução. O comando direto de json-server acima funciona independentemente dessas alterações locais.
- A lista original de tarefas, os dados de exemplo e o contrato da API foram preservados. O tratamento básico de erro das telas novas não conclui todas as funcionalidades previstas no Marco 5, como tentar novamente.
- Os testes de navegador usam o servidor de desenvolvimento. O pacote de produção foi compilado; hospedagem, acesso remoto e fallback em produção pertencem ao Marco 6 e não foram validados.
- A conferência de largura e foco não substitui uma auditoria completa de acessibilidade ou testes em todos os navegadores.
- As issues permanecem abertas no GitHub até a revisão e integração da entrega. A apresentação da equipe não faz parte desta implementação.
