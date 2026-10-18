# Relatório de execução — Marco 3 / issue #32

Data da verificação: 18/10/2026.

## Escopo e ponto de partida

Implementei a [issue #32 — Tornar o formulário acessível](https://github.com/aggak/pixel-dfe/issues/32) sobre a validação da #31. O componente já tinha sete `label` associados aos respectivos campos e estilos de foco visível. Preservei esses elementos e trabalhei na identificação dos erros e no retorno do foco após um envio inválido.

## Estrutura utilizada

- `src/components/FormularioTarefa.tsx`: mantive o formulário compartilhado entre cadastro e edição e usei os identificadores gerados por `useId` para relacionar cada campo à sua mensagem.
- `tests/formulario-tarefa.cjs`, `tests/nova-tarefa.cjs` e `tests/editar-tarefa.cjs`: usei as suítes existentes para conferir labels, navegação por Tab, envio por Enter, cadastro e edição.

## Falhas encontradas e correções

| Situação encontrada | Correção realizada | Resultado |
| --- | --- | --- |
| As mensagens da #31 eram visíveis, mas ainda não estavam relacionadas aos campos por atributos acessíveis. | Adicionei `aria-invalid` aos campos com erro, `aria-describedby` apontando para a mensagem correspondente e `role="alert"` nas mensagens. | Cada erro tem texto próprio e associação com o campo; a identificação não depende apenas da cor. |
| No teste direcionado de envio inválido, o foco permaneceu no botão de salvar. | Após atualizar os erros, programei o foco para o primeiro campo inválido. | O teste repetido confirmou o foco no projeto vazio no cadastro e no título vazio na edição. |
| O projeto já podia apresentar aviso de carregamento, falha ou registro removido. | Mantive o aviso existente e acrescentei a referência ao erro de validação quando ele aparece. | O campo de projeto continua associado à orientação aplicável sem reutilizar o identificador da mensagem de erro. |

Os sete labels já estavam ligados aos campos por `htmlFor` e `id`; não foi necessário criar novos campos nem alterar os nomes visíveis. Os atributos `required` também foram mantidos.

## Validação e resultados

Depois da integração, `npm run build`, `npm run lint` e `git diff --check` passaram. As quatro suítes existentes aprovaram **55 cenários**: 17 do formulário, 14 do cadastro, 12 da edição e 12 da API. A suíte do formulário confirmou labels associados, identificadores únicos, envio por Enter, navegação por Tab em 320 px, bloqueio durante a gravação e preservação dos bancos originais.

Executei ainda dois cenários temporários, não versionados, para verificar o texto e a associação das mensagens, o foco no primeiro erro, a correção do campo e o envio por Enter na edição. A primeira execução revelou a falha de foco descrita acima; após a correção, os dois cenários passaram. Não realizei teste com leitor de tela.

A implementação está no commit `51b21a2`. O [PR #67](https://github.com/aggak/pixel-dfe/pull/67) foi integrado à `main` e a issue #32 está fechada. A issue #33 permanece aberta e não foi alterada nesta entrega.

## Limites

Os testes confirmam o comportamento observado no navegador automatizado e o uso de teclado coberto pelas suítes. Eles não substituem uma avaliação completa com tecnologias assistivas nem testes em todos os navegadores.
