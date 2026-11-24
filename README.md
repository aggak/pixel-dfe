<h1 align="center">Pixel</h1>

<p align="center">
  <strong>Seus projetos acadêmicos, em um só lugar.</strong><br>
  Organize tarefas, acompanhe prazos e veja suas entregas avançarem.
</p>

<h3 align="center"><a href="https://pixel-dfe-project.up.railway.app/">Acesse a Pixel</a></h3>

<p align="center">
  <sub>Lista e kanban · Busca e filtros · Interface responsiva</sub>
</p>

<p align="center">
  <a href="https://pixel-dfe-project.up.railway.app/">
    <img src="docs/images/visao-geral.png" width="1000" alt="Pixel no computador, com o quadro de tarefas, e no celular, com os detalhes de uma tarefa">
  </a>
</p>

## Do projeto à próxima tarefa

- **Projetos organizados:** acompanhe disciplinas, tarefas concluídas e o próximo prazo.
- **Lista ou kanban:** escolha sua visão e encontre tarefas com busca e filtros.
- **Tudo à mão:** crie, edite e exclua tarefas; ajuste status, prioridade e responsável.
- **Sem perder o contexto:** abra detalhes e formulários em fichas sobre a página.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/quadro-arrastar.gif" alt="Cartão arrastado da coluna A fazer para Em andamento e, depois, reordenado dentro da coluna">
      <br>
      <strong>Arraste para mudar o status</strong>
      <br>
      <sub>Mova cartões entre colunas ou mude a ordem dentro de uma delas.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/ficha-tarefa.png" alt="Detalhes de uma tarefa abertos ao lado do cartão, sem sair do quadro">
      <br>
      <strong>Detalhes sem sair da tela</strong>
      <br>
      <sub>A ficha abre ao lado do cartão e a página continua no lugar.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/projetos.png" alt="Cartões de projeto com ícone, disciplina, descrição e barra de andamento">
      <br>
      <strong>Projetos com andamento</strong>
      <br>
      <sub>Cada projeto mostra a disciplina e quanto das tarefas já foi concluído.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/temas.png" alt="O mesmo quadro nos temas Ameixa, Floresta e Ameixa clara">
      <br>
      <strong>Três temas</strong>
      <br>
      <sub>Ameixa, Floresta e Ameixa clara, escolhidos em Configurações.</sub>
    </td>
  </tr>
</table>

## Personalidade em cada detalhe

O gatinho acompanha os estados da aplicação com animações em pixel art, do carregamento às telas vazias.

<p align="center">
  <img src="docs/images/gatinho-carregando-animacao.png" width="96" alt="Gatinho carregando" title="Carregamento">
  <img src="docs/images/gatinho-dormindo-animacao.png" width="96" alt="Gatinho dormindo" title="Sem tarefas">
  <img src="docs/images/gatinho-olhando-animacao.png" width="96" alt="Gatinho olhando ao redor" title="Busca sem resultados">
  <img src="docs/images/gatinho-lavando-animacao.png" width="96" alt="Gatinho se lavando" title="Coluna vazia">
  <img src="docs/images/gatinho-cochilando-animacao.png" width="96" alt="Gatinho cochilando" title="Registro não encontrado">
  <img src="docs/images/gatinho-costas-animacao.png" width="96" alt="Gatinho de costas" title="Erro ou página não encontrada">
  <img src="docs/images/gatinho-abanando-animacao.png" width="96" alt="Gatinho abanando o rabo" title="Carregamento na ficha">
</p>

Navegação por teclado, foco visível e respeito à preferência por movimento reduzido.

<sub>Desenvolvido com React e TypeScript.</sub>

## Como rodar

Requer **Node.js 24 ou superior**, com npm. Na pasta do projeto:

```bash
npm ci
```

Em um terminal, inicie a API em `http://localhost:3000`:

```bash
npm run api
```

A API lê e grava no `db.json`, que traz os dados de demonstração; `git checkout db.json` desfaz o que você gravar ao experimentar. O `db.seed.json` preserva os dados iniciais da disciplina e serve de base para os testes.

Em outro terminal, na mesma pasta, inicie a aplicação:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`. Mantenha os dois terminais abertos.

Para verificar o TypeScript e gerar os arquivos de produção em `dist/`:

```bash
npm run build
```

Para rodar os testes automatizados, com o Google Chrome instalado:

```bash
npm test
```

Cada suíte sobe a própria API e a própria aplicação em portas livres, sobre uma cópia temporária dos dados, sem tocar no `db.json`. Para rodar só algumas, informe os nomes: `npm test -- marco-2 estado-erro`.

## Equipe

Equipe **Pixel**. Projeto da disciplina **Desenvolvimento Frontend**, ULBRA — 2026.2.

- Gabriela de Araújo Reis
- Euclides Carlos Pilon Neto
- Linnek Lima de Araujo

[Créditos e licenças](public/design-licenses/THIRD_PARTY_NOTICES.txt)
