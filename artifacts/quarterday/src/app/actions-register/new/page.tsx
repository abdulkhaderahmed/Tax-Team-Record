import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createAction } from "@/app/actions/actionsRegister";
import { ActionForm } from "../_components/ActionForm";

export default async function NewActionPage() {
  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({
        where: { organisationId: org.id },
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      })
    : [];

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
        cancelHref="/actions-register"
        submitLabel="Create Action"
      />
    </>
  );
}
