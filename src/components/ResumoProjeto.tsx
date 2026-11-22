import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router";
import { EditIcon, Icon, PawIcon } from "../design/icon";
import { formatarData } from "../design/formatos";
import type { Projeto } from "../tipos";
import { useSprite } from "../temas/sprites";

function GatinhoEspiando() {
  const sprite = useSprite("olhando");
  return (
    <span className="e-resumo-espiao" aria-hidden="true">
      <span
        className="e-resumo-espiao-gato"
        style={{ "--e-gato": sprite } as CSSProperties}
      />
    </span>
  );
}

export function ResumoProjeto({
  projeto,
  concluido,
}: {
  projeto?: Projeto;
  concluido: boolean;
}) {
  const local = useLocation();
  const navegar = useNavigate();
  const descricao = projeto?.descricao.trim();

  return (
    <header
      className="e-resumo-projeto"
      id="project-details"
      data-carregando={!projeto || undefined}
    >
      <div className="e-resumo-resumo">
        <h1 tabIndex={-1} className="e-resumo-titulo" data-visivel-ao-focar>
          {projeto?.nome ?? "Carregando projeto"}
        </h1>
        {projeto ? (
          <div className="e-resumo-dados">
            <p className="e-resumo-rotulo">
              <Icon name="book" />
              <span>{projeto.disciplina.trim()}</span>
              {concluido && (
                <span
                  className="e-resumo-concluido"
                  title="Todas as tarefas concluídas"
                >
                  <PawIcon />
                  <span className="sr-only">Todas as tarefas concluídas</span>
                </span>
              )}
            </p>
            <p className="e-resumo-data">
              <Icon name="calendar" />
              <span>
                Criado em{" "}
                <time dateTime={projeto.criadoEm}>
                  {formatarData(projeto.criadoEm, true)}
                </time>
              </span>
            </p>
            <button
              type="button"
              className="e-edit-project-details"
              onClick={() =>
                navegar(`/projetos/${encodeURIComponent(projeto.id)}/editar`, {
                  state: { fundo: local, detalhes: true },
                })
              }
            >
              <EditIcon />
              Editar projeto
            </button>
          </div>
        ) : (
          <span className="e-resumo-esqueleto-rotulo" aria-hidden="true" />
        )}
        {descricao && <p className="e-resumo-assunto">{descricao}</p>}
        {!projeto && (
          <>
            <span className="e-resumo-esqueleto" aria-hidden="true" />
            <span className="sr-only" role="status">
              Carregando projeto…
            </span>
          </>
        )}
      </div>
      {projeto && <GatinhoEspiando />}
    </header>
  );
}
