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

async function main() {
  console.log("Seeding obligation rules...");
  for (const rule of rules) {
    await prisma.obligationRule.upsert({
      where: { ruleKey: rule.ruleKey },
      update: rule,
      create: rule,
    });
  }
  console.log(`Seeded ${rules.length} obligation rules`);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
