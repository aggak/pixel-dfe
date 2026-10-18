# Relatório de execução — Marco 3 / issue #31

Data da verificação: 18/10/2026.

## Escopo e ponto de partida

Implementei a [issue #31 — Validar o formulário](https://github.com/aggak/pixel-dfe/issues/31) no formulário compartilhado de tarefas. Atualizei a cópia local até a `main` no commit `8940f53`, que já continha o cadastro, a edição e a escrita na API. Parti dessa estrutura, sem alterar o formulário de projetos da issue #33.

## Estrutura utilizada

- `src/components/FormularioTarefa.tsx`: concentra os campos usados por `NovaTarefa` e `EditarTarefa`, consulta os projetos por `listarProjetos` e entrega os dados a `onSalvar`.
- `src/pages/NovaTarefa.tsx` e `src/pages/EditarTarefa.tsx`: continuaram usando o mesmo componente; a validação passou a valer nos dois fluxos sem duplicar formulários.
- `src/tipos.ts` e `src/api.ts`: mantive o contrato de `NovaTarefa` e as funções de gravação existentes.

## Falhas encontradas e correções

| Situação encontrada | Correção realizada | Resultado |
| --- | --- | --- |
| Os atributos `required` impediam o envio vazio pelo navegador, mas não mostravam orientação junto a cada campo. | Adicionei validação no envio e mensagens abaixo de projeto, título, responsável e prazo. | O formulário indica quais campos precisam de correção antes de chamar `onSalvar`. |
| Título e responsável podiam conter apenas espaços, pois o preenchimento nativo considerava esses valores presentes. | Verifiquei os dois valores com `trim()` antes de gravar. | Valores compostos só por espaços são recusados. |
| A mensagem nativa do navegador não atendia ao formato de erro junto ao campo. | Usei `noValidate` no formulário e mantive os atributos `required`, passando a apresentar as mensagens do componente. | Os erros aparecem no próprio formulário e são retirados do campo quando ele é alterado. |

Mantive a proteção existente contra projeto removido da lista, falha ou ausência de projetos. Também conferi o bloqueio do botão e de envios repetidos durante a gravação; esse controle já existia no componente e foi preservado.

## Validação e resultados

Na `main` após a integração, `npm run build`, `npm run lint` e `git diff --check` terminaram sem erro. Executei as suítes existentes em navegador e com banco temporário: `tests/formulario-tarefa.cjs` (17 cenários), `tests/nova-tarefa.cjs` (14), `tests/editar-tarefa.cjs` (12) e `tests/api-escrita.mjs` (12). Foram **55 cenários aprovados**; os testes informaram que os bancos originais permaneceram intactos.

Além dessas suítes, conferi em um cenário temporário o envio vazio e os valores compostos por espaços no cadastro, sem persistir dados inválidos. Esse cenário não foi acrescentado ao repositório.

A implementação está no commit `8b96b0d`. O [PR #67](https://github.com/aggak/pixel-dfe/pull/67) foi integrado à `main` e a issue #31 está fechada.

## Limites

A validação acrescentada verifica a presença dos quatro campos obrigatórios e recusa espaços isolados em título e responsável. Não acrescentei regras de negócio para o prazo nem validação no servidor. A verificação em navegador utilizou as suítes do projeto; não representa uma auditoria completa em todos os navegadores.
