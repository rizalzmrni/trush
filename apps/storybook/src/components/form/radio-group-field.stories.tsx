import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroupField } from "@trush/design-system/components/form/radio-group-field";

const meta = {
  args: {
    defaultValue: "whatsapp",
    label: "Kirim kode lewat",
    name: "channel",
    options: [
      {
        description: "Disarankan. Kode masuk ke chat WhatsApp nomor ini.",
        label: "WhatsApp",
        value: "whatsapp",
      },
      { description: "Pesan teks biasa.", label: "SMS", value: "sms" },
    ],
  },
  component: RadioGroupField,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  title: "Form/RadioGroupField",
} satisfies Meta<typeof RadioGroupField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDescription: Story = {
  args: {
    defaultValue: undefined,
    label: "Ukuran",
    name: "size",
    options: [
      { label: "Kecil", value: "sm" },
      { label: "Sedang", value: "md" },
      { label: "Besar", value: "lg" },
    ],
  },
};

export const WithError: Story = {
  args: { defaultValue: undefined, error: "Pilih cara pengiriman kode." },
};

export const Disabled: Story = { args: { disabled: true } };
