import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rules = [
  {
    ruleKey: "CT600_FILING",
    name: "CT600 Filing",
    description:
      "Corporation Tax Return — due 12 months after the end of the accounting period",
    appliesTo: "ALL",
  },
  {
    ruleKey: "CT_PAYMENT_STANDARD",
    name: "Corporation Tax Payment",
    description:
      "Corporation Tax payment — due 9 months and 1 day after the end of the accounting period (standard and large companies)",
    appliesTo: "STANDARD_AND_LARGE",
  },
  {
    ruleKey: "CT_QIP_1",
    name: "Corporation Tax QIP 1 of 4",
    description:
      "Quarterly Instalment Payment 1 — due on 14th day of 7th month of accounting period (very large companies only)",
    appliesTo: "VERY_LARGE",
  },
  {
    ruleKey: "CT_QIP_2",
    name: "Corporation Tax QIP 2 of 4",
    description:
      "Quarterly Instalment Payment 2 — due on 14th day of 10th month of accounting period (very large companies only)",
    appliesTo: "VERY_LARGE",
  },
  {
    ruleKey: "CT_QIP_3",
    name: "Corporation Tax QIP 3 of 4",
    description:
      "Quarterly Instalment Payment 3 — due on 14th day of 1st month after accounting period end (very large companies only)",
    appliesTo: "VERY_LARGE",
  },
  {
    ruleKey: "CT_QIP_4",
    name: "Corporation Tax QIP 4 of 4",
    description:
      "Quarterly Instalment Payment 4 — due on 14th day of 4th month after accounting period end (very large companies only)",
    appliesTo: "VERY_LARGE",
  },
  {
    ruleKey: "VAT_QUARTERLY_RETURN",
    name: "VAT Quarterly Return",
    description:
      "VAT Return and payment — due 1 month and 7 days after the end of each VAT quarter",
    appliesTo: "VAT_REGISTERED",
  },
  {
    ruleKey: "P11D",
    name: "P11D Expenses & Benefits",
    description:
      "P11D form — due 6 July following the end of the tax year",
    appliesTo: "EMPLOYER",
  },
  {
    ruleKey: "P11D_B",
    name: "P11D(b) Class 1A NIC Return",
    description:
      "P11D(b) form and Class 1A NIC payment — due 6 July following the end of the tax year",
    appliesTo: "EMPLOYER",
  },
  {
    ruleKey: "ERS_ANNUAL_RETURN",
    name: "ERS Annual Return",
    description:
      "Employment-Related Securities annual return — due 6 July following the end of the tax year",
    appliesTo: "ERS",
  },
];

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
  // ── Obligation rules ─────────────────────────────────────────
  console.log("Seeding obligation rules...");
  for (const rule of rules) {
    await prisma.obligationRule.upsert({
      where: { ruleKey: rule.ruleKey },
      update: rule,
      create: rule,
    });
  }
  console.log(`Seeded ${rules.length} obligation rules`);

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

  await prisma.user.upsert({
    where: { email: "alex@acmetax.co.uk" },
    update: { name: "Alex Smith", role: "admin", organisationId: org.id },
    create: {
      name: "Alex Smith",
      email: "alex@acmetax.co.uk",
      role: "admin",
      organisationId: org.id,
    },
  });

  console.log(`Demo org: ${org.name}`);
  console.log("Demo user: alex@acmetax.co.uk (admin)");

  // ── Demo entity ──────────────────────────────────────────────
  const entity = await prisma.entity.upsert({
    where: { id: "demo-entity-1" },
    update: {},
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
      primaryTaxOwner: "Alex Smith",
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
      owner: "Alex Smith",
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
      owner: "Alex Smith",
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
      owner: "Alex Smith",
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
      owner: "Alex Smith",
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
    reviewOwner?: string;
    reviewFrequency?: string;
    notes?: string;
  }> = [
    {
      dataCategoryName: "Legal entity name",
      authSourceId: "ss-companies-house",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Authoritative source wins",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Company registration number",
      authSourceId: "ss-companies-house",
      conflictHandling: "Authoritative source wins",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Corporation Tax UTR",
      authSourceId: "ss-hmrc-portal",
      conflictHandling: "Authoritative source wins",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Accounting period start/end",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Manual review required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
      notes: "ERP is authoritative for accounting period boundaries; adviser documents should agree.",
    },
    {
      dataCategoryName: "VAT quarter/stagger",
      authSourceId: "ss-hmrc-portal",
      secondarySourceId: "ss-spreadsheets",
      conflictHandling: "Authoritative source wins",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Payroll taxable pay",
      authSourceId: "ss-payroll",
      secondarySourceId: "ss-hr",
      conflictHandling: "Payroll confirmation required",
      reviewOwner: "Payroll Manager",
      reviewFrequency: "Monthly",
    },
    {
      dataCategoryName: "Employee identity",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-payroll",
      conflictHandling: "Manual review required",
      reviewOwner: "HR Director",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Employee tax residence",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
      notes: "Global mobility adviser should confirm complex residency positions.",
    },
    {
      dataCategoryName: "ERS reportable event data",
      authSourceId: "ss-spreadsheets",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "R&D expenditure data",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-adviser-docs",
      conflictHandling: "Adviser confirmation required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
      notes: "ERP is authoritative for expenditure amounts; adviser claim schedule must reconcile.",
    },
    {
      dataCategoryName: "R&D technical evidence",
      authSourceId: "ss-adviser-docs",
      conflictHandling: "Tax owner approval required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Fixed asset register data",
      authSourceId: "ss-far",
      secondarySourceId: "ss-erp",
      conflictHandling: "Finance confirmation required",
      reviewOwner: "Finance Director",
      reviewFrequency: "Quarterly",
    },
    {
      dataCategoryName: "Capital expenditure data",
      authSourceId: "ss-erp",
      secondarySourceId: "ss-far",
      conflictHandling: "Finance confirmation required",
      reviewOwner: "Finance Director",
      reviewFrequency: "Quarterly",
    },
    {
      dataCategoryName: "Benefits and expenses data",
      authSourceId: "ss-hr",
      secondarySourceId: "ss-payroll",
      conflictHandling: "Payroll confirmation required",
      reviewOwner: "Payroll Manager",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "P11D data",
      authSourceId: "ss-payroll",
      secondarySourceId: "ss-hr",
      conflictHandling: "Manual review required",
      reviewOwner: "Payroll Manager",
      reviewFrequency: "Annually",
    },
    {
      dataCategoryName: "Filing submission evidence",
      authSourceId: "ss-hmrc-portal",
      secondarySourceId: "ss-spreadsheets",
      conflictHandling: "Authoritative source wins",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Per filing",
      notes: "HMRC portal receipt is always the authoritative confirmation of submission.",
    },
    {
      dataCategoryName: "Payment evidence",
      authSourceId: "ss-erp",
      conflictHandling: "Finance confirmation required",
      reviewOwner: "Finance Director",
      reviewFrequency: "Per payment",
    },
    {
      dataCategoryName: "Adviser technical advice",
      authSourceId: "ss-adviser-docs",
      conflictHandling: "Tax owner approval required",
      reviewOwner: "Alex Smith",
      reviewFrequency: "Per engagement",
      notes: "Adviser documents are authoritative for advice conclusions but not necessarily for the underlying facts.",
    },
  ];

  for (const rule of priorityRules) {
    const catId = catByName[rule.dataCategoryName];
    if (!catId) continue;
    await prisma.sourcePriorityRule.upsert({
      where: { organisationId_dataCategoryId: { organisationId: org.id, dataCategoryId: catId } },
      update: {},
      create: {
        organisationId: org.id,
        dataCategoryId: catId,
        authSourceId: rule.authSourceId,
        secondarySourceId: rule.secondarySourceId,
        tertiarySourceId: rule.tertiarySourceId,
        conflictHandling: rule.conflictHandling,
        reviewOwner: rule.reviewOwner,
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
