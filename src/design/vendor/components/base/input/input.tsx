"use client";

import {
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  createContext,
  useContext,
  useState,
} from "react";
import { Eye, EyeOff, HelpCircle, InfoCircle } from "@untitledui/icons";
import type {
  InputProps as AriaInputProps,
  TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import {
  Button as AriaButton,
  Group as AriaGroup,
  Input as AriaInput,
  TextField as AriaTextField,
} from "react-aria-components";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx, sortCx } from "@/utils/cx";

export interface InputBaseProps extends Omit<AriaInputProps, "size"> {
  tooltip?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
  iconClassName?: string;
  inputClassName?: string;
  wrapperClassName?: string;
  tooltipClassName?: string;
  shortcut?: string | boolean;
  ref?: Ref<HTMLInputElement>;
  groupRef?: Ref<HTMLDivElement>;
  icon?: ComponentType<HTMLAttributes<HTMLOrSVGElement>>;
}

export const InputBase = ({
  ref,
  tooltip,
  shortcut,
  groupRef,
  size = "md",
  isInvalid,
  isDisabled,
  isRequired,
  icon: Icon,
  placeholder,
  wrapperClassName,
  tooltipClassName,
  inputClassName,
  iconClassName,
  type = "text",
  ...inputProps
}: InputBaseProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasTrailingIcon = tooltip || isInvalid;
  const hasLeadingIcon = Icon;

  const context = useContext(TextFieldContext);

  const inputSize = context?.size || size;

  const sizes = sortCx({
    sm: {
      root: cx(
        "px-3 py-2 text-sm",
        hasLeadingIcon && "pl-9",
        hasTrailingIcon && "pr-9",
      ),
      iconLeading: "left-3 size-4 stroke-[2.25px]",
      iconTrailing: "right-3",
      shortcut: "pr-1.5",
    },
    md: {
      root: cx(
        "px-3 py-2 text-md",
        hasLeadingIcon && "pl-10",
        hasTrailingIcon && "pr-9",
      ),
      iconLeading: "left-3 size-5",
      iconTrailing: "right-3",
      shortcut: "pr-2",
    },
    lg: {
      root: cx(
        "px-3.5 py-2.5 text-md",
        hasLeadingIcon && "pl-10.5",
        hasTrailingIcon && "pr-9.5",
      ),
      iconLeading: "left-3.5 size-5",
      iconTrailing: "right-3.5",
      shortcut: "pr-2.5",
    },
  });

  return (
    <AriaGroup
      {...{ isDisabled, isInvalid }}
      ref={groupRef}
      className={({ isFocusWithin, isDisabled, isInvalid }) =>
        cx(
          "group/input relative flex w-full flex-row place-content-center place-items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary transition-shadow duration-100 ease-linear ring-inset",

          isFocusWithin && !isDisabled && "ring-2 ring-brand",

          isDisabled && "cursor-not-allowed opacity-50",
          "group-disabled:cursor-not-allowed group-disabled:opacity-50",

          isInvalid && "ring-error_subtle",
          "group-invalid:ring-error_subtle",

          isInvalid && isFocusWithin && "ring-2 ring-error",
          isFocusWithin && "group-invalid:ring-2 group-invalid:ring-error",

          context?.wrapperClassName,
          wrapperClassName,
        )
      }
    >
      {Icon && (
        <Icon
          className={cx(
            "pointer-events-none absolute text-fg-quaternary",
            sizes[inputSize].iconLeading,
            context?.iconClassName,
            iconClassName,
          )}
        />
      )}

      <AriaInput
        {...(inputProps as AriaInputProps)}
        ref={ref}
        required={isRequired}
        type={type === "password" && isPasswordVisible ? "text" : type}
        placeholder={placeholder}
        className={cx(
          "m-0 w-full bg-transparent text-primary ring-0 outline-hidden placeholder:text-placeholder autofill:rounded-lg autofill:text-primary disabled:cursor-not-allowed",
          sizes[inputSize].root,
          context?.inputClassName,
          inputClassName,
        )}
      />

      {tooltip && type !== "password" && (
        <Tooltip title={tooltip} placement="top">
          <TooltipTrigger
            className={cx(
              "absolute cursor-pointer text-fg-quaternary transition duration-100 ease-linear group-invalid/input:hidden hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover",
              sizes[inputSize].iconTrailing,
              context?.tooltipClassName,
              tooltipClassName,
            )}
          >
            <HelpCircle className="size-4 stroke-[2.25px]" />
          </TooltipTrigger>
        </Tooltip>
      )}

      {type !== "password" && (
        <InfoCircle
          className={cx(
            "pointer-events-none absolute hidden size-4 stroke-[2.25px] text-fg-error-secondary group-invalid/input:block",
            sizes[inputSize].iconTrailing,
            context?.tooltipClassName,
            tooltipClassName,
          )}
        />
      )}

      {type === "password" && (
        <AriaButton
          aria-label="Toggle password visibility"
          onClick={() => setIsPasswordVisible(!isPasswordVisible)}
          className={cx(
            "absolute flex cursor-pointer items-center justify-center text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover focus:outline-hidden",
            sizes[inputSize].iconTrailing,
          )}
        >
          {isPasswordVisible ? (
            <EyeOff className="size-4 stroke-[2.25px]" />
          ) : (
            <Eye className="size-4 stroke-[2.25px]" />
          )}
        </AriaButton>
      )}

      {shortcut && (
        <div
          className={cx(
            "pointer-events-none absolute inset-y-0.5 right-0.5 z-10 hidden items-center rounded-r-[inherit] bg-linear-to-r from-transparent to-bg-primary to-40% pl-8 md:flex",
            sizes[inputSize].shortcut,
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none rounded px-1 py-px text-xs font-medium text-quaternary ring-1 ring-secondary select-none ring-inset"
          >
            {typeof shortcut === "string" ? shortcut : "⌘K"}
          </span>
        </div>
      )}
    </AriaGroup>
  );
};

InputBase.displayName = "InputBase";

type TextFieldContextProps = Partial<
  Pick<
    InputBaseProps,
    | "size"
    | "wrapperClassName"
    | "inputClassName"
    | "iconClassName"
    | "tooltipClassName"
  >
>;

const TextFieldContext = createContext<TextFieldContextProps>({});

export interface TextFieldProps
  extends AriaTextFieldProps, TextFieldContextProps {}

export const TextField = ({
  className,
  size = "md",
  inputClassName,
  wrapperClassName,
  iconClassName,
  tooltipClassName,
  ...props
}: TextFieldProps) => {
  return (
    <TextFieldContext.Provider
      value={{
        inputClassName,
        wrapperClassName,
        iconClassName,
        tooltipClassName,
        size,
      }}
    >
      <AriaTextField
        {...props}
        data-input-wrapper
        data-input-size={size}
        className={(state) =>
          cx(
            "group flex h-max w-full flex-col items-start justify-start gap-1.5",
            typeof className === "function" ? className(state) : className,
          )
        }
      />
    </TextFieldContext.Provider>
  );
};

TextField.displayName = "TextField";

export interface InputProps
  extends
    AriaTextFieldProps,
    Pick<
      InputBaseProps,
      | "ref"
      | "placeholder"
      | "icon"
      | "shortcut"
      | "tooltip"
      | "groupRef"
      | "size"
      | "wrapperClassName"
      | "inputClassName"
      | "iconClassName"
      | "tooltipClassName"
    > {
  label?: string;
  hint?: ReactNode;
  hideRequiredIndicator?: boolean;
}

export const Input = ({
  size = "md",
  placeholder,
  icon: Icon,
  label,
  hint,
  shortcut,
  hideRequiredIndicator,
  className,
  ref,
  groupRef,
  tooltip,
  iconClassName,
  inputClassName,
  wrapperClassName,
  tooltipClassName,
  type = "text",
  ...props
}: InputProps) => {
  return (
    <TextField
      aria-label={!label ? placeholder : undefined}
      {...props}
      size={size}
      className={className}
    >
      {({ isRequired, isInvalid }) => (
        <>
          {label && (
            <Label
              isRequired={
                hideRequiredIndicator ? !hideRequiredIndicator : isRequired
              }
              isInvalid={isInvalid}
            >
              {label}
            </Label>
          )}

          <InputBase
            {...{
              ref,
              groupRef,
              size,
              placeholder,
              icon: Icon,
              shortcut,
              iconClassName,
              inputClassName,
              wrapperClassName,
              tooltipClassName,
              tooltip,
              type,
            }}
          />

          {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
        </>
      )}
    </TextField>
  );
};

Input.displayName = "Input";
