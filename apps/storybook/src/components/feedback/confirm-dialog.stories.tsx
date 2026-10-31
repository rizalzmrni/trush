import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDialog } from "@trush/design-system/components/feedback/confirm-dialog";
import { Button } from "@trush/design-system/components/ui/button";
import { fn } from "storybook/test";

const meta = {
  args: {
    confirmLabel: "Hapus proyek",
    description:
      "Proyek beserta seluruh datanya dihapus permanen dan tidak bisa dipulihkan.",
    onConfirm: fn(),
    title: "Hapus proyek ini?",
    trigger: <Button variant="outline">Hapus proyek</Button>,
  },
  component: ConfirmDialog,
  title: "Feedback/ConfirmDialog",
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Destructive: Story = {};

export const Open: Story = { args: { open: true } };

export const Pending: Story = { args: { open: true, pending: true } };

export const NonDestructive: Story = {
  args: {
    confirmLabel: "Terbitkan",
    description: "Artikel akan terlihat oleh semua pengunjung.",
    destructive: false,
    title: "Terbitkan artikel?",
    trigger: <Button>Terbitkan</Button>,
  },
};
