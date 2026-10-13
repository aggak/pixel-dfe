# Pixel

Gerenciador de projetos e tarefas da disciplina **Desenvolvimento Frontend**, ULBRA — 2026.2.

**Framework:** React com TypeScript.

## Integrantes

- Gabriela de Araújo Reis
- Euclides Carlos Pilon Neto
- Linnek Lima de Araujo

## Pré-requisitos

- Node.js 24 ou superior, com npm
- Git para clonar o repositório

## Como rodar

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/aggak/pixel-dfe.git
cd pixel-dfe
npm ci
```

A API e o frontend precisam ficar em execução ao mesmo tempo, em dois terminais na raiz do projeto.

### 1. Iniciar a API

```bash
npm exec -- json-server db.json --host 127.0.0.1 --port 3000
```

A API fica em `http://localhost:3000`. Para conferir os dados, abra:

- `http://localhost:3000/tarefas`: cinco tarefas nos dados iniciais
- `http://localhost:3000/projetos`: dois projetos nos dados iniciais
- `http://localhost:3000/projetos/1?_embed=tarefas`: projeto 1 com suas quatro tarefas iniciais

### 2. Iniciar o frontend

Em outro terminal:

```bash
npm run dev -- --host 127.0.0.1
```

Abra o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173`. Se essa porta estiver ocupada, o Vite poderá escolher outra.

Mantenha os dois terminais abertos enquanto usa a aplicação. Para encerrar cada servidor, pressione `Ctrl+C` no respectivo terminal.

No Windows, se o PowerShell bloquear a execução de `npm.ps1`, use `npm.cmd` no lugar de `npm` nos comandos.

### Endereço da API

Por padrão, o frontend consulta `http://localhost:3000`. Se a API estiver em outro endereço, crie um arquivo `.env.local` na raiz do projeto e defina:

```dotenv
VITE_API_URL=http://localhost:3000
```

Substitua o valor pelo endereço da API e reinicie o Vite. Essa variável também deve estar definida antes de gerar o build quando for necessário usar outro endereço.

## Funcionalidades atuais

O Marco 2 inclui a leitura dos dados da API e a navegação entre:

- `/`: lista de tarefas
- `/tarefas/:id`: detalhes da tarefa
- `/projetos`: lista de projetos
- `/projetos/:id`: detalhes do projeto e suas tarefas

O cabeçalho permite alternar entre Tarefas e Projetos. Endereços que não correspondem a essas rotas exibem a página não encontrada.

## Verificações

Na raiz do projeto:

```bash
npm run build
npm run lint
```

O build verifica o TypeScript e gera os arquivos de produção em `dist/`. O lint verifica o código com Oxlint.

A suíte de navegador está em `tests/marco-2.cjs` e requer Microsoft Edge instalado e o pacote Playwright disponível. As instruções e os pré-requisitos específicos estão na seção de execução do [relatório do Marco 2](docs/RELATORIO_MARCO_2_EUCLIDES.md#execução-e-reprodução).

## Dados do projeto

- `db.json`: dados usados pela API local
- `db.seed.json`: cópia dos dados iniciais; deve ser preservada
- `src/tipos.ts`: contrato de tipos de projetos e tarefas
