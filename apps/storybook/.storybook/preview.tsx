import "@trush/design-system/styles/globals.css";
import type { Decorator, Preview } from "@storybook/react-vite";
import { DesignSystemProvider } from "@trush/design-system/components/provider";
import { fontLinks, fontVariables } from "@trush/design-system/lib/font";
import { useTheme } from "next-themes";
import { useEffect } from "react";

// Pengganti `links` + `<body className={fontVariables}>` di root layout app.
for (const { href, rel } of fontLinks) {
  const link = document.createElement("link");
  link.href = href;
  link.rel = rel;
  document.head.append(link);
}
document.body.classList.add(...fontVariables.split(" "));

type Theme = "dark" | "light" | "system";

// Tema diatur lewat next-themes (sama seperti app), bukan menulis class
// `.dark` langsung, agar tidak berebut dengan ThemeProvider.
const ThemeSync = ({ theme }: { theme: Theme }) => {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);
  return null;
};

const toTheme = (value: unknown): Theme =>
  value === "dark" || value === "system" ? value : "light";

const withDesignSystem: Decorator = (Story, { globals }) => (
  <DesignSystemProvider>
    <ThemeSync theme={toTheme(globals.theme)} />
    <Story />
  </DesignSystemProvider>
);

const preview: Preview = {
  decorators: [withDesignSystem],
  globalTypes: {
    theme: {
      description: "Tema terang/gelap (class .dark lewat next-themes)",
      toolbar: {
        dynamicTitle: true,
        icon: "mirror",
        items: [
          { icon: "sun", title: "Terang", value: "light" },
          { icon: "moon", title: "Gelap", value: "dark" },
          { icon: "browser", title: "Sistem", value: "system" },
        ],
        title: "Tema",
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "padded",
  },
};

export default preview;
