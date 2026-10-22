import { HortifrutTabs } from "@/components/compras/hortifrut-tabs";

export default function HortifrutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Compras</p>
        <h1 className="text-xl font-semibold text-neutral-900">Hortifrut</h1>
      </div>
      <HortifrutTabs />
      {children}
    </div>
  );
}
