import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createManualObligation } from "@/app/actions/manualObligations";
import { ManualObligationForm } from "../_components/ManualObligationForm";

export default async function NewObligationPage() {
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
            <Link href="/obligations">Obligation Register</Link> / New Obligation
          </div>
          <h1>Add Obligation</h1>
        </div>
      </div>

      <ManualObligationForm
        action={createManualObligation}
        entities={entities}
        cancelHref="/obligations"
        submitLabel="Create Obligation"
      />
    </>
  );
}
