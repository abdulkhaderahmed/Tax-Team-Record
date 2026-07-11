import Link from "next/link";
import { importObligationsCsv } from "@/app/actions/csvImport";

export default async function ObligationImportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href="/obligations">Obligation register</Link> / Import</div><h1>Import obligations from CSV</h1></div></div>
    {params.errors && <div className="alert alert-warning">{params.errors}</div>}
    {params.dryRun && <div className="alert alert-info">Dry run successful: {params.validated} row(s) validated; nothing was written.</div>}
    {params.imported && <div className="alert alert-info">Imported {params.imported} obligation row(s).</div>}
    <div className="panel" style={{ maxWidth: 760 }}>
      <p className="text-sm text-muted">Required columns: <code>regime</code>, <code>obligationType</code>, <code>description</code>. Optional: entityId, dates, owners and riskLevel. Use Export CSV as the safest template.</p>
      <form action={importObligationsCsv} encType="multipart/form-data">
        <div className="form-group"><label>CSV file</label><input name="file" type="file" accept=".csv,text/csv" required /></div>
        <label className="checkbox-row"><input type="checkbox" name="dryRun" defaultChecked /> Validate only (dry run)</label>
        <div className="flex gap8" style={{ marginTop: 14 }}><button className="btn btn-primary" type="submit">Process CSV</button><a href="/api/exports/obligations" className="btn btn-secondary">Download current register template</a></div>
      </form>
    </div>
  </>;
}
