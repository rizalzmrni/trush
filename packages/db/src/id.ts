import { v7 } from "uuid";

/**
 * ID baru berformat UUIDv7 (terurut waktu). Satu-satunya sumber ID trush;
 * jangan pakai `crypto.randomUUID()` (UUIDv4).
 */
export const newId = (): string => v7();
