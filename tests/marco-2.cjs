const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { criarEsperas } = require("./ui.cjs");

let origem = "";
let api = "";
const { criarApoio } = require("./apoio.cjs");
const apoio = criarApoio();
let browser;
let total = 0;

async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}

async function executar() {
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-marco2-" });
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  ({ api, web: origem } = await apoio.subirAmbiente({ banco }));
  browser = await apoio.abrirNavegador();
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  // Espera a tela renderizar e todos os indicadores
  // de carregamento (fundo e ficha) saírem.
  const abrir = async (rota) => {
    await page.goto(`${origem}${rota}`);
    await page.waitForFunction(
      () =>
        document.querySelector("main") &&
        !document.querySelector('[role="status"]'),
    );
  };
  const texto = async () => page.locator("main").innerText();
  const ficha = () => page.getByRole("dialog");
  const textoFicha = async () => ficha().innerText();
  const conferirTitulo = async (titulo) => {
    await page.waitForFunction(
      (esperado) => document.title === esperado,
      `${titulo} · Pixel`,
    );
    assert.equal(await page.title(), `${titulo} · Pixel`);
  };
  const { segurar } = criarEsperas(page);

  await conferir(
    "lista original mantém as cinco tarefas sem duplicações",
    async () => {
      await abrir("/");
      await conferirTitulo("Tarefas");
      assert.equal(await page.locator("article").count(), seed.tarefas.length);
      for (const tarefa of seed.tarefas)
        assert.equal(
          await page
            .getByRole("link", { name: tarefa.titulo, exact: true })
            .count(),
          1,
        );
    },
  );
  await conferir(
    "detalhe direto apresenta os campos e permite recarregar",
    async () => {
      await abrir("/tarefas/2");
      await page
        .getByRole("dialog", { name: "Detalhes da tarefa", exact: true })
        .waitFor();
      await conferirTitulo("Subir o json-server");
      const conteudo = await textoFicha();
      // A data agora é apresentada por extenso; o
      // valor ISO fica no atributo do elemento <time>.
      for (const valor of [
        "Subir o json-server",
        "API local a partir do db.json",
        "Em andamento",
        "Alta",
        "Bruno",
        "6 de outubro de 2026",
        "Gerenciador de Tarefas",
      ])
        assert.ok(conteudo.includes(valor), valor);
      assert.equal(
        await ficha().locator("time").getAttribute("datetime"),
        "2026-10-06",
      );
      assert.equal(await ficha().locator(".e-read-identifiers").count(), 0);
      await page.reload();
      await page
        .getByRole("heading", { name: "Subir o json-server", exact: true })
        .waitFor();
      await conferirTitulo("Subir o json-server");
    },
  );
  await conferir(
    "prazos mostram outro ano no cartão e vencimento na ficha, exceto concluídas",
    async () => {
      await page.clock.setFixedTime(new Date("2026-11-12T12:00:00"));
      const casos = [
        ["2020-01-05", "a-fazer", "Venceu 5 jan 2020", true],
        ["2026-11-11", "em-andamento", "Venceu 11 nov", true],
        ["2027-01-10", "em-revisao", "10 jan 2027", false],
        ["2026-11-12", "a-fazer", "12 nov", false],
        ["2020-01-05", "concluida", "5 jan 2020", false],
      ];
      const tarefas = casos.map(([prazo, status], i) => ({
        ...seed.tarefas[0],
        id: String(901 + i),
        prazo,
        status,
        responsavel: i % 2 ? "Ana" : "Maria de Oliveira Silva",
      }));
      await page.route(`${api}/tarefas**`, (route) => {
        const id = new URL(route.request().url()).pathname.split("/")[2];
        return route.fulfill({
          json: id ? tarefas.find((tarefa) => tarefa.id === id) : tarefas,
        });
      });
      for (const largura of [1280, 375, 320]) {
        await page.setViewportSize({ width: largura, height: 900 });
        for (const rota of ["/", "/quadro"]) {
          await abrir(rota);
          for (const [i, tarefa] of tarefas.entries()) {
            const prazo = page.locator(`[data-task-id="${tarefa.id}"] time`);
            assert.equal(await prazo.textContent(), casos[i][2]);
            assert.equal(await prazo.getAttribute("datetime"), tarefa.prazo);
            assert.equal(
              await prazo.evaluate((el) =>
                el.classList.contains("e-card-vencido"),
              ),
              casos[i][3],
            );
          }
          assert.ok(
            await page.locator("[data-task-id]").evaluateAll((cartoes) =>
              cartoes.every((el) => {
                const prazo = el.querySelector("time");
                return (
                  el.scrollWidth <= el.clientWidth + 1 &&
                  prazo.getBoundingClientRect().right <=
                    el.getBoundingClientRect().right
                );
              }),
            ),
            `${rota}: prazos cabem em ${largura}px`,
          );
        }
      }
      for (const [i, tarefa] of tarefas.entries()) {
        await abrir(`/tarefas/${tarefa.id}`);
        const prazo = ficha().locator("time");
        const extensa = new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${tarefa.prazo}T12:00:00`));
        assert.equal(
          await prazo.textContent(),
          `${casos[i][3] ? "Venceu em " : ""}${extensa}`,
        );
        assert.equal(await prazo.getAttribute("datetime"), tarefa.prazo);
        assert.equal(
          await prazo.evaluate((el) => el.classList.contains("e-card-vencido")),
          casos[i][3],
        );
        assert.ok(
          (await ficha().ariaSnapshot()).includes(
            `${casos[i][3] ? "Venceu em " : ""}${extensa}`,
          ),
        );
        if (casos[i][3])
          assert.equal(
            await prazo.evaluate((el) => getComputedStyle(el).color),
            await page
              .locator(`[data-task-id="${tarefa.id}"] time`)
              .evaluate((el) => getComputedStyle(el).color),
          );
      }
      await page.unrouteAll();
      await page.clock.setFixedTime(new Date());
      await page.setViewportSize({ width: 1280, height: 900 });
      await abrir("/tarefas/2");
    },
  );
  await conferir(
    "layout persiste e os links navegam sem recarregar o documento",
    async () => {
      await page.evaluate(() => {
        window.marcadorNavegacao = "preservado";
      });
      // A ficha bloqueia o fundo: fecha-se o detalhe
      // (navegação interna) antes de usar o menu principal.
      await page.keyboard.press("Escape");
      await ficha().waitFor({ state: "detached" });
      await conferirTitulo("Tarefas");
      assert.equal(
        await page.evaluate(() => window.marcadorNavegacao),
        "preservado",
      );
      const principal = page.getByRole("navigation", {
        name: "Navegação principal",
        exact: true,
      });
      await principal
        .getByRole("link", { name: "Projetos", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Projetos", exact: true })
        .waitFor();
      await page.getByRole("region", { name: "Lista de projetos" }).waitFor();
      await conferirTitulo("Projetos");
      assert.equal(
        await page.evaluate(() => window.marcadorNavegacao),
        "preservado",
      );
      assert.equal(await principal.count(), 1);
      assert.equal(
        await principal
          .getByRole("link", { name: "Projetos" })
          .getAttribute("aria-current"),
        "page",
      );
    },
  );
  await conferir(
    "lista apresenta os dois projetos com links corretos",
    async () => {
      assert.equal(await page.locator("article").count(), seed.projetos.length);
      for (const projeto of seed.projetos)
        assert.equal(
          await page
            .getByRole("link", { name: projeto.nome, exact: true })
            .getAttribute("href"),
          `/projetos/${projeto.id}`,
        );
    },
  );
  await conferir(
    "projetos consultam embed e exibem somente suas tarefas",
    async () => {
      for (const projeto of seed.projetos) {
        const resposta = page.waitForResponse(
          `${api}/projetos/${projeto.id}?_embed=tarefas`,
        );
        await abrir(`/projetos/${projeto.id}`);
        await conferirTitulo(projeto.nome);
        assert.equal((await resposta).status(), 200);
        const tarefas = seed.tarefas.filter(
          (tarefa) => tarefa.projetoId === projeto.id,
        );
        assert.equal(await page.locator("article").count(), tarefas.length);
        // Descrição, disciplina e data de criação ficam
        // em "Detalhes do projeto", recolhido por padrão.
        await page
          .getByRole("button", { name: "Detalhes do projeto", exact: true })
          .click();
        await page.locator("#project-details").waitFor();
        const conteudo = await texto();
        for (const tarefa of tarefas)
          assert.ok(conteudo.includes(tarefa.titulo));
        for (const tarefa of seed.tarefas.filter(
          (tarefa) => tarefa.projetoId !== projeto.id,
        ))
          assert.ok(!conteudo.includes(tarefa.titulo));
        assert.ok(conteudo.includes(projeto.descricao));
        assert.ok(conteudo.includes(projeto.disciplina));
        assert.equal(
          await page.locator("#project-details time").getAttribute("datetime"),
          projeto.criadoEm,
        );
      }
    },
  );
  await conferir(
    "troca de parâmetro não mantém dados da tarefa anterior",
    async () => {
      await abrir("/tarefas/1");
      await conferirTitulo("Criar o repositório");
      const leitura = await segurar(`${api}/tarefas/2`);
      await page.evaluate(() => {
        history.pushState({}, "", "/tarefas/2");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await ficha().getByRole("status").waitFor();
      await conferirTitulo("Tarefa");
      assert.ok(!(await textoFicha()).includes("Criar o repositório"));
      await leitura.liberar();
      await page
        .getByRole("heading", { name: "Subir o json-server", exact: true })
        .waitFor();
      await conferirTitulo("Subir o json-server");
      await page.unrouteAll();
    },
  );
  await conferir(
    "resposta atrasada não substitui o projeto atual",
    async () => {
      const leitura = await segurar(`${api}/projetos/1*`);
      await page.goto(`${origem}/projetos/1`);
      await page
        .getByRole("status")
        .filter({ hasText: /^Carregando projeto…$/ })
        .waitFor();
      await conferirTitulo("Projeto");
      await page.evaluate(() => {
        history.pushState({}, "", "/projetos/2");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page
        .getByRole("heading", { name: "Modelagem da Biblioteca", exact: true })
        .waitFor();
      await leitura.liberar();
      await conferirTitulo("Modelagem da Biblioteca");
      assert.equal(await page.locator("article").count(), 1);
      assert.ok(!(await texto()).includes("Criar o repositório"));
      await page.unrouteAll();
    },
  );
  await conferir(
    "IDs inexistentes encerram carregamento com mensagem",
    async () => {
      // Tarefa abre na ficha com a mensagem exata; o
      // projeto mostra título e explicação na própria tela.
      await abrir("/tarefas/999");
      await conferirTitulo("Tarefa não encontrada");
      assert.equal(
        await page.getByRole("alert").innerText(),
        "Tarefa não encontrada. Ela pode ter sido excluída.",
      );
      assert.equal(await page.getByRole("status").count(), 0);
      await abrir("/projetos/999");
      await conferirTitulo("Projeto não encontrado");
      const alerta = await page.getByRole("alert").innerText();
      assert.ok(alerta.includes("Projeto não encontrado"), alerta);
      assert.ok(
        alerta.includes("Este projeto não existe ou foi removido."),
        alerta,
      );
      assert.equal(await page.getByRole("status").count(), 0);
    },
  );
  await conferir(
    "listas vazias e projeto sem tarefas têm mensagens",
    async () => {
      await page.route(`${api}/projetos`, (route) =>
        route.fulfill({ json: [] }),
      );
      await abrir("/projetos");
      const vazio = await texto();
      assert.ok(
        vazio.includes("Nenhum projeto por aqui") &&
          vazio.includes("Crie um projeto para reunir suas tarefas."),
        vazio,
      );
      await page
        .getByRole("button", { name: "Criar projeto", exact: true })
        .waitFor();
      await page.unrouteAll();
      await page.route(`${api}/projetos/1?_embed=tarefas`, (route) =>
        route.fulfill({ json: { ...seed.projetos[0], tarefas: [] } }),
      );
      await abrir("/projetos/1");
      const semTarefas = await texto();
      assert.ok(
        semTarefas.includes("Este projeto ainda não tem tarefas"),
        semTarefas,
      );
      await page
        .getByRole("button", { name: "Criar tarefa", exact: true })
        .waitFor();
      assert.equal(await page.locator("article").count(), 0);
      await page.unrouteAll();
    },
  );
  const diaRelativo = (dias) => {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  };
  const tarefaComPrazo = (id, projetoId, status, prazo) => ({
    ...seed.tarefas[0],
    id,
    projetoId,
    status,
    prazo,
  });
  const rodapeProjeto = async (id) =>
    page
      .locator(`[data-project-id="${id}"] .e-proj-prazo`)
      .evaluate((elemento) => {
        const data = elemento.querySelector("b");
        const esperada = new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "short",
        }).format(
          new Date(
            `${elemento.ownerDocument.defaultView.prazoEsperado}T12:00:00`,
          ),
        );
        const erro = getComputedStyle(elemento.ownerDocument.documentElement)
          .getPropertyValue("--e-error")
          .trim();
        const amostra = elemento.ownerDocument.createElement("span");
        amostra.style.color = erro;
        elemento.append(amostra);
        const corErro = getComputedStyle(amostra).color;
        amostra.remove();
        return {
          texto: elemento.textContent,
          esperada,
          data: data.textContent,
          cor: getComputedStyle(elemento).color,
          corData: getComputedStyle(data).color,
          corErro,
        };
      });
  const prazoEsperado = (iso) =>
    page.evaluate((valor) => {
      window.prazoEsperado = valor;
    }, iso);
  await conferir(
    "cartão de projeto avisa quando o menor prazo pendente já venceu",
    async () => {
      const [anteontem, ontem, amanha] = [
        diaRelativo(-2),
        diaRelativo(-1),
        diaRelativo(1),
      ];
      await page.route(`${api}/tarefas`, (route) =>
        route.fulfill({
          json: [
            tarefaComPrazo("901", "1", "concluida", anteontem),
            tarefaComPrazo("902", "1", "a-fazer", amanha),
            tarefaComPrazo("903", "1", "em-andamento", ontem),
            tarefaComPrazo("904", "2", "concluida", ontem),
          ],
        }),
      );
      await abrir("/projetos");
      await prazoEsperado(ontem);
      const rodape = await rodapeProjeto("1");
      assert.equal(rodape.texto, `Prazo vencido ${rodape.esperada}`);
      assert.equal(rodape.data, rodape.esperada);
      assert.equal(rodape.cor, rodape.corErro);
      assert.equal(rodape.corData, rodape.corErro);
      assert.equal(
        await page.locator('[data-project-id="2"] .e-proj-prazo').count(),
        0,
      );
      assert.ok(!(await texto()).includes("Próximo prazo"));
      await page.unrouteAll();
    },
  );
  await conferir(
    "cartão de projeto mantém Próximo prazo para hoje e para datas futuras",
    async () => {
      const [ontem, hoje, amanha] = [
        diaRelativo(-1),
        diaRelativo(0),
        diaRelativo(1),
      ];
      await page.route(`${api}/tarefas`, (route) =>
        route.fulfill({
          json: [
            tarefaComPrazo("901", "1", "concluida", ontem),
            tarefaComPrazo("902", "1", "a-fazer", amanha),
            tarefaComPrazo("903", "2", "em-revisao", hoje),
            tarefaComPrazo("904", "2", "a-fazer", amanha),
          ],
        }),
      );
      await abrir("/projetos");
      for (const [id, prazo] of [
        ["1", amanha],
        ["2", hoje],
      ]) {
        await prazoEsperado(prazo);
        const rodape = await rodapeProjeto(id);
        assert.equal(
          rodape.texto,
          `Próximo prazo ${rodape.esperada}`,
          `projeto ${id}`,
        );
        assert.notEqual(rodape.cor, rodape.corErro, `projeto ${id}`);
        assert.notEqual(rodape.corData, rodape.corErro, `projeto ${id}`);
        assert.equal(
          await page
            .locator(`[data-project-id="${id}"] .e-proj-vencido`)
            .count(),
          0,
        );
      }
      assert.ok(!(await texto()).includes("Prazo vencido"));
      await page.unrouteAll();
    },
  );
  await conferir(
    "falha de rede apresenta erro nas três telas novas",
    async () => {
      await page.route(`${api}/**`, (route) =>
        route.abort("connectionrefused"),
      );
      for (const rota of ["/tarefas/2", "/projetos", "/projetos/1"]) {
        await abrir(rota);
        await conferirTitulo(
          rota === "/projetos"
            ? "Projetos"
            : rota.startsWith("/tarefas/")
              ? "Tarefa"
              : "Projeto",
        );
        const alvo = rota.startsWith("/tarefas/") ? ficha() : page;
        assert.equal(await alvo.getByRole("alert").count(), 1);
        assert.ok(
          (await alvo.getByRole("alert").innerText()).includes(
            "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.",
          ),
        );
        assert.equal(await page.getByRole("status").count(), 0);
      }
      await page.unrouteAll();
    },
  );
  await conferir("fallback mantém navegação e retorno à lista", async () => {
    await abrir("/rota-inexistente");
    await conferirTitulo("Página não encontrada");
    assert.ok((await texto()).includes("Página não encontrada"));
    await page.getByRole("link", { name: "Voltar para tarefas" }).click();
    await page
      .getByRole("link", { name: seed.tarefas[0].titulo, exact: true })
      .waitFor();
    await conferirTitulo("Tarefas");
  });
  await conferir(
    "formulários têm títulos próprios e restauram o destino ao fechar",
    async () => {
      for (const [rota, titulo, destino, aba = titulo] of [
        ["/tarefas/nova", "Nova tarefa", "Tarefas"],
        [
          "/tarefas/1/editar",
          "Editar tarefa",
          "Criar o repositório",
          "Editar: Criar o repositório",
        ],
        ["/projetos/novo", "Novo projeto", "Projetos"],
        [
          "/projetos/1/editar",
          "Editar projeto",
          "Gerenciador de Tarefas",
          "Editar: Gerenciador de Tarefas",
        ],
      ]) {
        await abrir(rota);
        await ficha().locator("form").waitFor();
        await conferirTitulo(aba);
        await ficha()
          .getByRole("button", {
            name: `Fechar ${titulo.toLocaleLowerCase("pt-BR")}`,
            exact: true,
          })
          .click();
        await conferirTitulo(destino);
      }
    },
  );
  await conferir(
    "edição mantém o título genérico enquanto carrega e nomeia o registro depois",
    async () => {
      let liberarTarefa;
      const tarefaBloqueada = new Promise((resolve) => {
        liberarTarefa = resolve;
      });
      await page.route(`${api}/tarefas/1`, async (route) => {
        await tarefaBloqueada;
        await route.continue();
      });
      try {
        await page.goto(`${origem}/tarefas/1/editar`);
        await conferirTitulo("Editar tarefa");
        liberarTarefa();
        await ficha().locator("form").waitFor();
        await conferirTitulo("Editar: Criar o repositório");
      } finally {
        liberarTarefa();
        await page.unrouteAll({ behavior: "wait" });
      }
      let liberarProjeto;
      const projetoBloqueado = new Promise((resolve) => {
        liberarProjeto = resolve;
      });
      await page.route(
        (url) => url.pathname === "/projetos/1" && url.search === "",
        async (route) => {
          await projetoBloqueado;
          await route.continue();
        },
      );
      try {
        await page.goto(`${origem}/projetos/1/editar`);
        await conferirTitulo("Editar projeto");
        liberarProjeto();
        await ficha().locator("form").waitFor();
        await conferirTitulo("Editar: Gerenciador de Tarefas");
      } finally {
        liberarProjeto();
        await page.unrouteAll({ behavior: "wait" });
      }
    },
  );
  await conferir(
    "ficha sobre projeto acompanha edição, fechamento e histórico",
    async () => {
      await abrir("/projetos/1");
      await page
        .getByRole("link", { name: "Criar o repositório", exact: true })
        .click();
      await conferirTitulo("Criar o repositório");
      await page.goBack();
      await conferirTitulo("Gerenciador de Tarefas");
      await page.goForward();
      await conferirTitulo("Criar o repositório");
      await ficha()
        .getByRole("button", { name: "Editar tarefa", exact: true })
        .click();
      await conferirTitulo("Editar: Criar o repositório");
      await page.keyboard.press("Escape");
      await conferirTitulo("Criar o repositório");
      await page.waitForFunction(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      );
      await page.keyboard.press("Escape");
      await ficha().waitFor({ state: "detached" });
      await conferirTitulo("Gerenciador de Tarefas");
    },
  );
  await conferir(
    "resposta do fundo não sobrescreve o título da ficha",
    async () => {
      let liberar;
      const bloqueio = new Promise((resolve) => {
        liberar = resolve;
      });
      await page.route(`${api}/projetos/1*`, async (route) => {
        await bloqueio;
        await route.continue();
      });
      try {
        await page.goto(`${origem}/tarefas/nova?projetoId=1`);
        await ficha().locator("form").waitFor();
        await conferirTitulo("Nova tarefa");
        liberar();
        await page
          .getByRole("main", { includeHidden: true })
          .getByRole("heading", {
            name: "Gerenciador de Tarefas",
            exact: true,
            includeHidden: true,
          })
          .waitFor();
        await conferirTitulo("Nova tarefa");
        await page.keyboard.press("Escape");
        await ficha().waitFor({ state: "detached" });
        await conferirTitulo("Gerenciador de Tarefas");
      } finally {
        liberar();
        await page.unrouteAll({ behavior: "wait" });
      }
    },
  );
  await conferir(
    "telas cabem em 375 px e links recebem foco por teclado",
    async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      for (const rota of ["/", "/tarefas/2", "/projetos", "/projetos/1"]) {
        await abrir(rota);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          rota,
        );
      }
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.tagName),
        "A",
      );
    },
  );
  assert.deepEqual(erros, []);
  console.log(
    `${total} cenários aprovados; nenhum erro JavaScript não tratado.`,
  );
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
