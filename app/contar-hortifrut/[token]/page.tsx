import { createAdminClient } from "@/lib/supabase/admin";
import { fortalezaDateISO, formatBrDate } from "@/lib/dates";
import { HortifrutiCountForm } from "@/components/public/hortifruti-count-form";
import { submitHortifrutiCount } from "./actions";

export default async function ContarHortifrutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "hortifruti_count_token").maybeSingle();
  if (!setting || setting.value !== token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Link inválido</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Este link de contagem do hortifrut não é válido. Fale com o administrador para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  const today = fortalezaDateISO();
  const [{ data: materials }, { data: counts }] = await Promise.all([
    admin.from("raw_materials").select("id, name, unit").eq("category", "hortifruti").eq("active", true).order("name"),
    admin.from("hortifruti_counts").select("raw_material_id, quantity").eq("count_date", today),
  ]);
  const countById = new Map((counts ?? []).map((c) => [c.raw_material_id as string, Number(c.quantity)]));

  return (
    <div className="mx-auto min-h-screen max-w-md bg-neutral-50 px-4 pb-24 pt-6">
      <h1 className="text-xl font-bold text-neutral-900">Contagem do hortifrut</h1>
      <p className="mb-4 mt-1 text-sm text-neutral-500">
        {formatBrDate(today)} — informe a quantidade que há em estoque de cada item. Deixe em branco o que não contou.
      </p>
      <HortifrutiCountForm
        materials={(materials ?? []).map((m) => ({
          id: m.id as string,
          name: String(m.name).replace(/^MP\s+/i, ""),
          unit: m.unit as string,
          quantity: countById.get(m.id as string) ?? null,
        }))}
        action={submitHortifrutiCount.bind(null, token)}
      />
    </div>
  );
}
