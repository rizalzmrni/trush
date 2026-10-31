import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-a11y"],
  // Tanpa pengiriman data ke pihak ketiga (CLAUDE.md, layanan pihak ketiga).
  core: { disableTelemetry: true },
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  // TypeScript 7 native tidak punya JS API; react-docgen tidak membutuhkannya.
  typescript: { reactDocgen: "react-docgen" },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
  }),
};

export default config;
