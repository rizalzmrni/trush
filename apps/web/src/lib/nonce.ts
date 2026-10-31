import { createContext, useContext } from "react";

/**
 * Nonce CSP per request. Diisi `entry.server.tsx` saat SSR; di browser kosong
 * (browser menyembunyikan atribut `nonce` dan skrip sudah dimuat).
 */
export const NonceContext = createContext<string | undefined>(undefined);

export const useNonce = (): string | undefined => useContext(NonceContext);
