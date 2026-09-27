"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateResponsible,
  toggleResponsibleActive,
  deleteResponsible,
  moveResponsible,
} from "@/app/(app)/admin/setores/actions";
import type { SectorResponsible } from "@/lib/types/database.types";

export function ResponsibleRow({
  responsible,
  productCount,
  isFirst,
  isLast,
}: {
  responsible: SectorResponsible;
  productCount: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);

  async function handleDelete(formData: FormData) {
    if (
      window.confirm(
        `Excluir ${responsible.person_name} (${responsible.role_name})? Os produtos dela ficarão sem responsável.`
      )
    ) {
      await deleteResponsible(formData);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      {editing ? (
        <form
          action={async (formData) => {
            await updateResponsible(formData);
            setEditing(false);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="id" value={responsible.id} />
          <div className="grid grid-cols-2 gap-2">
            <Input name="role_name" defaultValue={responsible.role_name} placeholder="Função" required />
            <Input name="person_name" defaultValue={responsible.person_name} placeholder="Nome" required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {responsible.role_name} — {responsible.person_name}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
              <Badge tone={responsible.active ? "green" : "neutral"}>
                {responsible.active ? "Ativo" : "Inativo"}
              </Badge>
              {productCount} {productCount === 1 ? "produto" : "produtos"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <form action={moveResponsible}>
              <input type="hidden" name="id" value={responsible.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={isFirst}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                aria-label="Mover para cima"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </form>
            <form action={moveResponsible}>
              <input type="hidden" name="id" value={responsible.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={isLast}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <form action={toggleResponsibleActive}>
              <input type="hidden" name="id" value={responsible.id} />
              <input type="hidden" name="active" value={String(responsible.active)} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                {responsible.active ? "Desativar" : "Ativar"}
              </button>
            </form>
            <form action={handleDelete}>
              <input type="hidden" name="id" value={responsible.id} />
              <button
                type="submit"
                className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
      <Link
        href={`/admin/setores/${responsible.sector_id}/responsaveis/${responsible.id}`}
        className="mt-2 inline-block text-xs font-medium text-orange-700 hover:text-orange-800"
      >
        Ver/editar produtos →
      </Link>
    </div>
  );
}
