import { useEffect, useRef, useState } from "react";

import { TURNSTILE_FIELD } from "../form-schema";

/** Mode `explicit`: widget dirender oleh komponen ini, bukan pindaian DOM. */
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
  "error-callback"?: () => void;
  language?: string;
  "response-field-name"?: string;
  sitekey: string;
  theme?: "auto" | "dark" | "light";
}

interface TurnstileApi {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string | null | undefined;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

const injectScript = (): Promise<TurnstileApi> => {
  const { promise, reject, resolve } = Promise.withResolvers<TurnstileApi>();
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.addEventListener("load", () => {
    if (window.turnstile) {
      resolve(window.turnstile);
    } else {
      reject(new Error("Skrip Turnstile termuat tanpa API."));
    }
  });
  script.addEventListener("error", () => {
    scriptPromise = undefined;
    script.remove();
    reject(new Error("Skrip Turnstile gagal dimuat."));
  });
  // Bukan `append`: tipe `Element` HTMLRewriter dari tipe Workers menimpa
  // overload DOM-nya, jadi `append(node)` tidak lolos type-check.
  document.head.insertBefore(script, null);
  return promise;
};

/** Muat skrip Turnstile sekali per tab; gagal → boleh dicoba lagi. */
const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  scriptPromise ??= injectScript();
  return scriptPromise;
};

interface TurnstileProps {
  /** Berubah → widget di-reset (token sekali pakai sudah terkirim). */
  resetKey?: unknown;
  siteKey: string;
}

/**
 * Widget Cloudflare Turnstile di dalam `<form>`. Token disisipkan widget
 * sebagai input tersembunyi `cf-turnstile-response`; action membacanya lalu
 * mengirim ke api lewat header `x-captcha-response`.
 */
export const Turnstile = ({ resetKey, siteKey }: TurnstileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      try {
        const turnstile = await loadTurnstile();
        const container = containerRef.current;
        if (cancelled || !container) {
          return;
        }
        widgetIdRef.current =
          turnstile.render(container, {
            "error-callback": () => setFailed(true),
            language: "id",
            "response-field-name": TURNSTILE_FIELD,
            sitekey: siteKey,
            // Mengikuti preferensi sistem; tema app (next-themes) tidak
            // diteruskan karena iframe widget dirender Cloudflare.
            theme: "auto",
          }) ?? undefined;
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };
    void mount();
    return () => {
      cancelled = true;
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey !== undefined && widgetIdRef.current) {
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return (
    <div className="flex flex-col gap-2">
      {/* Tinggi widget tetap agar form tidak bergeser saat iframe muncul. */}
      <div className="min-h-16.5" ref={containerRef} />
      {failed ? (
        <p
          className="text-destructive dark:text-destructive-foreground text-sm"
          role="alert"
        >
          Verifikasi keamanan gagal dimuat. Periksa koneksi lalu muat ulang
          halaman.
        </p>
      ) : null}
      <noscript>
        <p className="text-muted-foreground text-sm">
          Aktifkan JavaScript untuk menyelesaikan verifikasi keamanan.
        </p>
      </noscript>
    </div>
  );
};
