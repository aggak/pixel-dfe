# Relatório de execução — Marco 6 / issue #52

Data da execução: 08/11/2026.

## Escopo e ponto de partida

Implementei a [issue #52 — Gerar e conferir o build de produção](https://github.com/aggak/pixel-dfe/issues/52), atribuída ao meu usuário e correspondente à issue [41] do enunciado. Parti da `main` no commit `be69a65`, que já continha a URL da API por ambiente (issue #50, PR #91): `.env.development` aponta para `http://localhost:3000` e `.env.production` para `https://pixel-dfe-production.up.railway.app`.

O objetivo foi gerar o build de produção e provar, sobre os arquivos gerados, que ele usa a configuração de produção e que navegação e funcionalidades seguem corretas. Transformei essa conferência numa suíte automatizada que não toca no `dist/` do projeto nem nos dados da API pública.

## Registro de execução

1. Li o handoff em `.agent/handoff/issue-atual.md` e conferi `src/api.ts`, `src/main.tsx`, `src/App.tsx`, `.env.development`, `.env.production` e `vite.config.ts`. Em produção, `src/api.ts` usa só `VITE_API_URL`, sem recorrer a `localhost`; `src/main.tsx` usa `BrowserRouter`; e `src/App.tsx` carrega as quatro fichas de formulário por `React.lazy`.
2. Gerei um build de sondagem numa pasta temporária para conhecer os nomes reais dos arquivos. Os quatro chunks assíncronos saem como `assets/NovaTarefa-*.js`, `EditarTarefa-*.js`, `NovoProjeto-*.js` e `EditarProjeto-*.js`. A URL da Railway aparece no bundle e `localhost:3000` não aparece em nenhum arquivo.
3. Criei `tests/build-producao.cjs` a partir do modelo `harness-template.cjs` da skill `testing-pixel-dfe`. A suíte tem três etapas:
   - **Build padrão:** roda `tsc -b` e `vite build --outDir <temporário>`. Retiro `VITE_API_URL` e `VITE_GITHUB_PAGES` do ambiente herdado do shell, porque no Vite as variáveis do processo têm prioridade sobre os arquivos `.env`. Assim o Vite lê `.env.production` sozinho. A suíte confere `index.html`, `favicon.svg`, `design-licenses/THIRD_PARTY_NOTICES.txt` (igual ao de `public/`), os chunks JS e CSS, os quatro chunks `React.lazy` fora do `index.html`, a URL da Railway nos `.js` e a ausência de `localhost:3000` em todos os `.js`, `.css` e `.html`.
   - **Build padrão no `vite preview`:** sirvo esse build e intercepto no Playwright todas as chamadas a `https://pixel-dfe-production.up.railway.app/**`. Os `GET /tarefas` e `GET /projetos` recebem os dados de `db.seed.json`, e qualquer outro método receberia 405, sem sair para a rede. A suíte confirma os dois pedidos ao endereço de produção, nenhum pedido de escrita, e os 5 cartões renderizados.
   - **Segundo build no `vite preview`:** gero outro build com `VITE_API_URL` apontando para um `json-server` sobre uma cópia `mkdtemp` de `db.seed.json` e o sirvo com `vite preview`. Sobre ele, a suíte confere os assets, a navegação, a busca com filtros, os chunks `React.lazy` e o CRUD completo (detalhes em "Critérios da issue").
4. Nas duas páginas, aborto os pedidos a CDNs (Google Fonts e ícones da Flaticon). A suíte não depende da rede externa, e o build local nunca chama a API de produção.
5. A suíte passou na primeira execução, porque o build já estava correto. Para provar que ela consegue falhar, rodei duas mutações temporárias, não commitadas: trocar a URL esperada por `https://exemplo.invalid` e deixar `VITE_API_URL=http://localhost:3000` vazar do shell para o build padrão. As duas falharam com `URL de produção ausente dos bundles`.
6. Rodei a suíte três vezes seguidas e a validação completa de entrega.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `tests/build-producao.cjs` | Nova suíte: `tsc -b` e `vite build` em pastas temporárias, consumo da URL de `.env.production` no `vite preview` com a Railway interceptada, e navegação, recarga, busca e filtros, chunks `React.lazy` e CRUD completo no `vite preview` com `json-server` isolado. |
| `docs/RELATORIO_MARCO_6_ISSUE_52.md` | Este relatório. |

Não alterei nada em `src/`: nenhum defeito de produção apareceu.

### Dependências externas

| Dependência | Tipo | Adicionada ao `package.json`? | Uso |
| --- | --- | --- | --- |
| Vite 8 (`vite build` / `vite preview`) | `devDependencies` existente | Não (já presente) | Build e servidor dos arquivos gerados |
| TypeScript (`tsc -b`) | `devDependencies` existente | Não (já presente) | Checagem de tipos antes do build |
| json-server | `devDependencies` existente | Não (já presente) | API isolada sobre cópia de `db.seed.json` |
| Playwright | Já presente em `node_modules` | Não | Navegador da suíte |
| Google Chrome | Instalado no sistema | Não | Navegador das suítes |

## Critérios da issue

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Executar `npm run build` sem erros. | `tsc -b` e `vite build` sem erros nem avisos; 9 arquivos JS e 2 CSS, com os 4 chunks `React.lazy`. | `validate-delivery.mjs` (`npm run build`) e a etapa 1 de `tests/build-producao.cjs` |
| Testar a aplicação a partir do build, por exemplo com `npm run preview`. | Os dois builds servidos por `vite preview`; acesso direto e recarga respondem 200 em `/`, `/quadro`, `/projetos`, `/projetos/1`, `/tarefas/1` e `/rota-inexistente` ("Página não encontrada"); `/favicon.svg` e o link "Licenças" respondem 200 com o conteúdo de `public/`. | `tests/build-producao.cjs` |
| Conferir navegação e funcionalidades com a configuração de produção. | O build padrão pede `GET /tarefas` e `GET /projetos` a `https://pixel-dfe-production.up.railway.app`. No build sobre o `json-server`: navegação `/` → `/quadro` → `/projetos` → `/projetos/1` → `/` sem recarregar o documento; busca "a" com "A fazer" e "Média" preservada entre Lista e Quadro; os 4 chunks só baixados ao abrir a ficha; criar e editar projeto, criar tarefa, abrir o detalhe e editar tarefa, mudar o status pelo selo do cartão no quadro e excluir com confirmação, conferindo o corpo de cada POST/PATCH/DELETE e o banco temporário. | `tests/build-producao.cjs` |

## Falhas encontradas e correções

- **Falhas reais:** nenhuma. O build de produção funcionou no `vite preview` como no `vite dev`, e por isso não alterei `src/`.
- **Ajustes só de teste:** a suíte retira `VITE_API_URL` e `VITE_GITHUB_PAGES` do ambiente herdado antes do build padrão. Sem isso, uma variável definida no shell venceria `.env.production` e o teste não provaria a leitura do arquivo. A segunda mutação do item 5 mostrou esse caso.
- **Fora do escopo:** publicar a aplicação (issue #53) e testar a API pública com escrita real. A suíte só confere que o bundle chama o endereço de produção, com as respostas interceptadas.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado, sem erros e sem avisos. |
| `node tests/build-producao.cjs` | 15 verificações aprovadas; 3 de 3 execuções, cerca de 13 s cada. |
| Mutações temporárias da suíte | 2 de 2 fizeram a suíte falhar, como esperado. |
| `node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs` | Aprovado: arquivos protegidos intactos, build, lint, `git diff --check` e as 18 suítes existentes. |
| `git diff --cached --check` | Aprovado. |

## Como repetir as verificações

```powershell
npm ci
npm install --no-save --package-lock=false playwright
npm run build
npm run lint
node tests/build-producao.cjs
node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs
```

## Commits e limites

- Commits: `a02bff3` (Confere o build de produção no vite preview (#52)) e o commit deste relatório — PR: `pendente`.
- Limites: o build padrão é testado só com a API de produção interceptada, sem tráfego real à Railway. As fontes e os ícones de CDN ficam bloqueados na suíte, então ela não confere a aparência com a fonte da web. `tests/build-producao.cjs` ainda não está na lista do `validate-delivery.mjs`. A publicação e a conferência com a API hospedada ficam para a issue #53.
