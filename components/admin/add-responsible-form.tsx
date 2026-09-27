"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createResponsible } from "@/app/(app)/admin/setores/actions";

export function AddResponsibleForm({ sectorId }: { sectorId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Cadastrar responsável
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createResponsible(formData);
        setOpen(false);
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3"
    >
      <input type="hidden" name="sector_id" value={sectorId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Função</label>
        <Input name="role_name" placeholder="Ex: Confeiteira 1" required className="w-40" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Nome</label>
        <Input name="person_name" placeholder="Ex: Rebeca" required className="w-40" />
      </div>
      <Button type="submit">Salvar</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}
