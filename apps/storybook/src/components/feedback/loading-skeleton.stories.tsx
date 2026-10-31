import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingSkeleton } from "@trush/design-system/components/feedback/loading-skeleton";

const meta = {
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["text", "list", "card", "table"],
    },
  },
  args: { rows: 3 },
  component: LoadingSkeleton,
  title: "Feedback/LoadingSkeleton",
} satisfies Meta<typeof LoadingSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { variant: "text" } };

export const List: Story = { args: { variant: "list" } };

export const Card: Story = { args: { variant: "card" } };

export const Table: Story = { args: { rows: 5, variant: "table" } };
