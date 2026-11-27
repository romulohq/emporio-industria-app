import Image from "next/image";
import { NOTES_CARD_MM, PAGE_MIN_HEIGHT_MM, countSheetLayout } from "@/lib/stock/count-sheet-layout";

const BRAND = "#6b5be6";

export type CountSheetGroup = { name: string; products: { id: string; name: string }[] };

/**
 * Folha de contagem da câmara (A4 em pé): na tela aparece como será impressa, com o bloco de anotações
 * colado no fim. A altura das linhas e a letra se ajustam à quantidade de produtos, para a lista encher a folha.
 */
export function CountSheet({ groups }: { groups: CountSheetGroup[] }) {
  const rowCount = groups.reduce((total, g) => total + g.products.length, 0);
  const layout = countSheetLayout(rowCount, groups.length);

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white p-[10mm] shadow-sm ring-1 ring-neutral-200 print:w-auto print:p-0 print:shadow-none print:ring-0">
      <div className="flex flex-col" style={{ minHeight: `${PAGE_MIN_HEIGHT_MM}mm` }}>
        <header className="flex items-center justify-between pb-[3.5mm]" style={{ borderBottom: `0.5mm solid ${BRAND}` }}>
          <Image src="/fabri-logo.png" alt="Fabri" width={1060} height={236} priority className="h-[8mm] w-auto" />
          <div className="text-right">
            <h1 className="text-[4.2mm] font-medium leading-tight text-neutral-900">Contagem de produtos da câmara</h1>
            <p className="text-[3mm] text-[#6b7390]">Folha de contagem</p>
          </div>
        </header>

        <div className="flex items-end gap-[9mm] py-[3mm] text-[3.1mm] text-[#6b7390]">
          <span className="flex items-end gap-2">
            Data <i className="block h-[4mm] w-[28mm] border-b border-neutral-400" />
          </span>
          <span className="flex items-end gap-2">
            Responsável <i className="block h-[4mm] w-[58mm] border-b border-neutral-400" />
          </span>
        </div>

        <div className="columns-2 gap-[8mm]">
          {groups.map((group) => (
            <section key={group.name} style={{ marginBottom: `${layout.sectionGapMm}mm` }}>
              <h2
                className="break-after-avoid font-medium tracking-wide"
                style={{
                  color: BRAND,
                  fontSize: "3.1mm",
                  height: `${layout.sectionHeaderMm}mm`,
                  lineHeight: `${layout.sectionHeaderMm}mm`,
                  borderBottom: "0.2mm solid #c9c4f5",
                }}
              >
                {group.name}
              </h2>
              <table className="w-full border-collapse" style={{ fontSize: `${layout.fontMm}mm` }}>
                <tbody>
                  {group.products.map((p) => (
                    <tr key={p.id} className="break-inside-avoid border-b border-neutral-200" style={{ height: `${layout.rowMm}mm` }}>
                      <td className="pr-2 align-bottom leading-none text-neutral-900" style={{ paddingBottom: `${layout.rowMm * 0.2}mm` }}>
                        {p.name}
                      </td>
                      <td className="w-[17mm] whitespace-nowrap align-bottom leading-none text-neutral-400" style={{ paddingBottom: `${layout.rowMm * 0.2}mm` }}>
                        <span className="inline-block w-[10mm] border-b border-neutral-300 align-bottom" style={{ height: `${layout.fontMm}mm` }} />{" "}
                        cx
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        {/* cartão livre para anotar, sempre no fim da folha */}
        <div className="mt-auto pt-[4mm]">
          <h2 className="mb-[2mm] font-medium tracking-wide" style={{ color: BRAND, fontSize: "3.1mm", lineHeight: "4.5mm" }}>
            Produtos para empacotar
          </h2>
          <div className="rounded-[2.5mm] border border-neutral-300 bg-neutral-50" style={{ height: `${NOTES_CARD_MM}mm` }} />
        </div>
      </div>
    </div>
  );
}
