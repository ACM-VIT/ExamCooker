"use client";

import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const INPUT_BASE_CLASS =
  "w-full border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder-black/35 transition focus:border-black/45 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]/35 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/35 dark:focus:border-[#3BF4C7]/55 dark:focus:ring-[#3BF4C7]/25";

type FieldShellProps = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  label: string;
};

export function FieldShell({
  children,
  className,
  htmlFor,
  label,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-black/65 dark:text-[#D5D5D5]/60"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

type FieldRowProps = {
  children: ReactNode;
  className?: string;
};

export function FieldRow({ children, className }: FieldRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

type EditorTextInputProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  value: string;
  min?: number;
  max?: number;
  inputMode?: "text" | "numeric" | "decimal";
};

export function EditorTextInput({
  label,
  max,
  min,
  onChange,
  placeholder,
  type = "text",
  value,
  inputMode,
}: EditorTextInputProps) {
  const inputId = useId();

  return (
    <FieldShell label={label} htmlFor={inputId}>
      <input
        id={inputId}
        type={type}
        value={value}
        min={min}
        max={max}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_BASE_CLASS}
      />
    </FieldShell>
  );
}

type EditorSelectOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type EditorSelectProps<TValue extends string> = {
  label: string;
  onChange: (value: TValue | "") => void;
  options: ReadonlyArray<EditorSelectOption<TValue>>;
  placeholder?: string;
  value: TValue | "";
};

export function EditorSelect<TValue extends string>({
  label,
  onChange,
  options,
  placeholder,
  value,
}: EditorSelectProps<TValue>) {
  const selectId = useId();
  return (
    <FieldShell label={label} htmlFor={selectId}>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue | "")}
        className={INPUT_BASE_CLASS}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type EditorCheckboxProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function EditorCheckbox({
  checked,
  label,
  onChange,
}: EditorCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border border-black/15 bg-white px-3 py-2.5 text-sm font-medium text-black transition hover:border-black/30 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#3BF4C7]"
      />
      <span>{label}</span>
    </label>
  );
}

type EditorTextareaProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value" | "rows" | "placeholder"
>;

export const EditorTextarea = forwardRef<HTMLTextAreaElement, EditorTextareaProps>(
  function EditorTextarea(
    { label, onChange, placeholder, rows = 3, value, ...rest },
    ref,
  ) {
    const id = useId();
    return (
      <FieldShell label={label} htmlFor={id}>
        <textarea
          ref={ref}
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_BASE_CLASS}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export const EDITOR_INPUT_BASE_CLASS = INPUT_BASE_CLASS;
