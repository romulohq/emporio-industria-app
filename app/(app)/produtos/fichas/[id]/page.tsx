import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadRecipe, loadSubproducts } from "@/lib/recipes/load";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function FichaProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, sectors: mySectors } = await requireUser();
  const supabase = await createClient();

  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: sector } = await supabase.from("sectors").select("*").eq("id", (product as Product).sector_id).maybeSingle();

  if (sector && /embalage/i.test((sector as Sector).name)) {
    return (
      <div className="space-y-3">
        <Link href="/produtos/fichas" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          Fichas técnicas
        </Link>
        <p className="text-sm text-neutral-600">Embalagens não têm ficha técnica.</p>
      </div>
    );
  }

  const [{ recipe, lines }, { list, recipes }] = await Promise.all([
    loadRecipe(supabase, { productId: id }),
    loadSubproducts(supabase),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/produtos/fichas" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          Fichas técnicas
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{(product as Product).name}</h1>
        {sector && <p className="text-sm text-neutral-500">{(sector as Sector).name}</p>}
      </div>

      <RecipeEditor
        owner={{ productId: id }}
        ownerName={(product as Product).name}
        initialYieldQuantity={recipe?.yield_quantity != null ? Number(recipe.yield_quantity) : null}
        initialYieldUnit={recipe?.yield_unit ?? ""}
        initialInstructions={recipe?.instructions ?? ""}
        initialLines={lines}
        subproducts={list.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
        subRecipes={recipes}
        canEdit={profile.is_admin || mySectors.length > 0}
      />
    </div>
  );
}
