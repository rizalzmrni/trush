import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

const baseProps = {
  confirmLabel: "Hapus proyek",
  description: "Proyek dan semua datanya dihapus permanen.",
  title: "Hapus proyek ini?",
} as const;

const renderWithTrigger = (
  props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}
) =>
  render(
    <ConfirmDialog
      {...baseProps}
      onConfirm={vi.fn<() => void>()}
      trigger={<button type="button">Hapus</button>}
      {...props}
    />
  );

const openDialog = async (): Promise<HTMLElement> => {
  fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
  return await screen.findByRole("alertdialog");
};

describe("komponen ConfirmDialog", () => {
  afterEach(cleanup);

  it("tertutup sampai pemicu diklik", async () => {
    renderWithTrigger();

    expect(screen.queryByRole("alertdialog")).toBeNull();

    const dialog = await openDialog();

    expect(dialog).toBeTruthy();
  });

  it("alertdialog diberi nama dari judul dan deskripsi dari akibat aksi", async () => {
    renderWithTrigger();
    const dialog = await openDialog();

    const labelledBy = dialog.getAttribute("aria-labelledby") ?? "";
    const describedBy = dialog.getAttribute("aria-describedby") ?? "";

    expect(document.querySelector(`#${labelledBy}`)?.textContent).toBe(
      baseProps.title
    );
    expect(document.querySelector(`#${describedBy}`)?.textContent).toBe(
      baseProps.description
    );
  });

  it("menampilkan tombol batal default dan tombol konfirmasi", async () => {
    renderWithTrigger();
    await openDialog();

    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hapus proyek" })).toBeTruthy();
  });

  it("label batal bisa diganti", async () => {
    renderWithTrigger({ cancelLabel: "Jangan" });
    await openDialog();

    expect(screen.getByRole("button", { name: "Jangan" })).toBeTruthy();
  });

  it("tombol konfirmasi memanggil onConfirm", async () => {
    const onConfirm = vi.fn<() => void>();
    renderWithTrigger({ onConfirm });
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Hapus proyek" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("batal menutup dialog tanpa memanggil onConfirm", async () => {
    const onConfirm = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    renderWithTrigger({ onConfirm, onOpenChange });
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Batal" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(onOpenChange.mock.lastCall?.[0]).toBeFalsy();
    expect(onOpenChange.mock.lastCall?.[0]).toBeTypeOf("boolean");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape menutup dialog", async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    renderWithTrigger({ onOpenChange });
    const dialog = await openDialog();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(onOpenChange.mock.lastCall?.[0]).toBeFalsy();
    expect(onOpenChange.mock.lastCall?.[0]).toBeTypeOf("boolean");
  });

  it("fokus pindah ke dalam dialog saat dibuka", async () => {
    renderWithTrigger();
    const dialog = await openDialog();

    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBeTruthy();
    });
  });

  it("saat pending kedua tombol nonaktif dan konfirmasi aria-busy", async () => {
    const onConfirm = vi.fn<() => void>();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} open pending />);
    await screen.findByRole("alertdialog");
    const confirm = screen.getByRole("button", { name: "Hapus proyek" });
    const cancel = screen.getByRole("button", { name: "Batal" });

    fireEvent.click(confirm);

    expect(confirm.hasAttribute("disabled")).toBeTruthy();
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    expect(
      cancel.hasAttribute("disabled") ||
        cancel.getAttribute("aria-disabled") === "true"
    ).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("terkendali: open tanpa trigger langsung tampil", async () => {
    render(
      <ConfirmDialog {...baseProps} onConfirm={vi.fn<() => void>()} open />
    );

    await expect(screen.findByRole("alertdialog")).resolves.toBeTruthy();
  });

  it("terkendali: open false tidak menampilkan dialog", () => {
    render(
      <ConfirmDialog
        {...baseProps}
        onConfirm={vi.fn<() => void>()}
        open={false}
      />
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("ikon peringatan destructive tidak dibacakan dan hilang bila non-destructive", async () => {
    const { unmount } = render(
      <ConfirmDialog {...baseProps} onConfirm={vi.fn<() => void>()} open />
    );
    const dialog = await screen.findByRole("alertdialog");
    const icons = dialog.querySelectorAll("svg");

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
    }
    unmount();

    render(
      <ConfirmDialog
        {...baseProps}
        destructive={false}
        onConfirm={vi.fn<() => void>()}
        open
      />
    );
    const plain = await screen.findByRole("alertdialog");

    expect(plain.querySelectorAll("svg")).toHaveLength(0);
  });
});

describe("navigasi keyboard ConfirmDialog", () => {
  afterEach(cleanup);

  const TAB_PRESSES = 6;

  it("Enter pada pemicu membuka dialog", async () => {
    const user = userEvent.setup();
    renderWithTrigger();

    await user.tab();
    await user.keyboard("{Enter}");

    await expect(screen.findByRole("alertdialog")).resolves.toBeTruthy();
  });

  it("Tab dan Shift+Tab tetap terkunci di dalam dialog", async () => {
    const user = userEvent.setup();
    renderWithTrigger();
    const dialog = await openDialog();
    const visited: (Element | null)[] = [];
    const press = async (shift: boolean): Promise<void> => {
      await user.tab({ shift });
      visited.push(document.activeElement);
    };

    // Ditekan berurutan; melewati dua tombol agar fokus harus berputar balik.
    await press(false);
    await press(false);
    await press(false);
    await press(true);
    await press(true);
    await press(true);

    expect(visited).toHaveLength(TAB_PRESSES);
    for (const element of visited) {
      expect(dialog.contains(element)).toBeTruthy();
    }
    expect(visited).toContain(screen.getByRole("button", { name: "Batal" }));
    expect(visited).toContain(
      screen.getByRole("button", { name: "Hapus proyek" })
    );
  });

  it("Enter pada tombol konfirmasi memanggil onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    renderWithTrigger({ onConfirm });
    await openDialog();

    screen.getByRole("button", { name: "Hapus proyek" }).focus();
    await user.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("Space pada Batal menutup dialog dan fokus kembali ke pemicu", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    renderWithTrigger({ onConfirm });
    const trigger = screen.getByRole("button", { name: "Hapus" });

    await user.click(trigger);
    await screen.findByRole("alertdialog");
    screen.getByRole("button", { name: "Batal" }).focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape lewat keyboard menutup dialog", async () => {
    const user = userEvent.setup();
    renderWithTrigger();
    await openDialog();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  it("saat pending Enter pada konfirmasi tidak memanggil onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} open pending />);
    await screen.findByRole("alertdialog");

    screen.getByRole("button", { name: "Hapus proyek" }).focus();
    await user.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
