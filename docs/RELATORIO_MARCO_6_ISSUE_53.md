# Relatório de execução — Marco 6 / issue #53

Data da execução: 08/11/2026.

## Escopo e ponto de partida

Implementei a [issue #53 — Publicar a aplicação](https://github.com/aggak/pixel-dfe/issues/53), atribuída ao meu usuário e correspondente à issue [42] do enunciado. Parti da branch `issue-52-build-producao` no commit `595ac1d`, que já continha a URL da API por ambiente (issue #50) e a conferência do build de produção (issue #52).

Publiquei o build como um serviço estático separado na Railway, em `https://pixel-dfe-project.up.railway.app`, consumindo a API hospedada em `https://pixel-dfe-production.up.railway.app`. Registrei o endereço no `README.md` e criei um script que confere, ao vivo, a aplicação publicada integrada à API.

## Registro de execução

1. Publiquei o frontend no painel da Railway, como um **novo serviço** ligado ao repositório `aggak/pixel-dfe`, separado do serviço da API. As variáveis do serviço foram `NODE_VERSION=24`, `RAILPACK_SPA_OUTPUT_DIR=dist` e `VITE_API_URL=https://pixel-dfe-production.up.railway.app`, e gerei o domínio público. Não criei `railway.json` nem `Caddyfile` na raiz: os dois serviços compartilham o repositório, e um arquivo na raiz afetaria também a API.
2. Antes de escrever o script, sondei os dois serviços:
   - `/`, `/quadro` e `/tarefas/2` do frontend respondem 200 com o `index.html`, então o servidor estático devolve a SPA nas rotas internas.
   - O bundle publicado contém `https://pixel-dfe-production.up.railway.app` e nenhum arquivo cita `localhost:3000`.
   - A API responde `GET /tarefas` (46 tarefas) e `GET /projetos` (7 projetos) com 200, e libera CORS para qualquer origem nos métodos `GET`, `POST`, `PATCH` e `DELETE`.
3. Escrevi `tests/verificar-publicacao.mjs` antes de mudar o `README.md`. Na primeira execução ele falhou com `README.md sem link clicável para https://pixel-dfe-project.up.railway.app`, antes de qualquer acesso à rede.
4. Atualizei o `README.md`, com o link em destaque logo abaixo do parágrafo de apresentação e uma menção à API hospedada. Não removi nem reordenei nenhuma linha: o script confere que as 78 linhas do README da `main` continuam presentes, na mesma ordem.
5. Rodei a verificação ao vivo, que passou. O ciclo de escrita está detalhado em "Critérios da issue".
6. Para provar a limpeza defensiva, rodei uma cópia temporária do script, não commitada, que lança um erro logo depois do `POST`. O `finally` encontrou a sobra pelo título, apagou-a (`DELETE` com HTTP 200), o estado final voltou às 46 tarefas originais e o script terminou com código 1, mostrando a falha simulada.
7. Rodei a verificação ao vivo mais duas vezes, `tests/build-producao.cjs` e a validação completa de entrega.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `README.md` | Link público da aplicação em destaque após o parágrafo inicial e menção à API hospedada; o restante ficou intacto. |
| `tests/verificar-publicacao.mjs` | Script sob demanda: confere o `README.md` e, no Playwright, a aplicação publicada com a API hospedada, incluindo um ciclo próprio de criar, mudar o status e excluir uma tarefa temporária. |
| `docs/RELATORIO_MARCO_6_ISSUE_53.md` | Este relatório. |

O script fica fora da lista offline do `validate-delivery.mjs`, como `tests/auditoria-lighthouse.mjs`, porque depende da rede e escreve na API pública.

### Dependências externas

| Dependência | Tipo | Adicionada ao `package.json`? | Uso |
| --- | --- | --- | --- |
| Railway (Railpack) | Hospedagem externa, configurada pelo painel | Não | Build (`npm ci` e `npm run build`) e publicação estática de `dist/` |
| API na Railway (`json-server`) | Serviço já publicado na issue #51 | Não | Dados da aplicação publicada |
| Playwright | Já presente em `node_modules` | Não | Navegador do script |
| Google Chrome | Instalado no sistema | Não | Navegador do script |

## Critérios da issue

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Publicar o build da aplicação em uma hospedagem estática. | Serviço estático na Railway em `https://pixel-dfe-project.up.railway.app`, separado do serviço da API, sem arquivos de configuração no repositório. As rotas internas respondem 200 com a SPA. | Sondagem do item 2 e `tests/verificar-publicacao.mjs` |
| Conferir o funcionamento da aplicação publicada com a API hospedada. | `GET /tarefas` e `GET /projetos` com 200, lista e quadro com as 46 tarefas, navegação pelo menu por `/`, `/quadro` e `/projetos`. A ficha publicada criou uma tarefa temporária, que a API devolveu com os sete campos; o selo do cartão mudou o status para "Em andamento" (`PATCH` 200, mantido após recarregar); a exclusão confirmada pela interface a removeu (`DELETE` 200 e `GET` 404). Não houve chamada a `localhost` nem erro JavaScript, e o conjunto de tarefas e de projetos ficou idêntico ao inicial. | `tests/verificar-publicacao.mjs`, 3 de 3 execuções |
| Adicionar o link público ao README, preservando as informações da equipe. | Link clicável após a apresentação; `## Como rodar`, `**Framework:** React com TypeScript.`, `## Equipe` (Desenvolvimento Frontend, ULBRA — 2026.2, os três integrantes) e o link de créditos e licenças preservados. | Commit `8abb150` e a etapa do README em `tests/verificar-publicacao.mjs` |

## Falhas encontradas e correções

- **Falhas reais:** nenhuma. A aplicação publicada leu e gravou na API hospedada sem ajustes em `src/`.
- **Falha simulada:** a interrupção logo após o `POST` (item 6) só existiu numa cópia temporária do script, para provar a limpeza defensiva.
- **Fora do escopo:** o acesso direto e a recarga em rotas internas da aplicação publicada, como `/tarefas/2`, ficam para a issue #54. A sondagem do item 2 já mostra resposta 200 nessas rotas.

## Validação

| Verificação | Resultado |
| --- | --- |
| `node tests/verificar-publicacao.mjs` | 8 verificações aprovadas; 3 de 3 execuções, sem limpeza defensiva acionada. |
| Falha simulada após o `POST` | Limpeza defensiva removeu a sobra; estado final igual ao inicial; código de saída 1. |
| `node tests/build-producao.cjs` | 15 verificações aprovadas. |
| `node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs` | Aprovado: arquivos protegidos intactos, build, lint, `git diff --check` e as 18 suítes existentes. |
| `git diff --cached --check` | Aprovado. |

## Como repetir as verificações

```powershell
npm ci
npm install --no-save --package-lock=false playwright
npm run build
npm run lint
node tests/build-producao.cjs
node tests/verificar-publicacao.mjs
```

## Commits e limites

- Commits: `8abb150` (Adiciona ao README o link da aplicação publicada (#53)), `5deeda1` (Verifica a aplicação publicada com a API hospedada (#53)) e o commit deste relatório — PR: `pendente`.
- **Escrita aberta sem autenticação:** por decisão da equipe, a API pública aceita `POST`, `PATCH` e `DELETE` de qualquer origem, sem autenticação e sem `--readonly`. Isso viabiliza as operações do Marco 6 (cadastro, edição, mudança de status e exclusão) na aplicação publicada, mas qualquer pessoa com o endereço pode alterar ou apagar os dados de exemplo.
- **Armazenamento efêmero:** o serviço da API não tem Volume. As gravações ficam no sistema de arquivos do container e se perdem num *restart* ou *redeploy*, que volta ao `db.json` do repositório. A equipe usa esse comportamento para restaurar os dados de exemplo antes da apresentação, se necessário.
- **Página padrão do JSON Server:** a raiz da API (`https://pixel-dfe-production.up.railway.app/`) mostra a página inicial padrão do JSON Server (título "JSON Server"). A aplicação só usa `/tarefas` e `/projetos`.
- O script compara o estado final com o inicial. Se outra pessoa gravar na API pública durante a execução, ele falha mesmo com a aplicação correta.
