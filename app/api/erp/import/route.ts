import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/get-session";
import type { ImportOptions } from "@/lib/erp/analyze";
import { importOptionsSchema, readUpload } from "@/lib/erp/preview";
import { ImportError, runImport } from "@/lib/erp/run-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });

  const upload = await readUpload(request);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });

  let options: ImportOptions;
  try {
    options = importOptionsSchema.parse(JSON.parse(String(upload.form.get("options") ?? "{}")));
  } catch {
    return NextResponse.json({ error: "Opções da importação inválidas." }, { status: 400 });
  }

  // o servidor lê o arquivo de novo e confere tudo: nada que veio da tela vale sem passar por aqui
  try {
    const summary = await runImport({
      data: upload.data,
      fileName: upload.fileName,
      options,
      importedBy: { id: session.userId, name: session.profile.full_name ?? session.profile.email },
    });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error("erp import: falha inesperada", error);
    return NextResponse.json({ error: "Não foi possível importar o arquivo." }, { status: 500 });
  }
}
