import {
  IconAlertCircle,
  IconCircleCheck,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { EmptyState } from "@trush/design-system/components/feedback/empty-state";

interface PhoneStatusProps {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

/** Nomor tersimpan di akun beserta status verifikasinya (data dari loader). */
export const PhoneStatus = ({
  phoneNumber,
  phoneNumberVerified,
}: PhoneStatusProps) => {
  if (!phoneNumber) {
    return (
      <EmptyState
        description="Tambahkan nomor untuk menerima kode keamanan lewat WhatsApp atau SMS."
        icon={<IconDeviceMobile />}
        title="Belum ada nomor telepon"
      />
    );
  }
  return (
    <dl className="border-border bg-card text-card-foreground flex flex-col gap-1 rounded-lg border p-4">
      <dt className="text-muted-foreground text-sm">Nomor saat ini</dt>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-base break-all">{phoneNumber}</span>
        {phoneNumberVerified ? (
          <span className="text-foreground inline-flex items-center gap-1 text-sm">
            <IconCircleCheck
              aria-hidden="true"
              className="text-primary size-4"
            />
            Terverifikasi
          </span>
        ) : (
          <span className="text-foreground inline-flex items-center gap-1 text-sm">
            <IconAlertCircle aria-hidden="true" className="size-4" />
            Belum terverifikasi
          </span>
        )}
      </dd>
    </dl>
  );
};
