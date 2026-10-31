import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorState } from "@trush/design-system/components/feedback/error-state";
import { fn } from "storybook/test";

const meta = {
  args: {
    description: "Periksa koneksi internet lalu coba lagi.",
  },
  component: ErrorState,
  title: "Feedback/ErrorState",
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithRetry: Story = { args: { onRetry: fn() } };

export const Retrying: Story = { args: { onRetry: fn(), retrying: true } };

export const WithoutRetry: Story = {
  args: {
    description: "Kamu tidak punya akses ke data ini.",
    title: "Akses ditolak",
  },
};
