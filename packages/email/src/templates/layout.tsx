// Komponen per paket, bukan barrel `@react-email/components`: barrel itu ikut
// memuat render (prettier), tailwind, dan code-block (prism) ke bundel (B18).
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";
import type { ReactNode } from "react";

import { theme } from "../theme";

const { color, font, fontSize, lineHeight, radius, space } = theme;

export const styles = {
  body: {
    backgroundColor: color.background,
    color: color.foreground,
    fontFamily: font.body,
    margin: 0,
    padding: `${space.lg}px 0`,
  },
  button: {
    backgroundColor: color.primary,
    borderRadius: radius,
    color: color.primaryForeground,
    display: "inline-block",
    fontSize: fontSize.text,
    fontWeight: 600,
    padding: `${space.sm - 4}px ${space.md}px`,
    textDecoration: "none",
  },
  code: {
    backgroundColor: color.muted,
    borderRadius: radius,
    color: color.foreground,
    fontFamily: font.mono,
    fontSize: fontSize.code,
    fontWeight: 700,
    letterSpacing: 8,
    margin: `${space.md}px 0`,
    padding: `${space.sm}px 0`,
    textAlign: "center",
  },
  container: {
    backgroundColor: color.card,
    border: `1px solid ${color.border}`,
    borderRadius: radius,
    margin: "0 auto",
    maxWidth: theme.width,
    padding: space.lg,
  },
  footer: {
    color: color.mutedForeground,
    fontSize: fontSize.small,
    lineHeight: `${lineHeight.text - 4}px`,
    margin: 0,
  },
  heading: {
    color: color.foreground,
    fontSize: fontSize.heading,
    fontWeight: 700,
    lineHeight: `${lineHeight.heading}px`,
    margin: `0 0 ${space.sm}px`,
  },
  hr: {
    borderColor: color.border,
    margin: `${space.md}px 0`,
  },
  link: {
    color: color.foreground,
    textDecoration: "underline",
    wordBreak: "break-all",
  },
  text: {
    color: color.foreground,
    fontSize: fontSize.text,
    lineHeight: `${lineHeight.text}px`,
    margin: `0 0 ${space.sm}px`,
  },
  warning: {
    color: color.destructive,
    fontSize: fontSize.text,
    fontWeight: 600,
    lineHeight: `${lineHeight.text}px`,
    margin: `0 0 ${space.sm}px`,
  },
} as const;

export interface LayoutProps {
  /** Teks pratinjau di daftar kotak masuk. */
  preview: string;
  children: ReactNode;
}

/** Kerangka bersama semua email trush: kartu di tengah + catatan kaki. */
export const Layout = ({ children, preview }: LayoutProps) => (
  <Html lang="id">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Section>{children}</Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Email ini dikirim otomatis oleh trush. Jangan balas email ini.
        </Text>
      </Container>
    </Body>
  </Html>
);
