// Impor aset `?url` di-resolve oleh Vite milik app pemakai (dan Vitest).
// Paket ini tidak memuat `vite/client`, jadi bentuknya dideklarasikan di sini.
declare module "*.css?url" {
  const href: string;
  export default href;
}
