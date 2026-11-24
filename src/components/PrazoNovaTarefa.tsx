import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
} from "react-aria-components";
import { HintText } from "@/components/base/input/hint-text";
import { InputBase, TextField } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import {
  dataValida,
  formatarData,
  formatarPrazoCartao,
} from "../design/formatos";
import { Icon } from "../design/icon";
import "./PrazoNovaTarefa.css";

export function PrazoNovaTarefa({
  valor,
  erro,
  onChange,
  formulario,
  idErro,
  nome = "prazo",
  rotulo = "Prazo",
  alvo = "prazo",
  doAlvo = "do prazo",
}: {
  valor: string;
  erro?: string;
  onChange: (valor: string) => void;
  formulario?: string;
  idErro?: string;
  nome?: string;
  rotulo?: string;
  alvo?: string;
  doAlvo?: string;
}) {
  const data = dataValida(valor) ? parseDate(valor) : null;
  const [aberto, setAberto] = useState(false);

  function entrada(botao?: ReactNode, fechar?: () => void) {
    return (
      <TextField
        className="e-prazo-tarefa"
        name={nome}
        size="sm"
        type="date"
        isRequired
        validationBehavior="aria"
        value={valor}
        onChange={onChange}
        isInvalid={Boolean(erro)}
      >
        <Label isRequired isInvalid={Boolean(erro)}>
          {rotulo}
        </Label>
        <div className="e-prazo-tarefa__entrada">
          <InputBase
            type="date"
            size="sm"
            form={formulario}
            onKeyDown={
              fechar
                ? (evento) => {
                    if (evento.key !== "Enter") return;
                    evento.preventDefault();
                    const form = evento.currentTarget.form;
                    fechar();
                    form?.requestSubmit();
                  }
                : undefined
            }
          />
          {botao}
        </div>
        {!formulario && erro && (
          <HintText isInvalid>
            <span role="alert">{erro}</span>
          </HintText>
        )}
      </TextField>
    );
  }

  const dica = data ? `${rotulo}: ${formatarData(valor, true)}` : rotulo;
  const botao = (
    <Button
      className={formulario ? "e-tarefa-atalho" : "e-prazo-tarefa__botao"}
      type="button"
      data-prazo-atalho={formulario ? "" : undefined}
      data-preenchido={formulario && data ? "" : undefined}
      aria-label={formulario ? dica : `Abrir calendário ${doAlvo}`}
      data-invalido={formulario && erro ? "" : undefined}
      aria-describedby={formulario && erro ? idErro : undefined}
    >
      <Icon name="calendar" />
      {formulario && data && <span>{formatarPrazoCartao(valor)}</span>}
    </Button>
  );
  const seletor = (
    <DialogTrigger isOpen={aberto} onOpenChange={setAberto}>
      {formulario ? (
        <Tooltip title={dica} isDisabled={aberto}>
          {botao}
        </Tooltip>
      ) : botao}
      <Popover
        className="e-nova-tarefa-popover e-calendario-prazo"
        placement={formulario ? "bottom start" : "bottom end"}
        offset={6}
        containerPadding={10}
      >
        <Dialog
          className="e-calendario-prazo__dialogo"
          aria-label={`Selecionar ${alvo}`}
        >
          {({ close }) => {
            function selecionar(proximo: string) {
              onChange(proximo);
              close();
            }

            return (
              <>
                {formulario && entrada(undefined, close)}
                <Calendar
                  aria-label={`Calendário ${doAlvo}`}
                  value={data}
                  onChange={(dia) => selecionar(dia.toString())}
                  autoFocus
                >
                  <header className="e-calendario-prazo__cabecalho">
                    <Button
                      type="button"
                      slot="previous"
                      aria-label="Mês anterior"
                    >
                      <Icon name="angle-right" />
                    </Button>
                    <Heading />
                    <Button
                      type="button"
                      slot="next"
                      aria-label="Próximo mês"
                    >
                      <Icon name="angle-right" />
                    </Button>
                  </header>
                  <CalendarGrid
                    className="e-calendario-prazo__grade"
                    weekdayStyle="short"
                  >
                    <CalendarGridHeader>
                      {(dia) => (
                        <CalendarHeaderCell>{dia}</CalendarHeaderCell>
                      )}
                    </CalendarGridHeader>
                    <CalendarGridBody>
                      {(dia) => (
                        <CalendarCell
                          date={dia}
                          className="e-calendario-prazo__dia"
                        />
                      )}
                    </CalendarGridBody>
                  </CalendarGrid>
                </Calendar>
                <footer className="e-calendario-prazo__rodape">
                  <Button
                    type="button"
                    isDisabled={!valor}
                    onPress={() => selecionar("")}
                  >
                    Limpar
                  </Button>
                  <Button
                    type="button"
                    onPress={() =>
                      selecionar(today(getLocalTimeZone()).toString())
                    }
                  >
                    Hoje
                  </Button>
                </footer>
              </>
            );
          }}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
  return formulario ? seletor : entrada(seletor);
}
