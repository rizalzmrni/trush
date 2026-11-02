import { Suspense, createElement } from "react";
import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

/** Doctype yang sama dengan `render` React Email (XHTML 1.0 Transitional). */
const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

const LEADING_DOCTYPE = /^<!DOCTYPE[^>]*>/iu;

/**
 * Render template email ke HTML lengkap: setara `render` edge
 * `@react-email/render` (stream `allReady` + doctype XHTML), tanpa prettier
 * dan html-to-text yang diimpor statis oleh paket itu. Alasan (B18): kedua
 * pustaka itu tidak dipakai, tetapi ikut masuk bundel Worker dan menjadi
 * modul terbesar di RPC test workerd (batas 1 MiB per pesan).
 */
export const renderHtml = async (element: ReactElement): Promise<string> => {
  let failure: unknown;
  const stream = await renderToReadableStream(
    createElement(Suspense, null, element),
    {
      onError: (error: unknown) => {
        failure ??= error;
      },
      progressiveChunkSize: Number.POSITIVE_INFINITY,
    }
  );
  await stream.allReady;
  const html = await new Response(stream).text();
  if (failure !== undefined) {
    throw failure instanceof Error
      ? failure
      : new Error("Render template email gagal.");
  }
  return `${DOCTYPE}${html.replace(LEADING_DOCTYPE, "")}`;
};

/** Catatan kaki teks polos, sama dengan `Layout`. */
const FOOTER = "Email ini dikirim otomatis oleh trush. Jangan balas email ini.";

/**
 * Versi teks polos email: paragraf dipisah baris kosong, garis pemisah, lalu
 * catatan kaki. Ditulis eksplisit per template (bukan konversi HTML), jadi
 * kode dan tautan selalu utuh.
 */
export const plainText = (paragraphs: readonly string[]): string =>
  [...paragraphs, "----", FOOTER].join("\n\n");
