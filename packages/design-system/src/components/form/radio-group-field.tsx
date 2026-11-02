import { IconAlertCircle } from "@tabler/icons-react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@trush/design-system/components/ui/field";
import {
  RadioGroup,
  RadioGroupItem,
} from "@trush/design-system/components/ui/radio-group";
import type { ReactNode } from "react";
import { useId } from "react";

export interface RadioOption {
  /** Teks bantuan di bawah label opsi; tidak ikut nama aksesibel. */
  readonly description?: ReactNode;
  readonly label: ReactNode;
  readonly value: string;
}

interface RadioGroupFieldProps {
  defaultValue?: string;
  disabled?: boolean;
  /** Pesan error validasi; mengisi `aria-invalid` dan dibacakan. */
  error?: ReactNode;
  label: ReactNode;
  /** Nama field form; nilai terpilih ikut terkirim saat submit. */
  name: string;
  options: readonly RadioOption[];
  required?: boolean;
}

/**
 * Pilihan 2–5 opsi yang perlu terlihat semua (DESIGN.md), sebagai kartu
 * pilihan: legend = label grup, judul opsi = nama aksesibel tiap radio,
 * deskripsi opsi terhubung lewat `aria-describedby`.
 */
export const RadioGroupField = ({
  defaultValue,
  disabled,
  error,
  label,
  name,
  options,
  required,
}: RadioGroupFieldProps) => {
  const id = useId();
  const legendId = `${id}-legend`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <FieldSet data-invalid={hasError || undefined}>
      <FieldLegend id={legendId} variant="label">
        {label}
      </FieldLegend>
      <RadioGroup
        aria-describedby={hasError ? errorId : undefined}
        aria-labelledby={legendId}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        required={required}
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const titleId = `${optionId}-title`;
          const descriptionId = `${optionId}-description`;
          return (
            <FieldLabel htmlFor={optionId} key={option.value}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle id={titleId}>{option.label}</FieldTitle>
                  {option.description ? (
                    <FieldDescription id={descriptionId}>
                      {option.description}
                    </FieldDescription>
                  ) : null}
                </FieldContent>
                <RadioGroupItem
                  aria-describedby={
                    option.description ? descriptionId : undefined
                  }
                  aria-invalid={hasError || undefined}
                  aria-labelledby={titleId}
                  id={optionId}
                  value={option.value}
                />
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
      {hasError ? (
        // Sama dengan TextField: teks error gelap memakai pasangan foreground.
        <FieldError
          className="dark:text-destructive-foreground flex items-start gap-1.5"
          id={errorId}
        >
          <IconAlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>{error}</span>
        </FieldError>
      ) : null}
    </FieldSet>
  );
};
