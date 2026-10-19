// Integração da issue #33 com aplicação real e banco temporário.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdir, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { criarUi, focoVisivel, lancarNavegador } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const processos = [];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let temporario;
let total = 0;

async function ate(descricao, verificar) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (await verificar()) return;
    await dormir(100);
  }
  throw new Error(`Tempo esgotado: ${descricao}`);
}

async function conferir(nome, executar) {
  await executar();
  total++;
  console.log(`OK: ${nome}`);
}

const portasUsadas = new Set();

// O sistema escolhe uma porta livre; portas já entregues nesta execução não se repetem.
async function portaLivre() {
  for (;;) {
    const servidor = createServer();
    await new Promise((resolve, reject) => {
      servidor.once("error", reject);
      servidor.listen(0, "127.0.0.1", resolve);
    });
    const { port } = servidor.address();
    await new Promise((resolve) => servidor.close(resolve));
    if (!portasUsadas.has(port)) {
      portasUsadas.add(port);
      return port;
    }
  }
}

const ativo = (processo) => processo.exitCode === null && processo.signalCode === null;

async function encerrar(processo) {
  if (!ativo(processo)) return;
  const fim = new Promise((resolve) => processo.once("exit", resolve));
  processo.kill();
  await fim;
}

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedOriginal);
  temporario = await mkdtemp(join(tmpdir(), "pixel-projetos-33-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  function iniciar(arquivo, argumentos, env = process.env) {
    const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], {
      cwd: raiz, env, windowsHide: true, stdio: "pipe",
    });
    processo.stdout.on("data", () => {});
    processo.stderr.on("data", (dado) => process.stderr.write(dado));
    processos.push(processo);
    return processo;
  }
  // A porta é liberada antes de o servidor ocupá-la. Se outro processo a tomar nesse
  // intervalo, o servidor encerra (ou responde outro conteúdo) e a subida é repetida
  // com uma nova porta. A resposta é conferida para não aceitar um servidor alheio.
  async function subir(descricao, arquivo, argumentos, env, caminhoTeste, confirmar) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const porta = await portaLivre();
      const base = `http://127.0.0.1:${porta}`;
      const processo = iniciar(arquivo, argumentos(porta), env);
      for (let espera = 0; espera < 150 && ativo(processo); espera++) {
        try {
          const resposta = await fetch(`${base}${caminhoTeste}`);
          if (resposta.ok && (await confirmar(resposta)) && ativo(processo)) return base;
        } catch {}
        await dormir(100);
      }
      await encerrar(processo);
      console.warn(`Aviso: ${descricao} não iniciou na porta ${porta} (tentativa ${tentativa}).`);
    }
    throw new Error(`Não foi possível iniciar ${descricao}.`);
  }
  const idsSeed = JSON.stringify(seed.projetos.map((p) => p.id));
  const api = await subir(
    "a API temporária",
    "node_modules/json-server/lib/bin.js",
    (porta) => [banco, "--host", "127.0.0.1", "--port", String(porta)],
    process.env,
    "/projetos",
    async (resposta) => JSON.stringify((await resposta.json()).map((p) => p.id)) === idsSeed,
  );
  const origem = await subir(
    "a aplicação",
    "node_modules/vite/bin/vite.js",
    (porta) => ["--host", "127.0.0.1", "--port", String(porta), "--strictPort"],
    { ...process.env, VITE_API_URL: api },
    "/",
    async (resposta) => (await resposta.text()).includes("/src/main.tsx"),
  );
  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const requisicoesApi = [];
  const gravacoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (req) => {
    if (req.url().startsWith(api)) {
      const caminhoReq = new URL(req.url()).pathname;
      requisicoesApi.push(`${req.method()} ${caminhoReq}`);
      if (["POST", "PATCH", "PUT"].includes(req.method())) {
        gravacoes.push({ metodo: req.method(), caminho: caminhoReq, dados: req.postDataJSON() });
      }
    }
  });
  const ui = criarUi(page);
  const campo = ui.campo;
  const salvarNovo = () => page.getByRole("button", { name: "Salvar projeto", exact: true });
  const salvarEdicao = () => page.getByRole("button", { name: "Salvar alterações", exact: true });
  const caminho = () => new URL(page.url()).pathname;
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));
  async function esperarEdicao(id) {
    const dados = (await lerBanco()).projetos.find((p) => p.id === id);
    await page.locator("form").waitFor();
    await ate(`valores do projeto ${id}`, async () => (await campo("Nome").inputValue()) === dados.nome);
    return dados;
  }
  async function abrirEdicao(id = "1") {
    await page.goto(`${origem}/projetos/${id}/editar`);
    return esperarEdicao(id);
  }
  async function trocarRota(rota) {
    await page.evaluate((url) => {
      history.pushState({}, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, rota);
  }

  await conferir("acesso a /projetos/novo pela lista, direto e recarga sem interpretar novo como ID", async () => {
    await page.goto(`${origem}/projetos`);
    await page.getByRole("link", { name: seed.projetos[0].nome, exact: true }).waitFor();
    requisicoesApi.length = 0;
    await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
    await page.locator("form").waitFor();
    assert.equal(caminho(), "/projetos/novo");
    assert.equal(await page.getByRole("dialog", { name: "Novo projeto", exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Novo projeto", exact: true }).count(), 1);
    for (const rotulo of ["Nome", "Descrição", "Disciplina", "Criado em"]) {
      assert.equal(await campo(rotulo).count(), 1, rotulo);
      assert.equal(await campo(rotulo).inputValue(), "", rotulo);
    }
    assert.equal(await salvarNovo().count(), 1);
    await page.reload();
    await page.locator("form").waitFor();
    assert.ok(!requisicoesApi.some((r) => r.includes("/projetos/novo")), requisicoesApi.join(", "));
    await page.goto(`${origem}/projetos/1`);
    await page.getByRole("heading", { name: seed.projetos[0].nome, exact: true }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
  });

  await conferir("validação de campos obrigatórios, associação acessível e foco no primeiro erro", async () => {
    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    gravacoes.length = 0;
    await campo("Nome").fill("   ");
    await campo("Disciplina").fill("   ");
    await salvarNovo().click();
    assert.equal(gravacoes.length, 0);
    for (const rotulo of ["Nome", "Disciplina", "Criado em"]) {
      assert.equal(await campo(rotulo).getAttribute("aria-required"), "true", rotulo);
    }
    for (const [rotulo, msg] of [
      ["Nome", "Informe o nome do projeto."],
      ["Disciplina", "Informe a disciplina."],
      ["Criado em", "Informe a data de criação."],
    ]) {
      assert.equal(await campo(rotulo).getAttribute("aria-invalid"), "true", rotulo);
      const descId = await campo(rotulo).getAttribute("aria-describedby");
      assert.ok(descId, rotulo);
      assert.equal(await page.locator(`[id="${descId}"]`).innerText(), msg);
    }
    await ate("foco no primeiro campo inválido", async () =>
      campo("Nome").evaluate((el) => el === document.activeElement),
    );
  });

  async function preencherProjeto(dados) {
    await campo("Nome").fill(dados.nome);
    await campo("Descrição").fill(dados.descricao);
    await campo("Disciplina").fill(dados.disciplina);
    await campo("Criado em").fill(dados.criadoEm);
  }
  const projetosComNome = async (nome) => (await lerBanco()).projetos.filter((p) => p.nome === nome);

  await conferir("POST real grava sem id e sem espaços nas pontas, retorna à lista e disponibiliza em tarefas", async () => {
    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    const novo = {
      nome: "Portal Acadêmico Pixel",
      descricao: "Cadastro completo do Marco 3",
      disciplina: "Desenvolvimento Frontend",
      criadoEm: "2026-10-18",
    };
    await preencherProjeto({ ...novo, nome: `  ${novo.nome}  `, disciplina: ` ${novo.disciplina}   ` });
    gravacoes.length = 0;
    await salvarNovo().click();
    await ate("retorno à lista de projetos", async () => caminho() === "/projetos");
    await page.getByRole("link", { name: novo.nome, exact: true }).waitFor();
    assert.deepEqual(gravacoes, [{ metodo: "POST", caminho: "/projetos", dados: novo }]);
    const db = await lerBanco();
    assert.equal(db.projetos.length, seed.projetos.length + 1);
    const criado = db.projetos.find((p) => p.nome === novo.nome);
    assert.ok(criado && typeof criado.id === "string" && criado.id.length > 0);
    assert.deepEqual(criado, { id: criado.id, ...novo });
    await page.goto(`${origem}/tarefas/nova`);
    await page.locator("form").waitFor();
    await ate("novo projeto no seletor de tarefas", async () =>
      (await criarUi(page).opcoes("Projeto")).some((o) => o.texto === novo.nome && o.value === criado.id),
    );
    // A opção também aparece no seletor visível.
    await criarUi(page).seletor("Projeto").click();
    await page.getByRole("option", { name: novo.nome, exact: true }).waitFor();
    await page.keyboard.press("Escape");
  });

  await conferir("falha 500 ou de conexão no POST mantém os dados e a nova tentativa cria um único projeto", async () => {
    const quantidade = (await lerBanco()).projetos.length;
    const dados = { nome: "Projeto após falha de envio", descricao: "Sem gravação na falha", disciplina: "Sistemas Operacionais", criadoEm: "2026-10-19" };
    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    await preencherProjeto(dados);
    await page.route(`${api}/projetos`, (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 500, json: {} }) : route.continue(),
    );
    gravacoes.length = 0;
    await salvarNovo().click();
    await page.getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto" }).waitFor();
    assert.equal(caminho(), "/projetos/novo");
    assert.equal(await campo("Nome").inputValue(), dados.nome);
    assert.equal((await lerBanco()).projetos.length, quantidade);
    await page.unrouteAll();

    await page.route(`${api}/projetos`, (route) =>
      route.request().method() === "POST" ? route.abort("connectionrefused") : route.continue(),
    );
    await ate("envio liberado após erro 500", () => salvarNovo().isEnabled());
    await salvarNovo().click();
    await page.getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto" }).waitFor();
    assert.equal((await lerBanco()).projetos.length, quantidade);
    assert.equal(await campo("Disciplina").inputValue(), dados.disciplina);
    await page.unrouteAll();

    await ate("envio liberado após falha de rede", () => salvarNovo().isEnabled());
    await salvarNovo().click();
    await ate("retorno à lista após nova tentativa", async () => caminho() === "/projetos");
    await page.getByRole("link", { name: dados.nome, exact: true }).waitFor();
    assert.equal(gravacoes.filter((g) => g.metodo === "POST").length, 3);
    assert.equal((await lerBanco()).projetos.length, quantidade + 1);
    assert.equal((await projetosComNome(dados.nome)).length, 1);
  });

  await conferir("nova tentativa após falha de POST não sobrescreve projeto com mesmos campos criado em outra aba", async () => {
    const quantidade = (await lerBanco()).projetos.length;
    const dadosIniciais = { nome: "Projeto Concorrente", descricao: "Mesmos campos iniciais", disciplina: "Banco de Dados", criadoEm: "2026-10-20" };
    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    await preencherProjeto(dadosIniciais);
    await page.route(`${api}/projetos`, (route) =>
      route.request().method() === "POST" ? route.abort("connectionrefused") : route.continue(),
    );
    gravacoes.length = 0;
    await salvarNovo().click();
    await page.getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto" }).waitFor();
    await page.unrouteAll();

    // Outra aba cria um projeto com exatamente os mesmos campos enquanto o formulário segue aberto.
    const respOutraAba = await fetch(`${api}/projetos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosIniciais),
    });
    assert.equal(respOutraAba.ok, true);
    const criadoOutraAba = await respOutraAba.json();

    const dadosRenomeados = { ...dadosIniciais, nome: "Projeto Renomeado na Primeira Aba" };
    await campo("Nome").fill(dadosRenomeados.nome);
    await ate("envio liberado após falha", () => salvarNovo().isEnabled());
    await salvarNovo().click();
    await ate("retorno à lista após criar novo projeto", async () => caminho() === "/projetos");
    await page.getByRole("link", { name: dadosRenomeados.nome, exact: true }).waitFor();
    await page.getByRole("link", { name: dadosIniciais.nome, exact: true }).waitFor();

    assert.equal(gravacoes.filter((g) => g.metodo === "PATCH").length, 0);
    const db = await lerBanco();
    assert.equal(db.projetos.length, quantidade + 2);
    assert.deepEqual(db.projetos.find((p) => p.id === criadoOutraAba.id), criadoOutraAba);
    assert.equal((await projetosComNome(dadosRenomeados.nome)).length, 1);
  });

  await conferir("POST pendente no cadastro bloqueia duplicidade e ignora resposta após saída pelo histórico", async () => {
    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    const dados = { nome: "Projeto com envio lento", descricao: "Teste de bloqueio", disciplina: "Redes", criadoEm: "2026-10-21" };
    await preencherProjeto(dados);
    await page.route(`${api}/projetos`, async (route) => {
      if (route.request().method() === "POST") await dormir(800);
      try { await route.continue(); } catch {}
    });
    gravacoes.length = 0;
    await salvarNovo().click();
    await ate("botão bloqueado no POST", () => page.locator('form button[type="submit"]').isDisabled());
    await page.evaluate(() => document.querySelector("form").requestSubmit());
    assert.equal(caminho(), "/projetos/novo");
    await ate("lista após POST lento", async () => caminho() === "/projetos");
    assert.equal(gravacoes.filter((g) => g.metodo === "POST").length, 1);
    await page.unrouteAll();

    await page.goto(`${origem}/projetos/novo`);
    await page.locator("form").waitFor();
    await preencherProjeto({ ...dados, nome: "Projeto abandonado no menu" });
    await page.route(`${api}/projetos`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await dormir(800);
      try { await route.fulfill({ status: 201, json: { id: "simulado", ...dados } }); } catch {}
    });
    await salvarNovo().click();
    await ate("envio em curso", () => page.locator('form button[type="submit"]').isDisabled());
    // A ficha bloqueia o fundo (inert): a saída durante o envio é feita pelo histórico real.
    await trocarRota("/");
    await page.getByRole("heading", { name: "Tarefas", exact: true }).waitFor();
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    assert.equal(await page.locator("form").count(), 0, "o formulário foi desmontado antes da resposta tardia");
    await dormir(1000);
    assert.equal(caminho(), "/");
    await page.unrouteAll();
  });

  await conferir("cancelar e fechar na criação retornam à lista sem gravar", async () => {
    const antes = await lerBanco();
    gravacoes.length = 0;
    for (const acao of ["Cancelar", "Fechar novo projeto"]) {
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await campo("Nome").fill("Projeto descartado");
      await page.getByRole("button", { name: acao, exact: true }).click();
      await ate(`lista após ${acao}`, async () => caminho() === "/projetos");
    }
    assert.equal(gravacoes.length, 0);
    assert.deepEqual(await lerBanco(), antes);
  });

  await conferir("botão de edição, acesso direto e recarga em /projetos/:id/editar com dados atuais", async () => {
    await page.goto(`${origem}/projetos/1`);
    await page.getByRole("heading", { name: seed.projetos[0].nome, exact: true }).waitFor();
    await page.getByRole("button", { name: "Detalhes do projeto", exact: true }).click();
    await page.getByRole("button", { name: "Editar projeto", exact: true }).click();
    await page.getByRole("dialog", { name: "Editar projeto", exact: true }).waitFor();
    assert.equal(caminho(), "/projetos/1/editar");
    const projeto = await esperarEdicao("1");
    const campos = { Nome: "nome", Descrição: "descricao", Disciplina: "disciplina", "Criado em": "criadoEm" };
    for (const [rotulo, atributo] of Object.entries(campos)) {
      assert.equal(await campo(rotulo).inputValue(), projeto[atributo], rotulo);
    }
    await page.reload();
    await esperarEdicao("1");
    assert.equal(await campo("Criado em").inputValue(), projeto.criadoEm);
  });

  await conferir("PATCH real mantém ID e tarefas vinculadas, persiste campos e retorna ao detalhe", async () => {
    await abrirEdicao("1");
    const dados = {
      nome: "Gerenciador Pixel Atualizado",
      descricao: "Descrição revisada do projeto\ncom segunda linha",
      disciplina: "Engenharia de Software",
      criadoEm: "2026-10-15",
    };
    await campo("Nome").fill(`   ${dados.nome} `);
    await campo("Descrição").fill(dados.descricao);
    await campo("Disciplina").fill(`  ${dados.disciplina}  `);
    await campo("Criado em").fill(dados.criadoEm);
    gravacoes.length = 0;
    await salvarEdicao().click();
    await ate("retorno ao detalhe do projeto", async () => caminho() === "/projetos/1");
    await page.getByRole("heading", { name: dados.nome, exact: true }).waitFor();
    assert.deepEqual(gravacoes, [{ metodo: "PATCH", caminho: "/projetos/1", dados }]);
    const db = await lerBanco();
    assert.deepEqual(db.projetos.find((p) => p.id === "1"), { id: "1", ...dados });
    assert.equal(db.tarefas.filter((t) => t.projetoId === "1").length, 4);
    await page.reload();
    await page.getByRole("heading", { name: dados.nome, exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 4);
  });

  await conferir("cancelar e fechar na edição retornam ao detalhe sem gravar", async () => {
    const antes = await lerBanco();
    gravacoes.length = 0;
    for (const acao of ["Cancelar", "Fechar editar projeto"]) {
      await abrirEdicao("1");
      await campo("Nome").fill("Alteração cancelada");
      await page.getByRole("button", { name: acao, exact: true }).click();
      await ate(`detalhe após ${acao}`, async () => caminho() === "/projetos/1");
    }
    assert.equal(gravacoes.length, 0);
    assert.deepEqual(await lerBanco(), antes);
  });

  await conferir("ID inexistente encerra carregamento e não abre formulário", async () => {
    await page.goto(`${origem}/projetos/999/editar`);
    await page.getByRole("alert").filter({ hasText: "Projeto não encontrado." }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.getByRole("status").count(), 0);
  });

  await conferir("falha de leitura informa erro e encerra carregamento", async () => {
    await page.route(`${api}/projetos/1`, (route) => route.abort("connectionrefused"));
    await page.goto(`${origem}/projetos/1/editar`);
    await page.getByRole("alert").filter({ hasText: "Não foi possível carregar o projeto" }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.getByRole("status").count(), 0);
    await page.unrouteAll();
  });

  await conferir("trocar ID reinicia campos e ignora leitura atrasada", async () => {
    await abrirEdicao("1");
    await campo("Nome").fill("Rascunho do projeto anterior");
    await trocarRota("/projetos/2/editar");
    await esperarEdicao("2");
    assert.equal(await campo("Nome").inputValue(), seed.projetos[1].nome);
    let iniciou = false;
    await page.route(`${api}/projetos/1`, async (route) => {
      iniciou = true;
      await dormir(800);
      try { await route.fulfill({ json: seed.projetos[0] }); } catch {}
    });
    await trocarRota("/projetos/1/editar");
    await ate("leitura atrasada iniciada", async () => iniciou);
    assert.equal(await page.locator("form").count(), 0);
    await trocarRota("/projetos/2/editar");
    await esperarEdicao("2");
    await dormir(1000);
    assert.equal(await campo("Nome").inputValue(), seed.projetos[1].nome);
    await page.unrouteAll();
  });

  await conferir("erro na gravação preserva os dados, bloqueia duplicação e ignora resposta após saída", async () => {
    await abrirEdicao("2");
    await campo("Nome").fill("Projeto preservado após falha");
    await page.route(`${api}/projetos/2`, (route) =>
      route.request().method() === "PATCH" ? route.fulfill({ status: 500, json: {} }) : route.continue(),
    );
    await salvarEdicao().click();
    await page.getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto" }).waitFor();
    assert.equal(caminho(), "/projetos/2/editar");
    assert.equal(await campo("Nome").inputValue(), "Projeto preservado após falha");
    await ate("envio liberado após erro", () => salvarEdicao().isEnabled());
    await page.unrouteAll();
    await page.route(`${api}/projetos/2`, async (route) => {
      if (route.request().method() === "PATCH") await dormir(800);
      try { await route.continue(); } catch {}
    });
    gravacoes.length = 0;
    await salvarEdicao().click();
    await ate("botão bloqueado", () => page.locator('form button[type="submit"]').isDisabled());
    await page.evaluate(() => document.querySelector("form").requestSubmit());
    assert.equal(caminho(), "/projetos/2/editar");
    await ate("detalhe após nova tentativa", async () => caminho() === "/projetos/2");
    assert.equal(gravacoes.length, 1);
    await page.getByRole("heading", { name: "Projeto preservado após falha", exact: true }).waitFor();
    await page.unrouteAll();

    await abrirEdicao("1");
    const projeto1 = (await lerBanco()).projetos.find((p) => p.id === "1");
    await page.route(`${api}/projetos/1`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await dormir(800);
      try { await route.fulfill({ json: projeto1 }); } catch {}
    });
    await salvarEdicao().click();
    await ate("envio em curso", () => page.locator('form button[type="submit"]').isDisabled());
    // A ficha bloqueia o fundo (inert): a saída durante o envio é feita pelo histórico real.
    await trocarRota("/");
    await page.getByRole("heading", { name: "Tarefas", exact: true }).waitFor();
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    assert.equal(await page.locator("form").count(), 0, "o formulário foi desmontado antes da resposta tardia");
    await dormir(1000);
    assert.equal(caminho(), "/");
    await page.unrouteAll();
  });

  await conferir("formulário em 320px, foco visível, envio por teclado e bancos preservados", async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await abrirEdicao("1");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Na ficha a ordem é Nome, Disciplina, Criado em e Descrição; o Tab segue essa ordem.
    await campo("Nome").focus();
    assert.equal(await focoVisivel(campo("Nome")), true);
    await page.keyboard.press("Tab");
    assert.equal(await campo("Disciplina").evaluate((el) => el === document.activeElement), true);
    assert.equal(await focoVisivel(campo("Disciplina")), true);
    await campo("Descrição").focus();
    assert.equal(await campo("Descrição").evaluate((el) => el === document.activeElement), true);
    assert.equal(await focoVisivel(campo("Descrição")), true);
    if (process.env.PROJETOS_EVIDENCIAS) {
      await mkdir(process.env.PROJETOS_EVIDENCIAS, { recursive: true });
      await page.screenshot({ path: join(process.env.PROJETOS_EVIDENCIAS, "editar-projeto-320.png"), fullPage: true });
    }
    await campo("Nome").focus();
    await page.keyboard.press("Enter");
    await ate("envio pelo teclado", async () => caminho() === "/projetos/1");
    assert.deepEqual(errosPagina, []);
    assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
    assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  });

  console.log(`${total} cenários aprovados; bancos originais preservados.`);
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  for (const processo of processos) await encerrar(processo);
  if (temporario) await rm(temporario, { recursive: true, force: true });
});
