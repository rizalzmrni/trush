/**
 * Subset `node:async_hooks` yang dipakai trush (konteks log per request).
 * workerd menyediakan modulnya (Node compat aktif sejak compatibility_date
 * 2026-08-04), tetapi tipe dari `wrangler types` tidak memuat modul `node:*`
 * dan `@types/node` dilarang di tsconfig Worker. Deklarasi ini sengaja hanya
 * memuat anggota yang dipakai agar global Node lain tidak lolos type-check.
 */
declare module "node:async_hooks" {
  export class AsyncLocalStorage<T> {
    getStore(): T | undefined;
    run<R>(store: T, fn: () => R): R;
  }
}
