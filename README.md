# Pixel

Gerenciador de projetos e tarefas da disciplina **Desenvolvimento Frontend**, ULBRA — 2026.2.

**Framework:** React com TypeScript.

## Integrantes

- Gabriela de Araújo Reis
- Euclides Carlos Pilon Neto
- Linnek Lima de Araujo

## Apresentação do Marco 2

[Slide no Canva](https://canva.link/jjbglwu5r7h0k76)

## Como rodar

É necessário ter **Node.js 24 ou superior**, com npm instalado.

Na pasta do projeto, instale as dependências:

```bash
npm ci
```

Inicie a API em um terminal:

```bash
npx json-server db.json
```

A API fica em `http://localhost:3000`.

Em outro terminal, na mesma pasta, inicie a aplicação:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`. Mantenha os dois terminais abertos.

## Build

Para verificar o TypeScript e gerar os arquivos de produção em `dist/`:

```bash
npm run build
```
