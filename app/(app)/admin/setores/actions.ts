"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/** Open orders (and their store lines) follow products to the sector they were moved to. */
async function moveOpenOrdersToSector(productIds: string[], sectorId: string) {
  if (productIds.length === 0) return;
  const admin = createAdminClient();
  const { data: openOrders } = await admin
    .from("production_orders")
    .select("id")
    .in("product_id", productIds)
    .eq("source", "auto_route")
    .in("status", ["pending", "in_progress"]);
  const orderIds = (openOrders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) return;
  await admin.from("production_orders").update({ sector_id: sectorId }).in("id", orderIds);
  await admin.from("production_order_contributions").update({ sector_id: sectorId }).in("order_id", orderIds);
}

/**
 * Saves which products belong to a responsible. Products of the same production unit that are
 * ticked from ANOTHER sector are moved into this responsible's sector (a product's responsible
 * must belong to its sector): the product leaves the old sector's order and its open orders follow.
 */
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
    // only products of this sector's production unit may be moved in from other sectors
    const { data: targetSector } = await supabase.from("sectors").select("unit_id").eq("id", sector_id).maybeSingle();
    const { data: chosen } = await supabase.from("products").select("id, sector_id").in("id", product_ids);
    const sectorIds = [...new Set((chosen ?? []).map((p) => p.sector_id as string))];
    const { data: sectorRows } = await supabase.from("sectors").select("id, unit_id").in("id", sectorIds);
    const unitBySector = new Map((sectorRows ?? []).map((s) => [s.id as string, s.unit_id as string | null]));
    const allowed = (chosen ?? []).filter(
      (p) => p.sector_id === sector_id || (!!targetSector?.unit_id && unitBySector.get(p.sector_id as string) === targetSector.unit_id)
    );
    const moved = allowed.filter((p) => p.sector_id !== sector_id).map((p) => p.id as string);

    // sector and responsible change together, so the product always ends up consistent
    await supabase
      .from("products")
      .update({ sector_id, responsible_id })
      .in("id", allowed.map((p) => p.id as string));
    await moveOpenOrdersToSector(moved, sector_id);
    if (moved.length > 0) {
      revalidatePath("/pedidos/dia");
      revalidatePath("/produtos");
      revalidatePath("/estoque");
    }
  }

  revalidateSetores(sector_id);
  revalidatePath(`/admin/setores/${sector_id}/responsaveis/${responsible_id}`);
}
