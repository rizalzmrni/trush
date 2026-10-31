import { IconAlertCircle } from "@tabler/icons-react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@trush/design-system/components/ui/field";
import { Input } from "@trush/design-system/components/ui/input";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

type InputProps = Omit<
  ComponentProps<typeof Input>,
  "aria-describedby" | "aria-invalid" | "id" | "name"
>;

interface TextFieldProps extends InputProps {
  /** Teks bantuan di bawah kontrol. */
  description?: ReactNode;
  /** Pesan error validasi; mengisi `aria-invalid` dan dibacakan. */
  error?: ReactNode;
  label: ReactNode;
  name: string;
}

/**
 * Field teks presentasional: label, input, deskripsi, dan error yang terhubung
 * lewat `id`/`aria-describedby`. Atribut validasi browser (`required`,
 * `type="email"`, `minLength`) diteruskan ke input.
 */
export const TextField = ({
  description,
  error,
  label,
  name,
  ...inputProps
}: TextFieldProps) => {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  const describedBy =
    [description ? descriptionId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Field data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        id={id}
        name={name}
      />
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {hasError ? (
        // Token `destructive` gelap terlalu redup sebagai warna teks di atas
        // `background`; di mode gelap teks memakai pasangan foreground-nya.
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
    </Field>
  );
};
