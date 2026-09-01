"use client";

import { useState } from "react";

export function StoreLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const url = `${window.location.origin}${path}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable — no-op
        }
      }}
      className="truncate text-left text-xs text-orange-600 hover:underline"
      title={path}
    >
      {copied ? "Link copiado!" : path}
    </button>
  );
}
