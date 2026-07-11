import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateObligation } from "@/app/actions/obligations";
import { ObligationForm, type ObligationFormValues } from "../../_components/ObligationForm";
import { toDateInput } from "@/lib/obligations";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";

export default async function EditObligationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrg();

  const ob = await prisma.obligation.findFirst({
    where: { id, organisationId: context.orgId, deletedAt: null },
  });
  if (!ob) notFound();

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

  const action = updateObligation.bind(null, id);

  const defaultValues: ObligationFormValues = {
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
    sourceDocumentId: ob.sourceDocumentId,
    sourceDocumentReference: ob.sourceDocumentReference,
    sourcePageParagraph: ob.sourcePageParagraph,
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

      <ObligationForm
        action={action}
        defaultValues={defaultValues}
        entities={entities}
        documents={documents}
        cancelHref={`/obligations/${id}`}
        submitLabel="Save Changes"
        canReviewControls={hasPermission(context.user.role, "review:perform")}
      />
    </>
  );
}
