import { describe, expect, it } from "vitest";

import {
  appRequest,
  createTestContext,
  unusedApi,
} from "../../testing/cloudflare";
import { loader, meta } from "./reset-password";

const runLoader = (path: string) => {
  const request = appRequest(path);
  const args: Parameters<typeof loader>[0] = {
    context: createTestContext({ api: unusedApi() }),
    params: {},
    pattern: "/reset-password",
    request,
    url: new URL(request.url),
  };
  return loader(args);
};

describe("route /reset-password", () => {
  it("?token= → token untuk form (dipangkas)", () => {
    expect(runLoader("/reset-password?token=%20tok-palsu%20")).toStrictEqual({
      token: "tok-palsu",
    });
  });

  it.each([
    "/reset-password",
    "/reset-password?token=",
    "/reset-password?token=%20%20",
    "/reset-password?error=INVALID_TOKEN",
    "/reset-password?token=tok-palsu&error=INVALID_TOKEN",
  ])("%s → token null (tampilan tautan tidak berlaku)", (path) => {
    expect(runLoader(path)).toStrictEqual({ token: null });
  });

  it("halaman bertoken tidak diindeks", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toContainEqual({
      content: "noindex",
      name: "robots",
    });
  });
});
