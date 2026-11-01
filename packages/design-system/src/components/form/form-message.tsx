import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { cn } from "@trush/design-system/lib/utils";
import type { ReactNode } from "react";

interface FormMessageProps {
  children: ReactNode;
  className?: string;
  /** `error`: gagal submit (destructive); `success`: berhasil (primary). */
  variant?: "error" | "success";
}

const VARIANTS = {
  error: {
    className: "bg-destructive text-destructive-foreground",
    icon: IconAlertCircle,
    role: "alert",
  },
  success: {
    className: "bg-primary text-primary-foreground",
    icon: IconCircleCheck,
    role: "status",
  },
} as const;

/** Pesan tingkat form (bukan per field), mis. "Email atau kata sandi salah". */
export const FormMessage = ({
  children,
  className,
  variant = "error",
}: FormMessageProps) => {
  const { className: variantClassName, icon: Icon, role } = VARIANTS[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        variantClassName,
        className
      )}
      role={role}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
};
