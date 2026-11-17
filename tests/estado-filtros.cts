const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { comTextos, criarUi, criarEsperas } = require("./ui.cts");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

async function executar() {
  const originais = await Promise.all(
    ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
      readFile(arquivo, "utf8"),
    ),
  );
  let browser;
  try {
    const dados = JSON.parse(await readFile("db.seed.json", "utf8"));
    const { banco } = await apoio.criarBanco({ prefixo: "pixel-filtros-" });
    const { api, web } = await apoio.subirAmbiente({ banco, tentativas: 300 });

    browser = await apoio.abrirNavegador();
    const page = await browser.newPage();
    const errosJs = [];
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    await page.goto(web);
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const seletor = (nome) =>
      page.getByRole("button", { name: new RegExp(nome) });
    const selecionar = async (nome, opcao) => {
      await seletor(nome).click();
      const item = page.getByRole("option", { name: opcao, exact: true });
      await item.click();
      await item.waitFor({ state: "detached" });
    };
    const titulos = () => lista.locator(".e-task-title").allInnerTexts();
    await lista.getByRole("article").first().waitFor();

    const limpar = page.getByRole("button", {
      name: "Limpar busca, status e prioridade",
      exact: true,
    });
    const rodape = page.locator(".e-sheet-footer");
    const conferirLimpeza = async () => {
      await limpar.focus();
      await page.keyboard.press("Enter");
      assert.equal(await limpar.count(), 0);
      assert.equal(await busca.inputValue(), "");
      assert.match(await seletor("Status").innerText(), /Todos/);
      assert.match(await seletor("Prioridade").innerText(), /Todas/);
      assert.equal(
        await busca.evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(await rodape.innerText(), `${dados.tarefas.length} tarefas`);
      await page.waitForFunction(
        (total) =>
          document.querySelector("main p.sr-only[aria-live=polite]")
            ?.textContent === `${total} tarefas encontradas.`,
        dados.tarefas.length,
      );
      assert.equal(await page.locator("main p[aria-live=polite]").count(), 1);
    };
    assert.equal(await limpar.count(), 0);
    assert.equal(await rodape.innerText(), `${dados.tarefas.length} tarefas`);
    for (const visao of ["Lista", "Quadro"]) {
      await page
        .getByRole("navigation", { name: "Visualização das tarefas" })
        .getByRole("link", { name: visao, exact: true })
        .click();
      await page.getByRole("article").first().waitFor();
      await busca.fill("JSON");
      assert.equal(await limpar.count(), 1);
      assert.equal(
        await rodape.innerText(),
        `1 de ${dados.tarefas.length} tarefas`,
      );
      await conferirLimpeza();
      await selecionar("Status", "Concluída");
      assert.equal(await limpar.count(), 1);
      assert.equal(
        await rodape.innerText(),
        `${dados.tarefas.filter((t) => t.status === "concluida").length} de ${dados.tarefas.length} tarefas`,
      );
      await conferirLimpeza();
      await selecionar("Prioridade", "Alta");
      assert.equal(await limpar.count(), 1);
      await conferirLimpeza();
      await busca.fill("sem correspondência");
      await selecionar("Status", "A fazer");
      await selecionar("Prioridade", "Baixa");
      assert.equal(
        await rodape.innerText(),
        `0 de ${dados.tarefas.length} tarefas`,
      );
      await conferirLimpeza();
      await busca.fill(" ");
      assert.equal(await limpar.count(), 1);
      await conferirLimpeza();
    }
    await page
      .getByRole("navigation", { name: "Visualização das tarefas" })
      .getByRole("link", { name: "Lista", exact: true })
      .click();
    await lista.getByRole("article").first().waitFor();
    console.log(
      "OK: Limpar aparece para cada filtro, restaura os três valores, foco e anúncio; rodapé indica exibidas e total na lista e no quadro",
    );

    await busca.fill("a");
    await selecionar("Status", "A fazer");
    const esperado = dados.tarefas
      .filter(
        (t) =>
          t.titulo.toLocaleLowerCase("pt-BR").includes("a") &&
          t.status === "a-fazer",
      )
      .map((t) => t.titulo);
    assert.deepEqual(await titulos(), esperado);
    console.log("OK: lista exibe o conjunto derivado de busca e status");

    const menu = page.getByRole("navigation", { name: "Navegação principal" });
    await menu.getByRole("link", { name: "Projetos" }).click();
    await page.getByRole("heading", { name: "Projetos" }).waitFor();
    assert.equal(await lista.count(), 0);
    await menu.getByRole("link", { name: "Tarefas" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await busca.inputValue(), "a");
    assert.match(await seletor("Status").innerText(), /A fazer/);
    assert.deepEqual(await titulos(), esperado);
    console.log("OK: busca e status continuam aplicados após trocar de rota");

    await page
      .getByRole("navigation", { name: "Projetos" })
      .getByRole("link", { name: "Gerenciador de Tarefas" })
      .click();
    await page
      .getByRole("region", { name: "Tarefas do projeto" })
      .getByRole("article")
      .first()
      .waitFor();
    await page
      .getByRole("navigation", { name: "Projetos" })
      .getByRole("link", { name: "Todas" })
      .click();
    await lista.getByRole("article").first().waitFor();
    await selecionar("Prioridade", "Baixa");
    assert.deepEqual(
      await titulos(),
      dados.tarefas
        .filter(
          (t) =>
            t.titulo.toLocaleLowerCase("pt-BR").includes("a") &&
            t.status === "a-fazer" &&
            t.prioridade === "baixa",
        )
        .map((t) => t.titulo),
    );
    console.log("OK: filtros combinam entre si depois de visitar um projeto");

    const primeiro = (await titulos())[0];
    await lista.getByRole("link", { name: primeiro }).click();
    const ficha = page.getByRole("dialog", { name: "Detalhes da tarefa" });
    await ficha.waitFor();
    await ficha.getByRole("button", { name: /^Fechar/ }).click();
    await ficha.waitFor({ state: "detached" });
    assert.equal(await busca.inputValue(), "a");
    assert.deepEqual(await titulos(), [primeiro]);
    console.log("OK: abrir e fechar a ficha mantém busca e filtros");

    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );
    assert.equal(await busca.inputValue(), "");
    assert.match(await seletor("Status").innerText(), /Todos/);
    assert.match(await seletor("Prioridade").innerText(), /Todas/);
    console.log(
      "OK: limpar volta busca, status e prioridade aos valores iniciais",
    );

    await busca.fill("json");
    await page.reload();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await busca.inputValue(), "");
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );
    console.log("OK: recarregar a página reinicia os filtros");

    const ui = criarUi(page);
    const aviso = page.locator(".e-hidden-notice");
    const { assentar } = criarEsperas(page);
    const criar = async (titulo) => {
      await page
        .getByRole("button", { name: "Nova tarefa", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll(
            'form select[name="projetoId"] option:not([value=""])',
          ).length >= 2,
      );
      await ui.preencherTarefa(
        comTextos(
          {
            projetoId: "1",
            titulo,
            descricao: "Criada pela suíte de filtros",
            status: "a-fazer",
            prioridade: "media",
            responsavel: "Ana",
            prazo: "2027-03-15",
          },
          dados.projetos,
        ),
      );
      await page
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
    };
    await selecionar("Status", "Concluída");
    await criar("Tarefa escondida pelo status");
    await aviso.waitFor();
    assert.equal(
      await page
        .locator('[aria-live="polite"]')
        .filter({
          hasText: "Tarefa criada, mas escondida pela busca ou pelos filtros.",
        })
        .count(),
      1,
    );
    assert.equal(
      await lista
        .getByRole("link", { name: "Tarefa escondida pelo status" })
        .count(),
      0,
    );
    await aviso.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await lista
      .getByRole("link", { name: "Tarefa escondida pelo status" })
      .waitFor();
    assert.equal(await aviso.count(), 0);
    assert.match(await seletor("Status").innerText(), /Todos/);
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest(".e-task-search") !== null,
      ),
      true,
    );
    console.log(
      "OK: tarefa criada e escondida pelo filtro mostra aviso, e limpar a revela",
    );

    await criar("Tarefa visível sem filtros");
    await lista
      .getByRole("link", { name: "Tarefa visível sem filtros" })
      .waitFor();
    await assentar();
    assert.equal(await aviso.count(), 0);
    await busca.fill("sem correspondência");
    await criar("Tarefa escondida pela busca");
    await aviso.waitFor();
    assert.equal(await page.getByText("Nenhuma tarefa encontrada").count(), 1);
    assert.equal(
      await page
        .getByRole("button", { name: "Limpar busca e filtros" })
        .count(),
      1,
    );
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await lista
      .getByRole("link", { name: "Tarefa escondida pela busca" })
      .waitFor();
    assert.equal(await aviso.count(), 0);
    console.log(
      "OK: sem aviso quando a tarefa aparece; com a lista vazia, uma só ação de limpar no conteúdo",
    );

    const visoes = page.getByRole("navigation", {
      name: "Visualização das tarefas",
    });
    await visoes.getByRole("link", { name: "Quadro" }).click();
    const quadro = page.getByRole("region", {
      name: "Quadro de tarefas por status",
    });
    await quadro.getByRole("article").first().waitFor();
    await busca.fill("diagrama");
    await criar("Tarefa escondida no quadro");
    await aviso.waitFor();
    assert.equal(
      await quadro
        .getByRole("link", { name: "Tarefa escondida no quadro" })
        .count(),
      0,
    );
    await visoes.getByRole("link", { name: "Lista" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await aviso.count(), 0);
    assert.equal(await busca.inputValue(), "diagrama");
    console.log("OK: o aviso aparece no quadro e some ao navegar");

    await limpar.click();
    await selecionar("Status", "A fazer");
    const alvo = lista.getByRole("article").first();
    const tituloAlvo = await alvo.locator(".e-task-title").innerText();
    const totalAntes = await lista.getByRole("article").count();
    const status = page.getByRole("status").filter({ hasText: /^Status de / });
    await alvo.getByRole("button", { name: /^Mudar status de / }).click();
    await page
      .getByRole("menuitemradio", { name: "Em andamento", exact: true })
      .click();
    await aviso.waitFor();
    assert.equal(
      await aviso.locator("span").first().innerText(),
      `“${tituloAlvo}” agora está em Em andamento e saiu deste filtro.`,
    );
    assert.equal(await lista.getByRole("article").count(), totalAntes - 1);
    assert.equal(await status.count(), 0);
    assert.equal(
      await page
        .locator('[aria-live="polite"]')
        .filter({ hasText: "saiu deste filtro." })
        .count(),
      1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement !== document.body &&
          document.activeElement !== null,
      ),
      true,
    );
    await aviso.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await lista.getByRole("link", { name: tituloAlvo, exact: true }).waitFor();
    assert.equal(await aviso.count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest(".e-task-search") !== null,
      ),
      true,
    );
    await selecionar("Status", "A fazer");
    await lista
      .getByRole("article")
      .first()
      .getByRole("button", { name: /^Mudar status de / })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Em revisão", exact: true })
      .click();
    await aviso.waitFor();
    await selecionar("Status", "Todos");
    await aviso.waitFor({ state: "detached" });
    assert.equal(await status.count(), 0);
    await visoes.getByRole("link", { name: "Quadro" }).click();
    await quadro.getByRole("article").first().waitFor();
    await selecionar("Status", "A fazer");
    const noQuadro = quadro.getByRole("article").first();
    await noQuadro.getByRole("button", { name: /^Mudar status de / }).click();
    await page
      .getByRole("menuitemradio", { name: "Concluída", exact: true })
      .click();
    await aviso.waitFor();
    assert.match(
      await aviso.locator("span").first().innerText(),
      /agora está em Concluída e saiu deste filtro\.$/,
    );
    console.log(
      "OK: mudar o status para fora do filtro mostra o aviso, sem repetir o anúncio de status, e limpar revela a tarefa",
    );
    await visoes.getByRole("link", { name: "Lista" }).click();
    const fraseContagem = (n) =>
      `${n} ${n === 1 ? "tarefa encontrada" : "tarefas encontradas"}.`;
    const anuncioContagem = () =>
      page.locator("main p.sr-only[aria-live=polite]").innerText();
    const esperarContagemDaLista = () =>
      page.waitForFunction(() => {
        const n = document.querySelectorAll(
          '[aria-label="Lista de tarefas"] [data-task-id]',
        ).length;
        return (
          document.querySelector("main p.sr-only[aria-live=polite]")
            ?.textContent ===
          `${n} ${n === 1 ? "tarefa encontrada" : "tarefas encontradas"}.`
        );
      });
    if (await limpar.count()) await limpar.click();
    await lista.getByRole("article").first().waitFor();
    await selecionar("Status", "A fazer");
    await esperarContagemDaLista();
    const antesStatus = Number((await anuncioContagem()).match(/\d+/)[0]);
    const artigo = lista.getByRole("article").first();
    const idStatus = await artigo.getAttribute("data-task-id");
    const tituloStatus = await artigo.locator(".e-task-title").innerText();
    await artigo.getByRole("button", { name: /Mudar status de / }).click();
    await page
      .getByRole("menuitemradio", { name: "Concluída", exact: true })
      .click();
    await page
      .locator(`[data-task-id="${idStatus}"]`)
      .waitFor({ state: "detached" });
    const contagemNova = fraseContagem(antesStatus - 1);
    await page.waitForFunction(
      (texto) =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === texto,
      contagemNova,
    );
    assert.equal(await page.locator("main p[role=status]").count(), 0);
    await aviso.waitFor();
    assert.equal(
      await aviso.locator("span").first().innerText(),
      `“${tituloStatus}” agora está em Concluída e saiu deste filtro.`,
    );
    console.log(
      "OK: status fora do filtro atualiza a contagem anunciada, com o aviso visível e sem anúncio de status repetido",
    );

    await selecionar("Status", "Todos");
    await selecionar("Prioridade", "Média");
    await esperarContagemDaLista();
    const contagemPrioridade = await anuncioContagem();
    const permanece = lista.getByRole("article").first();
    const tituloPermanece = await permanece
      .locator(".e-task-title")
      .innerText();
    const statusAtual = (
      await permanece.locator("[data-status-trigger]").innerText()
    ).trim();
    const outroStatus =
      statusAtual === "Em revisão" ? "Em andamento" : "Em revisão";
    await permanece.getByRole("button", { name: /Mudar status de / }).click();
    await page
      .getByRole("menuitemradio", { name: outroStatus, exact: true })
      .click();
    await page.waitForFunction(
      ([titulo, status]) =>
        document.querySelector("main p[role=status]")?.textContent ===
        `Status de ${titulo} alterado para ${status}.`,
      [tituloPermanece, outroStatus],
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.equal(await anuncioContagem(), contagemPrioridade);
    assert.equal(await page.locator("main p[role=status]").count(), 1);
    console.log(
      "OK: status que mantém a tarefa no filtro não reanuncia a contagem",
    );

    await limpar.click();
    await page.waitForFunction((anterior) => {
      const n = document.querySelectorAll(
        '[aria-label="Lista de tarefas"] [data-task-id]',
      ).length;
      const frase = `${n} ${n === 1 ? "tarefa encontrada" : "tarefas encontradas"}.`;
      const rodape =
        document.querySelector(".e-sheet-footer")?.textContent ?? "";
      return (
        frase !== anterior &&
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === frase &&
        !rodape.includes(" de ")
      );
    }, contagemPrioridade);
    const contagemSemFiltro = await anuncioContagem();
    const tituloExcluir = await lista
      .locator(".e-task-title")
      .first()
      .innerText();
    await lista
      .getByRole("article")
      .first()
      .getByRole("button", { name: `Ações de ${tituloExcluir}` })
      .click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    await page
      .getByRole("dialog", { name: `Excluir ${tituloExcluir}` })
      .getByRole("button", { name: "Excluir tarefa" })
      .click();
    await page.waitForFunction(
      (titulo) =>
        [...document.querySelectorAll(".e-task-title")].every(
          (el) => el.textContent !== titulo,
        ),
      tituloExcluir,
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.equal(await anuncioContagem(), contagemSemFiltro);
    console.log(
      "OK: sem busca nem filtro ativo, excluir não anuncia outra contagem",
    );

    for (const tarefas of [[dados.tarefas[0]], []]) {
      await page.route(`${api}/tarefas`, (rota) =>
        rota.fulfill({ json: tarefas }),
      );
      await page.reload();
      await page.waitForFunction(
        () => document.querySelector(".e-sheet-footer") !== null,
      );
      assert.equal(
        await rodape.innerText(),
        tarefas.length === 1 ? "1 tarefa" : "0 tarefas",
      );
      await busca.fill("sem correspondência");
      assert.equal(
        await rodape.innerText(),
        tarefas.length === 1 ? "0 de 1 tarefa" : "0 de 0 tarefas",
      );
      await limpar.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await busca.evaluate((el) => el === document.activeElement),
        true,
      );
    }
    console.log(
      "OK: rodapé concorda com total singular e banco vazio; limpar mantém o foco na busca",
    );

    assert.deepEqual(errosJs, []);
    const atuais = await Promise.all(
      ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
        readFile(arquivo, "utf8"),
      ),
    );
    assert.deepEqual(atuais, originais);
    console.log("15 cenários aprovados; nenhum erro JavaScript não tratado.");
  } finally {
    await apoio.encerrar();
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
