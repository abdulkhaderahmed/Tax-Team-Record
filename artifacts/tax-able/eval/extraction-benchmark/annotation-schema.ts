import { z } from "zod";

export const TARGET_RECORD_TYPES = ["obligation", "action"] as const;

export const RecordTypeSchema = z.enum([
  ...TARGET_RECORD_TYPES,
  "assumption",
  "caveat",
  "tripwire",
  "evidence",
]);

export const VerificationStatusSchema = z.enum([
  "draft_unverified",
  "verified",
]);

export const CitationVerificationStatusSchema = z.enum([
  "not_annotated",
  "draft_unverified",
  "verified",
]);

export const ConditionSchema = z
  .object({
    applicability: z.enum([
      "unconditional",
      "conditional",
      "not_applicable",
    ]),
    conditionKey: z.string().min(1).nullable(),
    verificationStatus: VerificationStatusSchema,
  })
  .superRefine((condition, context) => {
    const shouldHaveKey = condition.applicability === "conditional";
    if (shouldHaveKey !== (condition.conditionKey !== null)) {
      context.addIssue({
        code: "custom",
        path: ["conditionKey"],
        message: "Only conditional concepts have a conditionKey",
      });
    }
  });

export const GoldCitationSchema = z
  .object({
    acceptedPhysicalPages: z.array(z.number().int().positive()),
    verificationStatus: CitationVerificationStatusSchema,
  })
  .superRefine((citation, context) => {
    if (
      citation.verificationStatus === "not_annotated" &&
      citation.acceptedPhysicalPages.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["acceptedPhysicalPages"],
        message: "Unannotated citations cannot contain page numbers",
      });
    }

    if (
      citation.verificationStatus === "verified" &&
      citation.acceptedPhysicalPages.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["acceptedPhysicalPages"],
        message: "Verified citations require at least one physical page",
      });
    }

    if (
      new Set(citation.acceptedPhysicalPages).size !==
      citation.acceptedPhysicalPages.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["acceptedPhysicalPages"],
        message: "Physical pages must be unique",
      });
    }
  });

export const GoldConceptSchema = z.object({
  conceptId: z.string().regex(/^corpus-0[1-5]--[a-z0-9-]+$/),
  conceptKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  recordType: RecordTypeSchema,
  nonConfidentialSummary: z.string().min(1).max(240),
  materiality: z.enum(["material", "non_material"]),
  annotationStatus: VerificationStatusSchema,
  materialityStatus: VerificationStatusSchema,
  condition: ConditionSchema,
  citation: GoldCitationSchema,
});

export const GoldFixtureSchema = z
  .object({
    fixtureId: z.string().regex(/^corpus-0[1-5]$/),
    documentArchetype: z.string().min(1).max(120),
    targetSet: z.object({
      completeness: z.enum(["partial", "complete"]),
      verificationStatus: VerificationStatusSchema,
    }),
    negativeControlFor: z.array(z.enum(TARGET_RECORD_TYPES)),
    concepts: z.array(GoldConceptSchema),
  })
  .superRefine((fixture, context) => {
    if (
      new Set(fixture.concepts.map((item) => item.conceptId)).size !==
      fixture.concepts.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["concepts"],
        message: "Concept IDs must be unique within a fixture",
      });
    }

    if (
      new Set(fixture.concepts.map((item) => item.conceptKey)).size !==
      fixture.concepts.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["concepts"],
        message: "Concept keys must be unique within a fixture",
      });
    }

    for (const [index, concept] of fixture.concepts.entries()) {
      if (!concept.conceptId.startsWith(`${fixture.fixtureId}--`)) {
        context.addIssue({
          code: "custom",
          path: ["concepts", index, "conceptId"],
          message: "Concept ID must use its fixture ID as the prefix",
        });
      }
    }

    if (fixture.targetSet.verificationStatus === "verified") {
      const targetConcepts = fixture.concepts.filter((concept) =>
        TARGET_RECORD_TYPES.includes(
          concept.recordType as (typeof TARGET_RECORD_TYPES)[number],
        ),
      );
      if (
        targetConcepts.some(
          (concept) =>
            concept.annotationStatus !== "verified" ||
            concept.materialityStatus !== "verified",
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["targetSet", "verificationStatus"],
          message: "A verified target set cannot contain draft target concepts",
        });
      }
    }
  });

export const GoldInventorySchema = z
  .object({
    schemaVersion: z.literal("1"),
    confidentiality: z.literal("non_confidential_concept_inventory"),
    inventoryStatus: VerificationStatusSchema,
    pageNumbering: z.literal("one_based_physical_pdf_page"),
    fixtures: z.array(GoldFixtureSchema).length(5),
  })
  .superRefine((inventory, context) => {
    if (new Set(inventory.fixtures.map((item) => item.fixtureId)).size !== 5) {
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "The inventory must contain five unique fixtures",
      });
    }
  });

export const PredictionCitationSchema = z.object({
  physicalPage: z.number().int().positive(),
  quoteVerified: z.boolean(),
});

export const PredictionSchema = z
  .object({
    predictionId: z.string().min(1),
    conceptKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    recordType: RecordTypeSchema,
    adjudicationStatus: z.enum([
      "automated_unverified",
      "human_adjudicated",
    ]),
    condition: z.object({
      applicability: z.enum([
        "unconditional",
        "conditional",
        "not_applicable",
      ]),
      conditionKey: z.string().min(1).nullable(),
    }),
    citations: z.array(PredictionCitationSchema),
  })
  .superRefine((prediction, context) => {
    const shouldHaveKey = prediction.condition.applicability === "conditional";
    if (shouldHaveKey !== (prediction.condition.conditionKey !== null)) {
      context.addIssue({
        code: "custom",
        path: ["condition", "conditionKey"],
        message: "Only conditional predictions have a conditionKey",
      });
    }
  });

export const PredictionRunSchema = z
  .object({
    schemaVersion: z.literal("1"),
    runId: z.string().min(1),
    modelIdentifier: z.string().min(1),
    promptVersion: z.string().min(1),
    fixtures: z.array(
      z.object({
        fixtureId: z.string().regex(/^corpus-0[1-5]$/),
        predictions: z.array(PredictionSchema),
      }),
    ),
  })
  .superRefine((run, context) => {
    if (
      new Set(run.fixtures.map((item) => item.fixtureId)).size !==
      run.fixtures.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "Prediction fixture IDs must be unique",
      });
    }

    for (const [index, fixture] of run.fixtures.entries()) {
      if (
        new Set(fixture.predictions.map((item) => item.predictionId)).size !==
        fixture.predictions.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["fixtures", index, "predictions"],
          message: "Prediction IDs must be unique within a fixture",
        });
      }
    }
  });

export type RecordType = z.infer<typeof RecordTypeSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type GoldConcept = z.infer<typeof GoldConceptSchema>;
export type GoldFixture = z.infer<typeof GoldFixtureSchema>;
export type GoldInventory = z.infer<typeof GoldInventorySchema>;
export type Prediction = z.infer<typeof PredictionSchema>;
export type PredictionRun = z.infer<typeof PredictionRunSchema>;
