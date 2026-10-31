import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LoadingSkeleton } from "./loading-skeleton";

describe("komponen LoadingSkeleton", () => {
  afterEach(cleanup);

  it("mengumumkan label default lewat role status", () => {
    render(<LoadingSkeleton />);

    expect(screen.getByRole("status").textContent).toBe("Memuat…");
  });

  it("label bisa diganti", () => {
    render(<LoadingSkeleton label="Memuat proyek…" />);

    expect(screen.getByRole("status").textContent).toBe("Memuat proyek…");
  });

  it("wadah ditandai aria-busy", () => {
    render(<LoadingSkeleton />);

    expect(
      screen.getByRole("status").closest("[aria-busy='true']")
    ).not.toBeNull();
  });

  it.each(["text", "list", "card", "table"] as const)(
    "varian %s: placeholder disembunyikan dari pembaca layar",
    (variant) => {
      const { container } = render(<LoadingSkeleton variant={variant} />);
      const placeholder = container.querySelector("[aria-hidden='true']");

      expect(placeholder).not.toBeNull();
      expect(placeholder?.children.length).toBeGreaterThan(0);
      expect(screen.getAllByRole("status")).toHaveLength(1);
    }
  );

  it("varian list merender sebanyak rows", () => {
    render(<LoadingSkeleton rows={5} variant="list" />);

    expect(screen.getAllByRole("listitem", { hidden: true })).toHaveLength(5);
  });

  it("rows nol atau negatif tidak merender placeholder tanpa error", () => {
    render(<LoadingSkeleton rows={-2} variant="list" />);

    expect(screen.queryAllByRole("listitem", { hidden: true })).toHaveLength(0);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("tidak ada elemen yang bisa difokus", () => {
    const { container } = render(<LoadingSkeleton variant="table" />);

    expect(
      container.querySelectorAll("a, button, input, [tabindex]")
    ).toHaveLength(0);
  });
});
