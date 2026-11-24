"use client";

import type { FC, ReactNode, Ref, RefAttributes } from "react";
import { isValidElement } from "react";
import { ChevronDown } from "@untitledui/icons";
import type { SelectProps as AriaSelectProps } from "react-aria-components";
import {
  Button as AriaButton,
  ListBox as AriaListBox,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
} from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { Popover } from "./popover";
import { SelectItem } from "./select-item";
import {
  type CommonProps,
  SelectContext,
  type SelectItemType,
  sizes,
} from "./select-shared";

export {
  SelectContext,
  sizes,
  type CommonProps,
  type SelectItemType,
} from "./select-shared";

export interface SelectProps
  extends
    Omit<AriaSelectProps<SelectItemType>, "children" | "items">,
    RefAttributes<HTMLDivElement>,
    CommonProps {
  items?: SelectItemType[];
  popoverClassName?: string;
  triggerTooltip?: string;
  icon?: FC | ReactNode;
  children: ReactNode | ((item: SelectItemType) => ReactNode);
}

interface SelectValueProps {
  isOpen: boolean;
  size: "sm" | "md" | "lg";
  isFocused: boolean;
  isDisabled: boolean;
  placeholder?: string;
  ref?: Ref<HTMLButtonElement>;
  icon?: FC | ReactNode;
}

const SelectValue = ({
  isOpen,
  isFocused,
  isDisabled,
  size,
  placeholder,
  icon,
  ref,
}: SelectValueProps) => {
  return (
    <AriaButton
      ref={ref}
      className={cx(
        "relative flex w-full cursor-pointer items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset",
        (isFocused || isOpen) && "ring-2 ring-brand",
        isDisabled && "cursor-not-allowed opacity-50",
      )}
    >
      <AriaSelectValue<SelectItemType>
        className={(state) =>
          cx(
            "flex h-max w-full items-center justify-start truncate text-left align-middle",

            sizes[size].root,

            (state.selectedItems[0]?.icon || icon) && sizes[size].withIcon,

            "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",
          )
        }
      >
        {(state) => {
          const selectedItem = state.selectedItems[0];
          const Icon = selectedItem?.icon || icon;

          return (
            <>
              {selectedItem?.avatarUrl ? (
                <Avatar
                  size="xs"
                  src={selectedItem.avatarUrl}
                  alt={selectedItem.label}
                  className={cx(size === "sm" && "size-5")}
                />
              ) : isReactComponent(Icon) ? (
                <Icon data-icon aria-hidden="true" />
              ) : isValidElement(Icon) ? (
                Icon
              ) : null}

              {selectedItem ? (
                <section
                  className={cx(
                    "flex w-full truncate",
                    sizes[size].textContainer,
                  )}
                >
                  <p
                    className={cx(
                      "truncate font-medium text-primary",
                      sizes[size].text,
                    )}
                  >
                    {selectedItem?.label}
                  </p>
                  {selectedItem?.supportingText && (
                    <p className={cx("text-tertiary", sizes[size].text)}>
                      {selectedItem?.supportingText}
                    </p>
                  )}
                </section>
              ) : (
                <p className={cx("text-placeholder", sizes[size].text)}>
                  {placeholder}
                </p>
              )}

              <ChevronDown
                aria-hidden="true"
                className={cx(
                  "ml-auto shrink-0 text-fg-quaternary",
                  size === "lg" ? "size-5" : "size-4 stroke-[2.25px]",
                )}
              />
            </>
          );
        }}
      </AriaSelectValue>
    </AriaButton>
  );
};

function revealSelectedOption(popover: HTMLElement | null) {
  if (!popover) return;
  const frame = requestAnimationFrame(() => {
    const selected = popover.querySelector(
      '[role="option"][aria-selected="true"]',
    );
    if (!selected || popover.scrollHeight <= popover.clientHeight) return;
    const option = selected.getBoundingClientRect();
    const top = popover.getBoundingClientRect().top + popover.clientTop;
    const bottom = top + popover.clientHeight;
    if (option.top < top) popover.scrollTop += option.top - top;
    else if (option.bottom > bottom) popover.scrollTop += option.bottom - bottom;
  });
  return () => cancelAnimationFrame(frame);
}

const Select = ({
  placeholder = "Select",
  icon,
  size = "md",
  children,
  items,
  label,
  hint,
  tooltip,
  hideRequiredIndicator,
  triggerTooltip,
  className,
  ...rest
}: SelectProps) => {
  return (
    <SelectContext.Provider value={{ size }}>
      <AriaSelect
        {...rest}
        className={(state) =>
          cx(
            "flex flex-col gap-1.5",
            typeof className === "function" ? className(state) : className,
          )
        }
      >
        {(state) => {
          const trigger = (
            <SelectValue {...state} {...{ size, placeholder }} icon={icon} />
          );
          return (
            <>
              {label && (
                <Label
                  isRequired={hideRequiredIndicator ? false : state.isRequired}
                  tooltip={tooltip}
                >
                  {label}
                </Label>
              )}

              {triggerTooltip ? (
                <Tooltip
                  title={triggerTooltip}
                  isDisabled={state.isOpen || state.isDisabled}
                >
                  {trigger}
                </Tooltip>
              ) : (
                trigger
              )}

              <Popover
                ref={triggerTooltip ? revealSelectedOption : undefined}
                size={size}
                className={rest.popoverClassName}
                {...(triggerTooltip
                  ? {
                      placement: "bottom start",
                      containerPadding: 10,
                      offset: 6,
                      maxHeight: 208,
                    }
                  : {})}
              >
                {triggerTooltip && label && (
                  <div
                    aria-hidden="true"
                    data-select-heading
                    className="px-2.5 py-1 text-xs text-tertiary"
                  >
                    {label}
                  </div>
                )}
                <AriaListBox
                  items={items}
                  className={cx(triggerTooltip ? "w-full" : "size-full", "outline-hidden")}
                >
                  {children}
                </AriaListBox>
              </Popover>

              {hint && (
                <HintText
                  isInvalid={state.isInvalid}
                  className={cx(size === "sm" && "text-xs")}
                >
                  {hint}
                </HintText>
              )}
            </>
          );
        }}
      </AriaSelect>
    </SelectContext.Provider>
  );
};

const _Select = Select as typeof Select & {
  Item: typeof SelectItem;
};
_Select.Item = SelectItem;

export { _Select as Select };
