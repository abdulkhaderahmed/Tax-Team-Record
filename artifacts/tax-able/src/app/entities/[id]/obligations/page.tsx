import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

/**
 * The entity-specific legacy calendar used a second obligation table. Keep the
 * old URL as a compatibility route, but always land in the one canonical
 * obligation register filtered to the requested entity.
 */
export default async function EntityObligationsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireOrg();
  const entity = await prisma.entity.findFirst({
    where: { id, organisationId: orgId, deletedAt: null },
    select: { id: true },
  });

  if (!entity) redirect("/entities");
  redirect(`/obligations?entity=${encodeURIComponent(id)}`);
}
