# Relatório de execução — Marco 4 / issue #40

Data da execução: 26/10/2026.

## Escopo e ponto de partida

Implementei a [issue #40 — Mudar o status pelo cartão](https://github.com/aggak/pixel-dfe/issues/40), correspondente à issue 29 do enunciado. A branch `issue-40-status-pelo-cartao` parte do `main` no merge do PR #77 (commit `376aa21`), com a lista, o quadro e a alternância entre eles já prontos.

A issue pede um seletor ou botão no cartão para mudar o status, a gravação na API e a mudança do cartão para a coluna certa no quadro. Arrastar e soltar fica de fora.

## Registro de execução

1. Em `CartaoTarefa`, o selo de status vira um botão quando a página passa `onMudarStatus`. O botão abre um menu com os quatro status em seleção única, com o atual marcado. Sem a prop, como na página do projeto, o selo continua só informativo.
2. Criei `src/hooks/useMudarStatus.ts`. Ele envia `PATCH /tarefas/:id` só com `{ status }` e, com a resposta da API, troca a tarefa no estado da página. Como a atualização é feita depois da confirmação, o cartão só muda de coluna depois que a API grava.
3. Enquanto o envio está pendente, o botão fica em `isPending` (bloqueia cliques, continua focável e é anunciado ao leitor de tela), as opções do menu ficam desabilitadas e uma trava síncrona impede um segundo envio.
4. Se a API falha, o cartão fica onde estava e mostra "Não foi possível mudar o status. Tente de novo." com `role="alert"`.
5. No quadro, o cartão movido remonta em outra coluna, e o foco volta ao seletor dele. Se um filtro o tirou da tela, o foco vai para o título da página. Se a pessoa já levou o foco para outro controle, como a busca, ele fica lá.
6. Um `role="status"` visualmente oculto anuncia a mudança. Ele só existe depois da primeira mudança, como as outras regiões de status do app.
7. A tarefa gravada é publicada num evento da janela, e toda página montada a aplica. Assim, quem troca de visão com a resposta ainda pendente não fica com o status antigo.
8. CSS em `src/App.css`:
   - seta junto ao selo e estados de hover e de menu aberto;
   - área de toque de 44 px no mobile por um pseudo-elemento, sem esticar o botão nem o anel de foco;
   - opções do menu com 44 px no mobile;
   - contraste do ponto do selo "Concluída" (2,08:1 → 5,68:1).
9. Criei `tests/status-cartao.cjs`.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/components/CartaoTarefa.tsx` | Seletor de status, estado de envio, trava e aviso de falha. |
| `src/hooks/useMudarStatus.ts` | PATCH, atualização das páginas montadas, foco e anúncio. |
| `src/pages/ListaTarefas.tsx` | Usa o hook e passa `onMudarStatus` aos cartões. |
| `src/pages/QuadroTarefas.tsx` | Usa o hook e passa `onMudarStatus` aos cartões. |
| `src/App.css` | Estilo do seletor, toque no mobile e contraste do selo. |
| `tests/status-cartao.cjs` | Suíte de navegador com API real e banco temporário. |

Não adicionei dependências. `atualizarTarefa` já existia em `src/api.ts`, e o menu é o `Dropdown` do design. Não alterei `src/tipos.ts`, `db.json` nem `db.seed.json`.

## Critérios da issue

| Critério | Resultado |
| --- | --- |
| Seletor ou botão no cartão para mudar o status | Selo clicável com menu dos quatro status, na lista e no quadro, por mouse, teclado e toque. |
| Gravar o novo status na API | `PATCH` só com `{ status }`; o banco muda apenas nesse campo, e a recarga mostra o valor gravado. |
| Mover o cartão para a coluna correspondente no quadro | O cartão sai da coluna antiga e entra, uma única vez, na nova, com contadores atualizados. |

## Revisão

Revisaram a mudança quatro agentes externos, cada um com um foco e um modelo escolhido para ele:

| Agente | Modelo e esforço | Foco |
| --- | --- | --- |
| Codex | gpt-6.1-sol, alto | correção do código |
| Grok | grok-4.7, alto | qualidade dos testes |
| agy | Gemini 4 Argon High | UX e acessibilidade |
| muse | muse-spark-1.3, médio | regressões e integração |

Os quatro pediram mudanças, e apliquei todas.

**Código**
- As suítes antigas quebravam: `name: /Status/` passou a casar com os botões dos cartões, e o `role="status"` ficava sempre montado. O nome do botão virou "Mudar status de … (atual: …)", e a região de status só aparece com conteúdo.
- Duas escolhas rápidas podiam gerar dois PATCHs, com respostas fora de ordem.
- Uma resposta atrasada roubava o foco de quem já digitava na busca.
- A falha e a saída do cartão por filtro deixavam o foco no `body`.
- Trocar de visão com o PATCH pendente deixava a outra visão com o status antigo.

**Visual**
- O aviso de erro entrava como terceira coluna na linha da lista.
- O seletor se esticava na coluna da lista, e o menu abria desalinhado.
- As opções do menu tinham 38 px no mobile, e o anel de foco ficava deformado.
- O ponto do selo "Concluída" tinha contraste baixo, e não havia estado de hover nem de menu aberto no tema escuro.

**Testes** (oito lacunas da primeira versão da suíte)
- O intervalo com o PATCH pendente não era observado.
- A verificação de "mesmo status" usava uma espera fixa.
- Um cartão duplicado em outra coluna passaria.
- A busca e o filtro de prioridade não eram exercitados.
- Faltavam o tema escuro e a verificação de que o anúncio fica oculto.
- O cenário de teclado dependia da posição das opções.

**Fora do escopo:** a página do projeto continua com o selo só informativo. Ela lê as tarefas por `useConsulta`, sem estado editável, e a issue fala de lista e quadro.

## Falhas encontradas e correções

- O `Button` do React Aria descarta `aria-busy`. Troquei `isDisabled` por `isPending`, que mantém o foco no botão durante o envio.
- O menu do React Aria recebe o nome do botão que o abre, não o `aria-label` próprio. Removi esse rótulo e ajustei a suíte.
- Na primeira versão do cenário de resposta atrasada, a suíte digitava "Li" na busca, e isso tirava da tela o próprio cartão testado. Troquei por "Des".
- A suíte falhava em 3 de 5 execuções, em 850 px: o menu da escolha anterior ainda saía com animação perto da borda e gerava rolagem horizontal momentânea. A suíte agora espera o menu sair antes de medir; depois disso, 8 de 8 execuções passaram.
- Ao testar com `npx json-server db.json`, cada mudança de status fazia a página piscar e perder busca e filtros. Era o Vite recarregando a página toda vez que o json-server gravava o `db.json`, o que já acontecia antes em qualquer gravação. Em um commit separado, o `vite.config.ts` passou a ignorar o `db.json`. É um ajuste do ambiente de desenvolvimento, sem mudança de funcionalidade.
- Para confirmar que a suíte detecta os bugs corrigidos, desliguei temporariamente a sincronização entre páginas e a proteção do foco. A suíte falhou nos dois casos e voltou a passar com o código restaurado.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado; `oxlint --deny-warnings` sem avisos. |
| `node tests/status-cartao.cjs` | 10 cenários aprovados; 8 de 8 execuções. |
| `node tests/alternar-visao.cjs` | 9 cenários aprovados; 3 de 3 execuções. |
| `node tests/quadro-filtros.cjs` | 8 cenários aprovados; 3 de 3 execuções. |
| `node tests/editar-tarefa.cjs` | 12 cenários aprovados; 3 de 3 execuções. |
| `node tests/estado-filtros.cjs` | 6 cenários aprovados. |
| `node tests/busca-titulo.cjs` | Aprovado. |
| `node tests/marco-2.cjs` | 12 cenários aprovados. |
| `node tests/api-escrita.mjs` | 12 cenários aprovados. |
| `node tests/formulario-tarefa.cjs` | 17 cenários aprovados. |
| `node tests/nova-tarefa.cjs` | 15 cenários aprovados. |
| `node tests/projetos-cadastro-edicao.cjs` | 15 cenários aprovados. |
