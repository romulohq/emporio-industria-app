"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import {
  createResponsibleSchema,
  updateResponsibleSchema,
  responsibleIdSchema,
  assignProductResponsibleSchema,
  saveResponsibleProductsSchema,
} from "@/lib/validations/sector-responsible";
import type { SectorResponsible } from "@/lib/types/database.types";

function revalidateSetores(sectorId?: string) {
  revalidatePath("/admin/setores");
  if (sectorId) revalidatePath(`/admin/setores/${sectorId}`);
}

export async function createResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = createResponsibleSchema.safeParse({
    sector_id: formData.get("sector_id"),
    role_name: formData.get("role_name"),
    person_name: formData.get("person_name"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();

  const { count } = await supabase
    .from("sector_responsibles")
    .select("id", { count: "exact", head: true })
    .eq("sector_id", parsed.data.sector_id);

  await supabase.from("sector_responsibles").insert({ ...parsed.data, display_order: count ?? 0 });

  revalidateSetores(parsed.data.sector_id);
}

export async function updateResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = updateResponsibleSchema.safeParse({
    id: formData.get("id"),
    role_name: formData.get("role_name"),
    person_name: formData.get("person_name"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: responsible } = await supabase
    .from("sector_responsibles")
    .update({ role_name: parsed.data.role_name, person_name: parsed.data.person_name })
    .eq("id", parsed.data.id)
    .select("sector_id")
    .single();

  revalidateSetores(responsible?.sector_id);
}

export async function toggleResponsibleActive(formData: FormData) {
  await requireAdmin();

  const parsed = responsibleIdSchema.safeParse({ id: formData.get("id") });
  const active = formData.get("active") === "true";
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: responsible } = await supabase
    .from("sector_responsibles")
    .update({ active: !active })
    .eq("id", parsed.data.id)
    .select("sector_id")
    .single();

  revalidateSetores(responsible?.sector_id);
}

export async function deleteResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = responsibleIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: responsible } = await supabase
    .from("sector_responsibles")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  await supabase.from("sector_responsibles").delete().eq("id", parsed.data.id);

  revalidateSetores(responsible?.sector_id);
}

export async function moveResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = responsibleIdSchema.safeParse({ id: formData.get("id") });
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("sector_responsibles")
    .select("*")
    .eq("id", parsed.data.id)
    .single();
  if (!current) return;

  const { data: siblings } = await supabase
    .from("sector_responsibles")
    .select("*")
    .eq("sector_id", current.sector_id)
    .order("display_order", { ascending: true });

  const list = (siblings ?? []) as SectorResponsible[];
  const index = list.findIndex((r) => r.id === current.id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return;

  const other = list[swapIndex];
  await Promise.all([
    supabase.from("sector_responsibles").update({ display_order: other.display_order }).eq("id", current.id),
    supabase.from("sector_responsibles").update({ display_order: current.display_order }).eq("id", other.id),
  ]);

  revalidateSetores(current.sector_id);
}

/** Quick single-product assignment from the sector summary's "sem responsável" list. */
export async function assignProductResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = assignProductResponsibleSchema.safeParse({
    product_id: formData.get("product_id"),
    responsible_id: formData.get("responsible_id"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .update({ responsible_id: parsed.data.responsible_id })
    .eq("id", parsed.data.product_id)
    .select("sector_id")
    .single();

  revalidateSetores(product?.sector_id);
}

export async function saveResponsibleProducts(formData: FormData) {
  await requireAdmin();

  const parsed = saveResponsibleProductsSchema.safeParse({
    responsible_id: formData.get("responsible_id"),
    sector_id: formData.get("sector_id"),
    product_ids: formData.getAll("product_ids"),
  });
  if (!parsed.success) return;

  const { responsible_id, sector_id, product_ids } = parsed.data;
  const supabase = await createClient();

  await supabase
    .from("products")
    .update({ responsible_id: null })
    .eq("sector_id", sector_id)
    .eq("responsible_id", responsible_id)
    .not("id", "in", `(${product_ids.length ? product_ids.join(",") : "00000000-0000-0000-0000-000000000000"})`);

  if (product_ids.length) {
    await supabase
      .from("products")
      .update({ responsible_id })
      .eq("sector_id", sector_id)
      .in("id", product_ids);
  }

  revalidateSetores(sector_id);
  revalidatePath(`/admin/setores/${sector_id}/responsaveis/${responsible_id}`);
}
