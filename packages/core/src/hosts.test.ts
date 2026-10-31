import { describe, expect, it } from "vitest";

import { isOfficialHost } from "./hosts";

describe(isOfficialHost, () => {
  it.each([
    "localhost",
    "localhost:8787",
    "127.0.0.1",
    "127.0.0.1:5173",
    "127.0.0.2",
    "127.10.0.1:80",
    "127.255.255.255",
    "[::1]",
    "[::1]:8787",
    "trush-api.example.workers.dev",
    "trush-api-production.akun.workers.dev:443",
  ])("%s bukan domain resmi", (host) => {
    expect(isOfficialHost(host)).toBeFalsy();
  });

  it.each([
    "example.com",
    "app.example.com",
    "api.example.com:443",
    // Mirip tapi bukan host lokal / workers.dev.
    "localhost.example.com",
    "mylocalhost.com",
    "workers.dev.example.com",
    "evilworkers.dev",
    "127.0.0.1.example.com",
    "128.0.0.1",
    "1127.0.0.1",
  ])("%s domain resmi", (host) => {
    expect(isOfficialHost(host)).toBeTruthy();
  });
});
