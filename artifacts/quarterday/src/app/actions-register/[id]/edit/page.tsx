import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateAction } from "@/app/actions/actionsRegister";
import { ActionForm, type ActionFormValues } from "../../_components/ActionForm";
import { toDateInput } from "@/lib/obligations";

export default async function EditActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const a = await prisma.action.findUnique({ where: { id } });
  if (!a) notFound();

  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({
        where: { organisationId: org.id },
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      })
    : [];

  const action = updateAction.bind(null, id);

  const defaultValues: ActionFormValues = {
    entityId: a.entityId,
    description: a.description,
    deadline: toDateInput(a.deadline),
    relativeDeadlineTrigger: a.relativeDeadlineTrigger,
    relativeDeadlineOffset: a.relativeDeadlineOffset,
    conditionText: a.conditionText,

    responsibleParty: a.responsibleParty,
    accountableParty: a.accountableParty,
    consultedParty: a.consultedParty,
    informedParty: a.informedParty,
    externalAdviser: a.externalAdviser,
    externalOperationalOwner: a.externalOperationalOwner,

    dataCollectionRequired: a.dataCollectionRequired,
    dataValidationRequired: a.dataValidationRequired,
    technicalReviewRequired: a.technicalReviewRequired,
    accountableApprovalRequired: a.accountableApprovalRequired,
    filingSubmissionRequired: a.filingSubmissionRequired,
    paymentRequired: a.paymentRequired,

    dataCompletenessStatus: a.dataCompletenessStatus,
    dataValidationStatus: a.dataValidationStatus,
    technicalReviewStatus: a.technicalReviewStatus,
    approvalStatus: a.approvalStatus,
    workflowProgressStatus: a.workflowProgressStatus,
    evidenceStatus: a.evidenceStatus,
    filingSubmissionStatus: a.filingSubmissionStatus,
    paymentStatus: a.paymentStatus,
    overallStatus: a.overallStatus,

    evidenceRequired: a.evidenceRequired,
    evidenceDescription: a.evidenceDescription,

    riskLevel: a.riskLevel,
    openIssueBlocker: a.openIssueBlocker,
    notes: a.notes,
    exceptionRequired: a.exceptionRequired,

    sourceType: a.sourceType,
    sourceDocumentReference: a.sourceDocumentReference,
    sourcePageParagraph: a.sourcePageParagraph,
    createdBy: a.createdBy,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/actions-register">Actions Register</Link> /{" "}
            <Link href={`/actions-register/${id}`}>
              {a.description.length > 50 ? a.description.slice(0, 50) + "…" : a.description}
            </Link>{" "}
            / Edit
          </div>
          <h1>Edit Action</h1>
        </div>
      </div>

      <ActionForm
        action={action}
        defaultValues={defaultValues}
        entities={entities}
        cancelHref={`/actions-register/${id}`}
        submitLabel="Save Changes"
      />
    </>
  );
}
