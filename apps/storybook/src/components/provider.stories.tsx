import type { Meta, StoryObj } from "@storybook/react-vite";
import { DesignSystemProvider } from "@trush/design-system/components/provider";
import { Button } from "@trush/design-system/components/ui/button";
import { toast } from "@trush/design-system/components/ui/toast";

// `DesignSystemProvider` sudah dipasang decorator global di preview.tsx,
// seperti root layout app; story ini hanya memicu toast-nya.
const ToastDemo = () => (
  <div className="flex flex-wrap gap-2">
    <Button
      onClick={() =>
        toast.add({
          description: "Perubahan profil sudah disimpan.",
          title: "Tersimpan",
          type: "success",
        })
      }
    >
      Toast sukses
    </Button>
    <Button
      onClick={() =>
        toast.add({
          description: "Koneksi terputus. Coba lagi sebentar lagi.",
          title: "Gagal menyimpan",
          type: "error",
        })
      }
      variant="outline"
    >
      Toast error
    </Button>
  </div>
);

const meta = {
  component: DesignSystemProvider,
  title: "Provider/DesignSystemProvider",
} satisfies Meta<typeof DesignSystemProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Toast: Story = {
  args: { children: null },
  render: () => <ToastDemo />,
};
