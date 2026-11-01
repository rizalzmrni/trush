import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormMessage } from "@trush/design-system/components/form/form-message";

const meta = {
  args: { children: "Email atau kata sandi salah." },
  component: FormMessage,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  title: "Form/FormMessage",
} satisfies Meta<typeof FormMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ErrorMessage: Story = {};

export const SuccessMessage: Story = {
  args: { children: "Perubahan tersimpan.", variant: "success" },
};
