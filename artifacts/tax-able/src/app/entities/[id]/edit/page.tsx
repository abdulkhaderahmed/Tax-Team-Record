import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateEntity } from "@/app/actions/entities";
import { EntityForm, type EntityFormValues } from "../../_components/EntityForm";
import { toDateInput } from "@/lib/obligations";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity) notFound();

  const action = updateEntity.bind(null, id);

  const defaultValues: EntityFormValues = {
    legalName: entity.legalName,
    companiesHouseNumber: entity.companiesHouseNumber,
    jurisdiction: entity.jurisdiction,
    entityType: entity.entityType,
    ukTaxResident: entity.ukTaxResident,

    corporationTaxUtr: entity.corporationTaxUtr,
    accountingPeriodStart: toDateInput(entity.accountingPeriodStart),
    accountingPeriodEnd: toDateInput(entity.accountingPeriodEnd),
    companiesHouseAccountsDue: toDateInput(entity.companiesHouseAccountsDue),
    ctReturnRequired: entity.ctReturnRequired,
    ctPaymentMethod: entity.ctPaymentMethod,
    isLargeCompany: entity.isLargeCompany,
    isVeryLargeCompany: entity.isVeryLargeCompany,
    taxableProfitsBand: entity.taxableProfitsBand,

    vatRegistered: entity.vatRegistered,
    vatRegistrationNumber: entity.vatRegistrationNumber,
    vatQuarterEndMonth: entity.vatQuarterEndMonth,

    payeRegistered: entity.payeRegistered,
    hasErs: entity.hasErs,
    hasEmi: entity.hasEmi,
    p11dRequired: entity.p11dRequired,
    psaRequired: entity.psaRequired,

    rdClaimExpected: entity.rdClaimExpected,
    rdNotificationNeeded: entity.rdNotificationNeeded,
    rdAifNeeded: entity.rdAifNeeded,

    capitalAllowancesActivity: entity.capitalAllowancesActivity,
    fullExpensingRelevant: entity.fullExpensingRelevant,
    aiaRelevant: entity.aiaRelevant,
    specialRatePoolRelevant: entity.specialRatePoolRelevant,

    groupReliefRelevant: entity.groupReliefRelevant,
    lossesBroughtForward: entity.lossesBroughtForward,
    transferPricingRelevant: entity.transferPricingRelevant,
    hasPillar2: entity.hasPillar2,

    saoInScope: entity.saoInScope,
    ccoInScope: entity.ccoInScope,
    publishedTaxStrategyInScope: entity.publishedTaxStrategyInScope,

    primaryTaxOwner: entity.primaryTaxOwner,
    financeOwner: entity.financeOwner,
    payrollOwner: entity.payrollOwner,
    externalAdviser: entity.externalAdviser,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> /{" "}
            <Link href={`/entities/${id}`}>{entity.legalName}</Link> / Edit
          </div>
          <h1>Edit — {entity.legalName}</h1>
        </div>
      </div>

      <EntityForm
        action={action}
        defaultValues={defaultValues}
        cancelHref={`/entities/${id}`}
        submitLabel="Save Changes"
      />
    </>
  );
}
