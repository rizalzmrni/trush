import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";

describe("komponen EmptyState", () => {
  afterEach(cleanup);

  it("menampilkan judul dan deskripsi", () => {
    render(
      <EmptyState
        description="Proyek yang kamu buat akan muncul di sini."
        title="Belum ada proyek"
      />
    );

    expect(screen.getByText("Belum ada proyek")).toBeTruthy();
    expect(
      screen.getByText("Proyek yang kamu buat akan muncul di sini.")
    ).toBeTruthy();
  });

  it("bukan alert: kosong bukan kondisi error", () => {
    render(<EmptyState title="Belum ada proyek" />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("aksi bisa dijangkau sebagai tombol", () => {
    render(
      <EmptyState
        action={<button type="button">Buat proyek</button>}
        title="Belum ada proyek"
      />
    );
    const action = screen.getByRole("button", { name: "Buat proyek" });
    action.focus();

    expect(document.activeElement).toBe(action);
  });

  it("tanpa aksi tidak ada tombol", () => {
    render(<EmptyState title="Belum ada proyek" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ikon disembunyikan dari pembaca layar", () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Belum ada proyek"
      />
    );

    expect(
      screen.getByTestId("empty-icon").closest("[aria-hidden='true']")
    ).not.toBeNull();
  });
});

describe("navigasi keyboard EmptyState", () => {
  afterEach(cleanup);

  it("Tab mencapai aksi dan Enter menjalankannya", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<() => void>();
    render(
      <EmptyState
        action={
          <button onClick={onCreate} type="button">
            Buat proyek
          </button>
        }
        title="Belum ada proyek"
      />
    );

    await user.tab();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Buat proyek" })
    );

    await user.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledOnce();
  });
});
