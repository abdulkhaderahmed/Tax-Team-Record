# Document vault and sources — module explainer

## Purpose

Preserve the evidence behind a tax control without turning an uploaded file into an unquestioned source of truth. The vault governs versions, access, reliance and verification; source-system registers govern which system is authoritative for a data category and how conflicts are resolved.

## Document lifecycle

Upload creates a versioned `Document` with content hash, storage key, uploader ID, classification, authority/reliance state and optional entity link. A later upload creates an explicit successor rather than overwriting history. Normal metadata editing cannot change security, restriction, authority, confidence or reliance fields.

Separate controlled actions govern:

- access/restriction changes, which require document-management permission and a reason;
- positive reliance/authority review, which requires a review-capable user independent from the uploader/latest editor;
- source verification, which also requires an independent reviewer and stores reviewer ID/date; and
- archive/deletion, which creates a reasoned tombstone instead of deleting the business record.

The protected file route checks organisation and document-level access before streaming from the storage abstraction. A tombstone currently preserves the stored blob; purge/retention policy remains parked infrastructure work.

## Restriction policy

Restricted documents use explicit grants for read, edit, review and access-management capabilities. Admin and Head of Tax roles can bypass grants by policy. Without access, the application redacts filename, document ID, page reference, excerpt, version link and relevant audit snapshots.

The derived obligation/action/register record remains visible within the organisation. This prevents statutory work disappearing from operational queues, but it is not an ethical wall around the resulting analysis. D-014 records the condition under which this policy should change.

## Provenance and source hierarchy

Creation provenance stays on each live record. `DocumentRecordLink` supports multiple later sources with Source, Evidence, Corroborates or Contradicts semantics; `ReviewItemRecordLink` preserves which extracted candidate created or linked a record. Application validation and database constraints enforce organisation/entity coherence and exactly one target per link.

The source-system module retains data categories, priority rules and conflict resolution. This is useful before integrations: it records why payroll, legal, Finance, Companies House or adviser evidence wins for a fact rather than leaving that decision in a spreadsheet note.

## Counterfactual analysis

- *Let any editor declassify or approve reliance*: rejected because editing the source and approving its use are different duties.
- *Hide the entire derived record with the document*: rejected for the first operating model because it can hide filing work; reversible for demonstrated ethical-wall needs.
- *Hard-delete records and files together*: rejected because audit history and retention obligations need an explicit disposition; eventual blob purge must be a policy-driven job.
- *Single source foreign key only*: rejected because advice can be corroborated, contradicted or superseded by several documents.

## Verified and unproven

Policy tests cover grant semantics, restricted-source redaction and independent positive decisions. Browser/build verification covers the organisation-scoped vault routes. Production object storage, malware scanning, retention, blob purge, encryption/key operations, backup/restore and cross-organisation deployment tests remain unproven or parked.
