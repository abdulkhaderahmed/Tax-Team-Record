import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createAction } from "@/app/actions/actionsRegister";
import { ActionForm } from "../_components/ActionForm";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";

export default async function NewActionPage() {
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
            <Link href="/actions-register">Actions Register</Link> / New Action
          </div>
          <h1>Add Action</h1>
        </div>
      </div>

      <ActionForm
        action={createAction}
        entities={entities}
        documents={documents}
        cancelHref="/actions-register"
        submitLabel="Create Action"
        isNew
      />
    </>
  );
}
