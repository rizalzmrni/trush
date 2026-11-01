import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextField } from "@trush/design-system/components/form/text-field";

const meta = {
  args: {
    autoComplete: "email",
    label: "Email",
    name: "email",
    placeholder: "nama@contoh.com",
    required: true,
    type: "email",
  },
  component: TextField,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  title: "Form/TextField",
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    autoComplete: "new-password",
    description: "Minimal 8 karakter.",
    label: "Kata sandi",
    name: "password",
    placeholder: undefined,
    type: "password",
  },
};

export const WithError: Story = {
  args: { defaultValue: "budi@", error: "Masukkan alamat email yang valid." },
};

export const Disabled: Story = { args: { disabled: true } };
