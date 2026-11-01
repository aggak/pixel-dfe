# Relatório de execução — Marco 5 / issue #47

Data da execução: 01/11/2026.

## Escopo e ponto de partida

Implementei a [issue #47 — Tratar falha ao salvar e ao excluir](https://github.com/aggak/pixel-dfe/issues/47), atribuída ao meu usuário e correspondente à issue [36] do enunciado. Parti da branch `issue-46-registro-inexistente` no commit `0ef98a1`.

Nessa base, os formulários de tarefa e de projeto já mostravam um aviso e preservavam os campos depois de uma falha de gravação. A exclusão também já avisava quando falhava. Até então, essas falhas só tinham sido conferidas com rotas interceptadas no navegador devolvendo 500. A issue pede que os fluxos sejam conferidos com a API indisponível. Por isso, nos testes, encerrei o processo real do json-server e o reiniciei na mesma porta.

## Registro de execução

1. Rodei uma sondagem com o json-server encerrado. Gravar com a API parada mostrava o aviso e mantinha os dados. Já a falha de exclusão tirava o foco do diálogo de confirmação, que caía no `body`.
2. Escrevi `tests/falha-gravar-excluir.cjs`. Cada cenário desliga o json-server, tenta a operação, confere o aviso, o foco e os dados preservados, religa o servidor e confirma que a mesma ação grava. Os quatro fluxos de gravação passaram logo na primeira execução, porque descrevem um comportamento que já existia. A exclusão falhou porque o foco não estava no botão de confirmar.
3. Diagnóstico: durante o envio, o botão "Excluir tarefa" recebia `isDisabled`, e o React Aria tira o foco de um botão desabilitado. Troquei por `isLoading` com `showTextWhileLoading`. O componente `Button` do vendor repassa esse estado como `isPending`, que bloqueia novos cliques sem perder o foco. Depois da falha, Enter tenta a exclusão de novo.
4. O cenário de status falhou em seguida porque o teste conferia o foco no mesmo instante em que o aviso aparecia. O menu ainda estava fechando, e o foco chegava ao seletor cerca de 100 ms depois. Substituí a checagem instantânea por uma espera. Não houve mudança na aplicação.
5. Ao rodar a suíte três vezes, a primeira execução terminou os cenários e travou na limpeza. Um processo encerrado por `kill()` fica com `exitCode` nulo e só `signalCode` preenchido, então o `finally` esperava um `exit` que já tinha acontecido. Passei a considerar `signalCode`.
6. Registrei o escopo em `.agent/handoff/issue-atual.md` e rodei as três execuções, a suíte da #46 e a validação completa.

## Estrutura utilizada

| Arquivo | Alteração |
| --- | --- |
| `src/components/CartaoTarefa.tsx` | O botão de confirmar da exclusão fica pendente, e não desabilitado, durante o envio. |
| `tests/falha-gravar-excluir.cjs` | Nova suíte com o json-server encerrado e reiniciado: 8 cenários e a checagem final dos bancos. |

### Dependências externas

| Dependência | Tipo | Adicionada ao `package.json`? | Uso |
| --- | --- | --- | --- |
| Playwright | Já presente em `node_modules` | Não | Suítes de navegador |

## Critérios da issue

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Mostrar uma mensagem quando salvar ou excluir falhar. | Aviso com `role="alert"` no cadastro e na edição de tarefa e de projeto, na exclusão (lista, quadro e projeto) e na mudança de status. | `tests/falha-gravar-excluir.cjs` |
| Preservar os dados digitados após uma falha de gravação. | Os sete campos da tarefa e os quatro do projeto continuam preenchidos; com a API de volta, o mesmo envio grava uma única vez. | Cenários de cadastro e edição |
| Conferir os dois fluxos com a API indisponível. | Conferidos com o processo do json-server encerrado, sem interceptar rotas. | `desligarApi()` na suíte |

## Falhas encontradas e correções

- **Falha real corrigida:** quando a exclusão falhava, o foco saía do diálogo de confirmação. Quem usa o teclado precisava procurar o diálogo de novo.
- **Ajustes só de teste:** a espera pelo foco depois do fechamento do menu de status e a limpeza de processos encerrados por sinal.
- **Fora do escopo:** os botões "Salvar" dos formulários continuam com `isDisabled` durante o envio. A `Ficha` já devolve o foco ao formulário depois da falha, e a suíte confirma que ele fica dentro da ficha.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado (`tsc -b` e `vite build`). |
| `npm run lint` | Aprovado, sem erros e sem avisos. |
| `node tests/falha-gravar-excluir.cjs` | 8 cenários e a checagem dos bancos aprovados; 3 de 3 execuções. |
| `node tests/registro-inexistente.cjs` | Aprovado (regressão da #46). |
| `node .claude/skills/testing-pixel-dfe/scripts/validate-delivery.mjs` | Aprovado: arquivos protegidos intactos, build, lint, `git diff --check` e as 15 suítes existentes. |

## Como repetir as verificações

```powershell
npm ci
npm run build
npm run lint
node tests/falha-gravar-excluir.cjs
node tests/registro-inexistente.cjs
```

## Commits e limites

- Commits: `31828eb` (Mantém o foco na confirmação quando a exclusão falha (#47)), `50ea8f5` (Testa falhas ao salvar e excluir com a API parada (#47)) — PR: `pendente`.
- Limites: a suíte derruba a API entre o preenchimento e o envio. Ela não cobre a queda no meio de uma resposta já iniciada nem a lentidão sem queda.