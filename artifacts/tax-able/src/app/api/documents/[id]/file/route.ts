import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { documentContentType, getStorageDriver } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organisation: org } = await requireOrg();
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  if (doc.organisationId !== org.id) return new NextResponse("Not found", { status: 404 });

  let object;
  try {
    object = await getStorageDriver().getObjectStream(doc.storageKey);
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": documentContentType(doc.fileType),
    "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.filename)}"`,
  };
  if (object.contentLength !== undefined) headers["Content-Length"] = String(object.contentLength);

  return new NextResponse(object.stream, { headers });
}
