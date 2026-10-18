# Pixel · Design

Prévia de design separada da aplicação da equipe, para experimentar telas e fluxos.

Requisitos: **Node.js 24+**, npm e internet para carregar fontes e ícones.

```sh
git clone --branch teste-design https://github.com/aggak/pixel-dfe.git pixel-design
cd pixel-design
npm ci
npm run dev
```

Abra [http://localhost:5173/design/index.html](http://localhost:5173/design/index.html). Se o Vite indicar outra porta, ajuste o endereço.

Explore **Tarefas/Projetos** e **Lista/Quadro**. No rodapé, **Testar design** permite comparar seis paletas, Claro/Escuro e situações; **Restaurar padrão** retorna ao início.

Não é necessário iniciar a API. Os dados ficam na memória da prévia; recarregar restaura os dados demonstrativos. Esta versão não integra o design à aplicação.

Se já possui o repositório: `git fetch origin` e `git switch teste-design`.
