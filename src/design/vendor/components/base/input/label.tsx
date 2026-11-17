"use client";

import type { ReactNode, Ref } from "react";
import { HelpCircle } from "@untitledui/icons";
import type { LabelProps as AriaLabelProps } from "react-aria-components";
import { Label as AriaLabel } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

interface LabelProps extends AriaLabelProps {
  children: ReactNode;
  isInvalid?: boolean;
  isRequired?: boolean;
  tooltip?: string;
  tooltipDescription?: string;
  ref?: Ref<HTMLLabelElement>;
}

export const Label = ({
  isInvalid,
  isRequired,
  tooltip,
  tooltipDescription,
  className,
  ...props
}: LabelProps) => {
  return (
    <AriaLabel
      data-label="true"
      {...props}
      className={cx(
        "flex cursor-default items-center gap-0.5 text-sm font-medium text-secondary",
        className,
      )}
    >
      {props.children}

      <span
        className={cx(
          "hidden text-brand-tertiary",
          isRequired && "block",
          typeof isRequired === "undefined" && "group-required:block",

          isInvalid && "text-error-primary",
          typeof isInvalid === "undefined" &&
            "group-invalid:text-error-primary",
        )}
      >
        *
      </span>

      {tooltip && (
        <Tooltip
          title={tooltip}
          description={tooltipDescription}
          placement="top"
        >
          <TooltipTrigger
            isDisabled={false}
            className="cursor-pointer text-fg-quaternary transition duration-200 hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover"
          >
            <HelpCircle className="size-4" />
          </TooltipTrigger>
        </Tooltip>
      )}
    </AriaLabel>
  );
};

Label.displayName = "Label";
