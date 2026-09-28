"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { regenerateStoreToken } from "@/app/(app)/admin/lojas/actions";

export function StoreRowMenu({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Opções da loja"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-neutral-200 bg-white py-1 text-left shadow-lg"
        >
          <Link
            href={`/admin/lojas/${storeId}/estoque-minimo`}
            className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Estoque mínimo
          </Link>
          <Link
            href={`/admin/lojas/${storeId}/prazos`}
            className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Dias de entrega e prazos
          </Link>
          <Link
            href={`/admin/lojas/${storeId}`}
            className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Editar loja
          </Link>
          <form action={regenerateStoreToken}>
            <input type="hidden" name="store_id" value={storeId} />
            <button
              type="submit"
              className="block w-full px-3 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-50"
            >
              Gerar novo link
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
