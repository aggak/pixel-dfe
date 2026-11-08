# Pixel

Organize projetos e tarefas em um só lugar. Crie, edite e acompanhe status, prioridades, responsáveis e prazos.

![Quadro kanban da Pixel no tema escuro, com colunas A fazer, Em andamento, Em revisão e Concluída e cartões com projeto, responsável, prazo, status e prioridade](docs/images/pixel-quadro.png)

<details>
<summary>Lista com busca e filtros</summary>

![Lista de tarefas da Pixel no tema escuro filtrada pela busca "ar" e status A fazer, com projeto, responsável, prazo, status e prioridade](docs/images/pixel-lista-filtros.png)

</details>

<details>
<summary>Projetos e página do projeto</summary>

![Página de projetos da Pixel no tema escuro, com cartões Gerenciador de Tarefas e Modelagem da Biblioteca e botões de abrir e editar](docs/images/pixel-projetos.png)

![Página do projeto Gerenciador de Tarefas da Pixel no tema escuro, com lista de tarefas, responsáveis, prazos, status e prioridades](docs/images/pixel-pagina-projeto.png)

</details>

<details>
<summary>Detalhe e cadastro em fichas</summary>

![Painel de detalhes da tarefa Listar as tarefas na tela da Pixel no tema escuro, com projeto, responsável, prazo, status e prioridade](docs/images/pixel-ficha-detalhe.png)

![Formulário de nova tarefa da Pixel no tema escuro com erros de validação em título, projeto, responsável e prazo](docs/images/pixel-ficha-nova-validacao.png)

</details>

<details>
<summary>Mudança de status pelo selo do cartão</summary>

<img src="docs/images/pixel-menu-status.png" width="318" alt="Detalhe ampliado de cartão de tarefa da Pixel no tema escuro com menu de status aberto nas opções A fazer, Em andamento, Em revisão e Concluída">

</details>

## Como rodar

Requer **Node.js 24 ou superior**, com npm. Na pasta do projeto:

```bash
npm ci
```

Em um terminal, inicie a API em `http://localhost:3000`:

```bash
npx json-server db.json
```

Em outro terminal, na mesma pasta, inicie a aplicação:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`. Mantenha os dois terminais abertos.

Para verificar o TypeScript e gerar os arquivos de produção em `dist/`:

```bash
npm run build
```

**Framework:** React com TypeScript.

## Equipe

Projeto da disciplina **Desenvolvimento Frontend**, ULBRA — 2026.2.

- Gabriela de Araújo Reis
- Euclides Carlos Pilon Neto
- Linnek Lima de Araujo

[Créditos e licenças](public/design-licenses/THIRD_PARTY_NOTICES.txt)
