import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorState } from "./error-state";

describe("komponen ErrorState", () => {
  afterEach(cleanup);

  it("diumumkan sebagai alert dengan judul default", () => {
    render(<ErrorState />);

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("Gagal memuat data");
  });

  it("judul dan deskripsi bisa diganti", () => {
    render(
      <ErrorState description="Periksa koneksi." title="Proyek gagal dimuat" />
    );

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("Proyek gagal dimuat");
    expect(alert.textContent).toContain("Periksa koneksi.");
    expect(alert.textContent).not.toContain("Gagal memuat data");
  });

  it("tanpa onRetry tidak ada tombol coba lagi", () => {
    render(<ErrorState />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("tombol coba lagi memanggil onRetry", () => {
    const onRetry = vi.fn<() => void>();
    render(<ErrorState onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("tombol coba lagi bisa difokus keyboard dan labelnya bisa diganti", () => {
    render(
      <ErrorState onRetry={vi.fn<() => void>()} retryLabel="Muat ulang" />
    );
    const button = screen.getByRole("button", { name: "Muat ulang" });
    button.focus();

    expect(document.activeElement).toBe(button);
  });

  it("saat retrying tombol nonaktif dan aria-busy", () => {
    const onRetry = vi.fn<() => void>();
    render(<ErrorState onRetry={onRetry} retrying />);
    const button = screen.getByRole("button", { name: "Coba lagi" });

    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBeTruthy();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("ikon tidak ikut dibacakan", () => {
    render(<ErrorState onRetry={vi.fn<() => void>()} />);

    for (const icon of screen.getByRole("alert").querySelectorAll("svg")) {
      expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });
});

describe("navigasi keyboard ErrorState", () => {
  afterEach(cleanup);

  it("Tab mencapai tombol coba lagi, Enter dan Space memanggil onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    render(<ErrorState onRetry={onRetry} />);

    await user.tab();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Coba lagi" })
    );

    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("saat retrying tombol dilewati Tab", async () => {
    const user = userEvent.setup();
    render(<ErrorState onRetry={vi.fn<() => void>()} retrying />);

    await user.tab();

    expect(document.activeElement).toBe(document.body);
  });
});
