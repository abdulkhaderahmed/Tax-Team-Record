import { Prisma, PrismaClient } from "@prisma/client";
import { CONTROLLED_RULE_DEFINITIONS } from "../src/lib/controlled-rule-definitions";

const prisma = new PrismaClient();

const dataCategories = [
  "Legal entity name",
  "Company registration number",
  "Corporation Tax UTR",
  "Accounting period start/end",
  "Companies House accounts due date",
  "Corporation Tax filing deadline",
  "Corporation Tax payment deadline",
  "VAT registration number",
  "VAT quarter/stagger",
  "PAYE reference",
  "Employee identity",
  "Employee tax residence",
  "Payroll taxable pay",
  "Benefits and expenses data",
  "P11D data",
  "PSA data",
  "Share scheme participant data",
  "EMI option data",
  "ERS reportable event data",
  "Cap table/shareholding data",
  "Share valuation data",
  "R&D project data",
  "R&D expenditure data",
  "R&D technical evidence",
  "Fixed asset register data",
  "Capital expenditure data",
  "Capital allowances treatment",
  "Group relief/loss data",
  "Transfer pricing documentation",
  "Pillar 2 data",
  "Adviser technical advice",
  "Filing submission evidence",
  "Payment evidence",
  "Board/approval evidence",
  "Other",
];

async function main() {
  // ── Data categories (global, no org) ────────────────────────
  console.log("Seeding data categories...");
  for (let i = 0; i < dataCategories.length; i++) {
    await prisma.dataCategory.upsert({
      where: { name: dataCategories[i] },
      update: { displayOrder: i + 1 },
      create: { name: dataCategories[i], displayOrder: i + 1 },
    });
  }
  console.log(`Seeded ${dataCategories.length} data categories`);

  // ── Demo organisation and user ───────────────────────────────
  console.log("Seeding demo organisation and user...");
  const org = await prisma.organisation.upsert({
    where: { id: "demo-org" },
    update: { name: "Acme Tax Ltd" },
    create: { id: "demo-org", name: "Acme Tax Ltd" },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "alex@acmetax.co.uk" },
    update: { name: "Demo Administrator", role: "admin", organisationId: org.id },
    create: {
      id: "demo-admin-user",
      name: "Demo Administrator",
      email: "alex@acmetax.co.uk",
      role: "admin",
      organisationId: org.id,
    },
  });

  const reviewerUser = await prisma.user.upsert({
    where: { email: "reviewer@acmetax.co.uk" },
    update: { name: "Demo Reviewer", role: "reviewer", organisationId: org.id },
    create: {
      id: "demo-reviewer-user",
      name: "Demo Reviewer",
      email: "reviewer@acmetax.co.uk",
      role: "reviewer",
      organisationId: org.id,
    },
  });

  // ── Controlled rule content ─────────────────────────────────
  console.log("Seeding controlled rule versions...");
  for (const definition of CONTROLLED_RULE_DEFINITIONS) {
    const { ruleKey, regime, triggerConfig, citations = [], ...versionDefinition } = definition;
    const rule = await prisma.taxRule.upsert({
      where: {
        organisationId_ruleKey: {
          organisationId: org.id,
          ruleKey,
        },
      },
      // Controlled records are immutable once present. Changes go through the
      // proposal/review workflow and create a successor version.
      update: {},
      create: {
        organisationId: org.id,
        ruleKey,
        regime,
      },
    });

    const existingVersion = await prisma.taxRuleVersion.findUnique({
      where: { ruleId_version: { ruleId: rule.id, version: 1 } },
    });
    if (existingVersion) continue;

    const version = await prisma.taxRuleVersion.create({
      data: {
        ...versionDefinition,
        ruleId: rule.id,
        triggerConfig: triggerConfig as Prisma.InputJsonValue,
        version: 1,
        effectiveFrom: new Date(definition.effectiveFrom),
        sourceLastCheckedAt: new Date(definition.sourceLastCheckedAt),
        status: "Approved",
        createdById: adminUser.id,
        reviewedById: reviewerUser.id,
        reviewedAt: new Date("2026-07-11T00:00:00.000Z"),
      },
    });
    await prisma.ruleCitation.create({
      data: {
        ruleVersionId: version.id,
        title: version.statutoryBasis,
        url: version.statutoryUrl,
        authorityLevel: version.authorityLevel,
        checkedAt: version.sourceLastCheckedAt,
      },
    });
    for (const citation of citations) {
      await prisma.ruleCitation.create({
        data: {
          ruleVersionId: version.id,
          title: citation.title,
          url: citation.url,
          authorityLevel: citation.authorityLevel,
          locator: citation.locator,
          checkedAt: version.sourceLastCheckedAt,
        },
      });
    }
  }
  console.log(`Seeded ${CONTROLLED_RULE_DEFINITIONS.length} controlled rules`);

  console.log(`Demo org: ${org.name}`);
  console.log("Demo users: alex@acmetax.co.uk (admin), reviewer@acmetax.co.uk (reviewer)");

  // ── Demo entity ──────────────────────────────────────────────
  const entity = await prisma.entity.upsert({
    where: { id: "demo-entity-1" },
    update: { primaryTaxOwner: adminUser.id },
    create: {
      id: "demo-entity-1",
      organisationId: org.id,
      legalName: "Acme Operations Ltd",
      companiesHouseNumber: "12345678",
      jurisdiction: "England & Wales",
      entityType: "Private limited company",
      ukTaxResident: true,
      corporationTaxUtr: "1234567890",
      accountingPeriodStart: new Date("2025-04-01"),
      accountingPeriodEnd: new Date("2026-03-31"),
      ctReturnRequired: true,
      isLargeCompany: false,
      isVeryLargeCompany: false,
      vatRegistered: true,
      vatRegistrationNumber: "GB123456789",
      vatQuarterEndMonth: 3,
      payeRegistered: true,
      hasErs: true,
      hasEmi: false,
      p11dRequired: true,
      psaRequired: false,
      rdClaimExpected: true,
      rdNotificationNeeded: false,
      rdAifNeeded: true,
      capitalAllowancesActivity: true,
      saoInScope: false,
      publishedTaxStrategyInScope: false,
      hasPillar2: false,
      primaryTaxOwner: adminUser.id,
      externalAdviser: "Big4 LLP",
    },
  });
  console.log(`Demo entity: ${entity.legalName}`);

  // ── Demo source systems ──────────────────────────────────────
  console.log("Seeding demo source systems...");

  const sourceSystems = [
    {
      id: "ss-hmrc-portal",
      name: "HMRC Online Services",
      systemType: "HMRC portal",
      description: "HMRC's online portal for CT returns, VAT submissions, PAYE and employer filings",
      owner: "Demo Administrator",
      department: "Tax",
      externalProvider: "HMRC",
      accessMethod: "Manual entry",
      refreshFrequency: "As required",
      containsPersonalData: false,
      containsPrivilegedData: false,
      status: "Active",
    },
    {
      id: "ss-companies-house",
      name: "Companies House",
      systemType: "Companies House",
      description: "Public register for legal entity data, filing history, and accounts",
      owner: "Demo Administrator",
      department: "Tax",
      externalProvider: "Companies House",
      accessMethod: "Read-only document",
      refreshFrequency: "On demand",
      containsPersonalData: false,
      containsPrivilegedData: false,
      status: "Active",
    },
    {
      id: "ss-erp",
      name: "Sage 200 (ERP)",
      systemType: "ERP / general ledger",
      description: "General ledger and financial data — source for accounting periods, expenditure, and P&L",
      owner: "Finance Director",
      department: "Finance",
      externalProvider: "Sage",
      accessMethod: "CSV export",
      refreshFrequency: "Monthly",
      containsPersonalData: false,
      containsPrivilegedData: false,
      status: "Active",
    },
    {
      id: "ss-payroll",
      name: "Payroll System (Xero Payroll)",
      systemType: "Payroll",
      description: "Payroll records including gross pay, PAYE, NIC, and employee details",
      owner: "Payroll Manager",
      department: "Finance",
      externalProvider: "Xero",
      accessMethod: "CSV export",
      refreshFrequency: "Monthly",
      containsPersonalData: true,
      containsPrivilegedData: false,
      status: "Active",
    },
    {
      id: "ss-hr",
      name: "HR System (Personio)",
      systemType: "HR",
      description: "Employee master data, tax residency flags, contract types and benefit enrolments",
      owner: "HR Director",
      department: "HR",
      externalProvider: "Personio",
      accessMethod: "CSV export",
      refreshFrequency: "Monthly",
      containsPersonalData: true,
      containsPrivilegedData: false,
      status: "Active",
    },
    {
      id: "ss-adviser-docs",
      name: "Big4 LLP Document Portal",
      systemType: "Adviser documents",
      description: "External adviser technical memos, advice letters, valuation reports, and R&D claim schedules",
      owner: "Demo Administrator",
      department: "Tax",
      externalProvider: "Big4 LLP",
      accessMethod: "External adviser provided",
      refreshFrequency: "As required",
      containsPersonalData: false,
      containsPrivilegedData: true,
      status: "Active",
    },
    {
      id: "ss-spreadsheets",
      name: "Tax Team Spreadsheets",
      systemType: "Spreadsheet",
      description: "Working papers, obligation trackers, and ad hoc calculation spreadsheets held on SharePoint",
      owner: "Demo Administrator",
      department: "Tax",
      externalProvider: null,
      accessMethod: "Manual entry",
      refreshFrequency: "Ad hoc",
      containsPersonalData: false,
      containsPrivilegedData: true,
      status: "Active",
    },
    {
      id: "ss-far",
      name: "Fixed Asset Register",
      systemType: "Fixed asset register",
      description: "Fixed asset register maintained in Excel — source for capital allowances computations",
      owner: "Finance Director",
      department: "Finance",
      externalProvider: null,
      accessMethod: "File upload",
      refreshFrequency: "Quarterly",
      containsPersonalData: false,
      containsPrivilegedData: false,
      status: "Active",
    },
  ];

  for (const ss of sourceSystems) {
    await prisma.sourceSystem.upsert({
      where: { id: ss.id },
      update: {},
      create: { ...ss, organisationId: org.id },
    });
  }
  console.log(`Seeded ${sourceSystems.length} source systems`);

  // ── Default source priority rules ───────────────────────────
  console.log("Seeding default source priority rules...");

  const allCategories = await prisma.dataCategory.findMany();
  const catByName = Object.fromEntries(allCategories.map((c) => [c.name, c.id]));

  const priorityRules: Array<{
    dataCategoryName: string;
    authSourceId?: string;
    secondarySourceId?: string;
    tertiarySourceId?: string;
    conflictHandling: string;
    reviewOwnerId?: string;
    reviewFrequency?: string;
    notes?: string;
  }> = [
    {
      dataCategoryName: "Legal entity name",
      authSourceId: "ss-companies-house",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Authoritative source wins",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Company registration number",
      authSourceId: "ss-companies-house",
      conflictHandling: "Authoritative source wins",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Corporation Tax UTR",
      authSourceId: "ss-hmrc-portal",
      conflictHandling: "Authoritative source wins",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Accounting period start/end",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Manual review required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
      notes: "ERP is authoritative for accounting period boundaries; adviser documents should agree.",
    },
    {
      dataCategoryName: "VAT quarter/stagger",
      authSourceId: "ss-hmrc-portal",
      secondarySourceId: "ss-spreadsheets",
      conflictHandling: "Authoritative source wins",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Payroll taxable pay",
      authSourceId: "ss-payroll",
      secondarySourceId: "ss-hr",
      conflictHandling: "Payroll confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Monthly",
    },
    {
      dataCategoryName: "Employee identity",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-payroll",
      conflictHandling: "Manual review required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Employee tax residence",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
      notes: "Global mobility adviser should confirm complex residency positions.",
    },
    {
      dataCategoryName: "ERS reportable event data",
      authSourceId: "ss-spreadsheets",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "R&D expenditure data",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
      notes: "ERP is authoritative for expenditure amounts; adviser claim schedule must reconcile.",
    },
    {
      dataCategoryName: "R&D technical evidence",
      authSourceId: "ss-adviser-docs",
      conflictHandling: "Tax owner approval required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Fixed asset register data",
      authSourceId: "ss-far",
      secondarySourceId: "ss-erp",
      conflictHandling: "Finance confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Quarterly",
    },
    {
      dataCategoryName: "Capital expenditure data",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-far",
      conflictHandling: "Finance confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Quarterly",
    },
    {
      dataCategoryName: "Benefits and expenses data",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-payroll",
      conflictHandling: "Payroll confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "P11D data",
      authSourceId: "ss-payroll",
      secondarySourceId: "ss-hr",
      conflictHandling: "Manual review required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Filing submission evidence",
      authSourceId: "ss-hmrc-portal",
      secondarySourceId: "ss-spreadsheets",
      conflictHandling: "Authoritative source wins",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Per filing",
      notes: "HMRC portal receipt is always the authoritative confirmation of submission.",
    },
    {
      dataCategoryName: "Payment evidence",
      authSourceId: "ss-erp",
      conflictHandling: "Finance confirmation required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Per payment",
    },
    {
      dataCategoryName: "Adviser technical advice",
      authSourceId: "ss-adviser-docs",
      conflictHandling: "Tax owner approval required",
      reviewOwnerId: adminUser.id,
      reviewFrequency: "Per engagement",
      notes: "Adviser documents are authoritative for advice conclusions but not necessarily for the underlying facts.",
    },
  ];

  for (const rule of priorityRules) {
    const catId = catByName[rule.dataCategoryName];
    if (!catId) continue;
    await prisma.sourcePriorityRule.upsert({
      where: { organisationId_dataCategoryId: { organisationId: org.id, dataCategoryId: catId } },
      update: {
        authSourceId: rule.authSourceId,
        secondarySourceId: rule.secondarySourceId,
        tertiarySourceId: rule.tertiarySourceId,
        conflictHandling: rule.conflictHandling,
        reviewOwnerId: rule.reviewOwnerId,
        reviewFrequency: rule.reviewFrequency,
        notes: rule.notes,
      },
      create: {
        organisationId: org.id,
        dataCategoryId: catId,
        authSourceId: rule.authSourceId,
        secondarySourceId: rule.secondarySourceId,
        tertiarySourceId: rule.tertiarySourceId,
        conflictHandling: rule.conflictHandling,
        reviewOwnerId: rule.reviewOwnerId,
        reviewFrequency: rule.reviewFrequency,
        notes: rule.notes,
      },
    });
  }
  console.log(`Seeded ${priorityRules.length} source priority rules`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
