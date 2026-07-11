import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createObligation } from "@/app/actions/obligations";
import { ObligationForm } from "../_components/ObligationForm";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";

export default async function NewObligationPage() {
  const context = await requireOrg();
  const [entities, documents] = await Promise.all([
    prisma.entity.findMany({
      where: { organisationId: context.orgId, deletedAt: null },
      orderBy: { legalName: "asc" },
      select: { id: true, legalName: true },
    }),
    prisma.document.findMany({
      where: documentAccessWhere(context, "view"),
      orderBy: { uploadedAt: "desc" },
      select: { id: true, filename: true, versionNumber: true },
    }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations">Obligation Register</Link> / New Obligation
          </div>
          <h1>Add Obligation</h1>
        </div>
      </div>

      <ObligationForm
        action={createObligation}
        entities={entities}
        documents={documents}
        cancelHref="/obligations"
        submitLabel="Create Obligation"
        isNew
      />
    </>
  );
}
