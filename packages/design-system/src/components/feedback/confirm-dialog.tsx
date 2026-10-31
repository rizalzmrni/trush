import { IconAlertTriangle } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@trush/design-system/components/ui/alert-dialog";
import type { ReactElement, ReactNode } from "react";

interface ConfirmDialogProps {
  /** Teks aksi spesifik, mis. "Hapus proyek". */
  confirmLabel: string;
  /** Akibat aksi; wajib untuk aksi merusak atau tak bisa dibatalkan. */
  description: ReactNode;
  onConfirm: () => void;
  title: ReactNode;
  cancelLabel?: string;
  /** Default `true`: aksi merusak memakai varian `destructive`. */
  destructive?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  /** Aksi sedang berjalan: tombol dinonaktifkan agar tidak terkirim dua kali. */
  pending?: boolean;
  /** Elemen pemicu (mis. `<Button />`); kosongkan bila `open` dikendalikan. */
  trigger?: ReactElement;
}

export const ConfirmDialog = ({
  cancelLabel = "Batal",
  confirmLabel,
  description,
  destructive = true,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
  trigger,
}: ConfirmDialogProps) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    {trigger ? <AlertDialogTrigger render={trigger} /> : null}
    <AlertDialogContent>
      <AlertDialogHeader>
        {destructive ? (
          <AlertDialogMedia className="bg-destructive text-destructive-foreground">
            <IconAlertTriangle aria-hidden="true" />
          </AlertDialogMedia>
        ) : null}
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          aria-busy={pending}
          // Varian `destructive` CLI memakai teks merah di atas latar redup,
          // kontrasnya di bawah AA pada mode gelap; pakai pasangan token penuh.
          className={
            destructive
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : undefined
          }
          disabled={pending}
          onClick={onConfirm}
          variant={destructive ? "destructive" : "default"}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
