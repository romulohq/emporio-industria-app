import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadRawMaterials, loadRecipe, loadSubproducts } from "@/lib/recipes/load";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { SubproductHeader } from "@/components/recipes/subproduct-forms";

export default async function SubprodutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, sectors } = await requireUser();
  const supabase = await createClient();

  const { list, recipes } = await loadSubproducts(supabase);
  const sp = list.find((s) => s.id === id);
  if (!sp) notFound();
  const { recipe, lines } = await loadRecipe(supabase, { subproductId: id });
  const rawMaterials = await loadRawMaterials(supabase);
  const canEdit = profile.is_admin || sectors.length > 0;

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/produtos/subprodutos" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          Subprodutos
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">Subproduto (SP)</h1>
      </div>

      <SubproductHeader id={sp.id} initialName={sp.name} initialUnit={sp.unit} canEdit={canEdit} />

      <RecipeEditor
        owner={{ subproductId: id }}
        ownerName={sp.name}
        ownerCode={null}
        ownerUnit={sp.unit}
        ownerKind="Produto intermediário"
        initialYieldQuantity={recipe?.yield_quantity != null ? Number(recipe.yield_quantity) : null}
        initialYieldUnit={recipe?.yield_unit ?? sp.unit}
        initialInstructions={recipe?.instructions ?? ""}
        initialLines={lines}
        subproducts={list.filter((s) => s.active && s.id !== id).map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
        rawMaterials={rawMaterials.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, unit: m.unit }))}
        subRecipes={recipes}
        canEdit={canEdit}
      />
    </div>
  );
}
