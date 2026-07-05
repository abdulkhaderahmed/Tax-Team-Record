import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateManualObligation } from "@/app/actions/manualObligations";
import { ManualObligationForm, type ManualObligationFormValues } from "../../_components/ManualObligationForm";
import { toDateInput } from "@/lib/obligations";

export default async function EditObligationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ob = await prisma.manualObligation.findUnique({ where: { id } });
  if (!ob) notFound();

  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({
        where: { organisationId: org.id },
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      })
    : [];

  const action = updateManualObligation.bind(null, id);

  const defaultValues: ManualObligationFormValues = {
    entityId: ob.entityId,
    regime: ob.regime,
    obligationType: ob.obligationType,
    description: ob.description,
    statutoryBasis: ob.statutoryBasis,
    filingDeadline: toDateInput(ob.filingDeadline),
    paymentDeadline: toDateInput(ob.paymentDeadline),
    internalTargetDate: toDateInput(ob.internalTargetDate),
    recurrence: ob.recurrence,
    periodStart: toDateInput(ob.periodStart),
    periodEnd: toDateInput(ob.periodEnd),
    source: ob.source,

    responsibleOwner: ob.responsibleOwner,
    accountableOwner: ob.accountableOwner,
    consultedParty: ob.consultedParty,
    informedParty: ob.informedParty,
    externalAdviser: ob.externalAdviser,
    externalOperationalOwner: ob.externalOperationalOwner,

    dataCollectionRequired: ob.dataCollectionRequired,
    dataValidationRequired: ob.dataValidationRequired,
    technicalReviewRequired: ob.technicalReviewRequired,
    accountableApprovalRequired: ob.accountableApprovalRequired,
    filingSubmissionRequired: ob.filingSubmissionRequired,
    paymentRequired: ob.paymentRequired,

    dataCompletenessStatus: ob.dataCompletenessStatus,
    dataValidationStatus: ob.dataValidationStatus,
    technicalReviewStatus: ob.technicalReviewStatus,
    approvalStatus: ob.approvalStatus,
    workflowProgressStatus: ob.workflowProgressStatus,
    evidenceStatus: ob.evidenceStatus,
    filingSubmissionStatus: ob.filingSubmissionStatus,
    paymentStatus: ob.paymentStatus,
    overallWorkflowStatus: ob.overallWorkflowStatus,

    evidenceRequired: ob.evidenceRequired,
    evidenceDescription: ob.evidenceDescription,
    evidenceFileLink: ob.evidenceFileLink,
    evidenceOwner: ob.evidenceOwner,

    riskLevel: ob.riskLevel,
    consequenceOfMissingDeadline: ob.consequenceOfMissingDeadline,
    openIssueBlocker: ob.openIssueBlocker,
    notes: ob.notes,
    exceptionRequired: ob.exceptionRequired,

    sourceType: ob.sourceType,
    sourceDocumentReference: ob.sourceDocumentReference,
    sourcePageParagraph: ob.sourcePageParagraph,
    createdBy: ob.createdBy,
    lastUpdatedBy: ob.lastUpdatedBy,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations">Obligation Register</Link> /{" "}
            <Link href={`/obligations/${id}`}>
              {ob.description.length > 50 ? ob.description.slice(0, 50) + "…" : ob.description}
            </Link>{" "}
            / Edit
          </div>
          <h1>Edit Obligation</h1>
        </div>
      </div>

      <ManualObligationForm
        action={action}
        defaultValues={defaultValues}
        entities={entities}
        cancelHref={`/obligations/${id}`}
        submitLabel="Save Changes"
      />
    </>
  );
}
