import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconLock } from "@tabler/icons-react";
import {
  ErrorPage,
  NotFoundPage,
  ServerErrorPage,
} from "@trush/design-system/components/feedback/error-page";
import { buttonVariants } from "@trush/design-system/components/ui/button";

// Di app, aksi berupa `<Link>` router; di story cukup `<a>` biasa.
const homeAction = (
  <a className={buttonVariants({ size: "lg" })} href="#beranda">
    Kembali ke beranda
  </a>
);

const meta = {
  args: {
    action: homeAction,
    description: "Kamu tidak punya akses ke halaman ini.",
    eyebrow: "Error 403",
    icon: <IconLock />,
    title: "Akses ditolak",
  },
  component: ErrorPage,
  parameters: { layout: "fullscreen" },
  title: "Feedback/ErrorPage",
} satisfies Meta<typeof ErrorPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Custom: Story = {};

export const NotFound: Story = {
  render: () => <NotFoundPage action={homeAction} />,
};

export const ServerError: Story = {
  render: () => <ServerErrorPage action={homeAction} />,
};

export const WithoutAction: Story = { args: { action: undefined } };
