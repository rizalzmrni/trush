import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconFolderOpen, IconPlus } from "@tabler/icons-react";
import { EmptyState } from "@trush/design-system/components/feedback/empty-state";
import { Button } from "@trush/design-system/components/ui/button";

const meta = {
  args: {
    description: "Proyek yang kamu buat akan muncul di sini.",
    title: "Belum ada proyek",
  },
  component: EmptyState,
  title: "Feedback/EmptyState",
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    action: (
      <Button>
        <IconPlus aria-hidden="true" data-icon="inline-start" />
        Buat proyek
      </Button>
    ),
    icon: <IconFolderOpen />,
  },
};

export const TextOnly: Story = {};
