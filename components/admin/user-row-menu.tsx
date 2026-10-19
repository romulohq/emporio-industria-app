"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { deleteUser } from "@/app/(app)/admin/usuarios/actions";

/** Row menu of the users list: edit, or delete the account (the e-mail can be registered again afterwards). */
export function UserRowMenu({
  userId,
  name,
  email,
  isSelf,
}: {
  userId: string;
  name: string;
  email: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function remove() {
    setOpen(false);
    const label = name && name !== "—" ? `${name} (${email})` : email;
    if (
      !window.confirm(
        `Excluir o usuário ${label}?\n\nA pessoa perde o acesso na hora. O que ela registrou continua no sistema, sem o nome dela. Depois você pode cadastrar o mesmo e-mail de novo, com uma senha nova.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
        aria-label={`Opções de ${email}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-neutral-200 bg-white py-1 text-left shadow-lg"
        >
          <Link
            href={`/admin/usuarios/${userId}`}
            className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={isSelf}
            title={isSelf ? "Você não pode excluir a sua própria conta" : undefined}
            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
          >
            Excluir usuário
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
