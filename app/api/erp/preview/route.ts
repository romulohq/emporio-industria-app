import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/get-session";
import { analyzeRows } from "@/lib/erp/analyze";
import { checkIntegrity } from "@/lib/erp/integrity";
import { parseReport } from "@/lib/erp/parse-report";
import { buildPreview, readUpload } from "@/lib/erp/preview";
import { loadAnalysisContext } from "@/lib/erp/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

  const upload = await readUpload(request);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });

  let parsed;
  try {
    parsed = await parseReport(upload.data, upload.fileName);
  } catch (error) {
    console.error("erp preview: falha ao ler o arquivo", error);
    return NextResponse.json({ error: "Não foi possível ler o arquivo. Confira se é o relatório de Ordens de Produção do Everest." }, { status: 422 });
  }

  const integrity = checkIntegrity(parsed);
  try {
    const context = await loadAnalysisContext(parsed.rows);
    const analysis = analyzeRows(parsed.rows, context);
    return NextResponse.json(buildPreview(upload.fileName, parsed, integrity, analysis));
  } catch (error) {
    console.error("erp preview: falha ao analisar", error);
    return NextResponse.json({ error: "Não foi possível analisar o arquivo agora. Tente de novo." }, { status: 500 });
  }
}
