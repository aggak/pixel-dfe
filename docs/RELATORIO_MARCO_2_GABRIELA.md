# Relatório de execução — Marco 2 / GabrielaAraujoReis

Data da verificação: 11/10/2026.

## Escopo

Foram implementadas as issues [#18](https://github.com/aggak/pixel-dfe/issues/18), [#19](https://github.com/aggak/pixel-dfe/issues/19) e [#20](https://github.com/aggak/pixel-dfe/issues/20), atribuídas a GabrielaAraujoReis no Marco 2. A issue [#26](https://github.com/aggak/pixel-dfe/issues/26), referente ao slide, foi excluída do trabalho.

## Situação das issues já fechadas

| Issue | O que foi encontrado no repositório | Pendência observada |
| --- | --- | --- |
| [#12](https://github.com/aggak/pixel-dfe/issues/12) | Repositório criado e acessível. | O próprio checklist da issue ainda não marca a professora como colaboradora; permissões de colaboradores não foram auditadas. |
| [#13](https://github.com/aggak/pixel-dfe/issues/13) | Aplicação React, TypeScript e Vite criada. | Nenhuma falha na instalação ou no build atual. |
| [#14](https://github.com/aggak/pixel-dfe/issues/14) | README identifica a equipe, integrantes e framework. | Faltam os pré-requisitos e comandos de instalação/execução descritos no critério da issue. |
| [#15](https://github.com/aggak/pixel-dfe/issues/15) | `db.json`, `db.seed.json` e `src/tipos.ts` presentes; projeto compila. | Nenhuma divergência de campos identificada na leitura realizada. |
| [#16](https://github.com/aggak/pixel-dfe/issues/16) | `json-server` instalado; endpoints `/tarefas` e `/projetos` funcionam. | `package.json` não contém o script da API prometido na issue, e o README não documenta comando/porta. |
| [#17](https://github.com/aggak/pixel-dfe/issues/17) | Issue registra o quadro GitHub Projects como criado. | O checklist ainda contém a atribuição de responsáveis em aberto. |
| [#21](https://github.com/aggak/pixel-dfe/issues/21) | Rotas `/`, `/tarefas/:id`, `/projetos`, `/projetos/:id` e fallback configuradas. | As páginas de detalhe e projetos ainda exibem títulos provisórios; são issues separadas do Marco 2. |

A issue [#1](https://github.com/aggak/pixel-dfe/issues/1) resume o Marco 1 e está fechada. A tabela acima registra as entregas específicas e as lacunas encontradas na cópia atual da `main`.

## Implementação realizada

- `src/api.ts`: módulo único de leitura com funções tipadas para listar tarefas e projetos, buscar cada registro pelo ID e consultar as tarefas de um projeto por `GET /projetos/:id?_embed=tarefas`. Reutiliza `src/tipos.ts`, codifica os IDs na URL e propaga falhas HTTP e de rede.
- `src/components/CartaoTarefa.tsx`: cartão reutilizável que recebe uma `Tarefa` por propriedade. Mostra título, status, prioridade, responsável e prazo, com link para a rota da tarefa.
- `src/pages/ListaTarefas.tsx`: tela inicial ligada à rota `/`, que busca as tarefas pela API, usa o ID como chave estável e apresenta estados de carregamento, erro e lista vazia.
- `src/App.css` e `src/App.tsx`: estilos responsivos para a lista/cartões e conexão da página inicial ao roteador existente.

## Ambiente e validação

- Node.js `v24.19.0` e npm `11.17.0` disponíveis no computador.
- `npm ci` concluiu a instalação de 73 pacotes, com **0 vulnerabilidades** informadas pelo npm.
- `npm run build` e `npm run lint` concluíram sem erros.
- A API local foi iniciada com `npm exec -- json-server db.json --host 127.0.0.1 --port 3000`.
- Os endpoints retornaram **5 tarefas**, **2 projetos**, a tarefa `2`, o projeto `1` e **4 tarefas** vinculadas ao projeto `1` pelo `_embed`.
- A aplicação Vite foi iniciada em `http://127.0.0.1:5173/`; a rota `/` exibiu no navegador os cinco cartões do `db.json`, sem duplicações.

## Limites e falhas detectadas

- O cartão leva à rota de detalhe existente, mas essa tela ainda é provisória até a implementação da issue [#22](https://github.com/aggak/pixel-dfe/issues/22), atribuída a outra pessoa.
- As lacunas nas issues fechadas #12, #14, #16 e #17 foram registradas acima. Não foram alteradas por estarem fora das três issues autorizadas.
- A URL da API usa `VITE_API_URL` quando definida; sem essa variável, usa `http://localhost:3000`. A configuração de produção pertence ao Marco 6.

## Como executar nesta cópia

Em dois terminais, na raiz do repositório:

```powershell
npm exec -- json-server db.json --host 127.0.0.1 --port 3000
npm run dev -- --host 127.0.0.1
```

Abrir `http://127.0.0.1:5173/`.
