import Link from "next/link";
import { AlertTriangle, ClipboardList, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Card, CardContent, CardHeader, CardIcon, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/orders/status-badge";
import { PriorityBadge } from "@/components/orders/priority-badge";
import { formatQuantity } from "@/lib/format/labels";
import type { Product, ProductionOrder, Sector } from "@/lib/types/database.types";

function greetingName(fullName: string | null, email: string | null) {
  const source = fullName ?? email ?? "";
  const first = source.split(" ")[0].split("@")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [
    { data: lowStock },
    { data: openOrders },
    { data: sectors },
    { count: activeProductsCount },
    { count: openOrdersCount },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .eq("is_low_stock", true)
      .order("name"),
    supabase
      .from("production_orders")
      .select("*, products(name, unit)")
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(20),
    supabase.from("sectors").select("*"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("production_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const products = (lowStock ?? []) as Product[];
  const orders = (openOrders ?? []) as (ProductionOrder & {
    products: { name: string; unit: string } | null;
  })[];

  const todayRaw = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const stats = [
    {
      label: "Produtos ativos",
      value: activeProductsCount ?? 0,
      icon: Package,
      tone: "orange" as const,
    },
    {
      label: "Estoque baixo",
      value: products.length,
      icon: AlertTriangle,
      tone: "red" as const,
    },
    {
      label: "Ordens em aberto",
      value: openOrdersCount ?? 0,
      icon: ClipboardList,
      tone: "blue" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 text-white shadow-lg sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Olá, {greetingName(profile.full_name, profile.email)}, bem-vindo(a)!
        </h1>
        <p className="mt-1 text-sm text-white/80">{today}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <CardIcon tone={stat.tone} size="md">
                <stat.icon className="h-5 w-5" strokeWidth={2.25} />
              </CardIcon>
              <div>
                <p className="text-2xl font-extrabold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-neutral-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="justify-between">
            <div className="flex items-center gap-3">
              <CardIcon tone="red">
                <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </CardIcon>
              <CardTitle>Estoque baixo</CardTitle>
            </div>
            <Link href="/estoque" className="text-xs font-semibold text-orange-600 hover:underline">
              Ver estoque
            </Link>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum produto abaixo do mínimo. 🎉</p>
            ) : (
              <ul className="space-y-3">
                {products.map((product) => (
                  <li key={product.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-neutral-900">{product.name}</span>
                    <span className="font-semibold text-red-600">
                      {formatQuantity(product.current_quantity, product.unit)} / mín.{" "}
                      {formatQuantity(product.min_quantity, product.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="justify-between">
            <div className="flex items-center gap-3">
              <CardIcon tone="blue">
                <ClipboardList className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </CardIcon>
              <CardTitle>Ordens em aberto</CardTitle>
            </div>
            <Link href="/pedidos" className="text-xs font-semibold text-orange-600 hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma ordem pendente no momento.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-neutral-900">
                        {order.products?.name ?? "—"}
                      </span>
                      <span className="ml-2 text-neutral-500">
                        {sectorsById[order.sector_id]?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={order.priority} />
                      <StatusBadge status={order.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
