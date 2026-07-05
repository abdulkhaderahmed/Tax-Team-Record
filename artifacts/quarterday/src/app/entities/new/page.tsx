import Link from "next/link";
import { createEntity } from "@/app/actions/entities";
import { EntityForm } from "../_components/EntityForm";

export default function NewEntityPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> / New Entity
          </div>
          <h1>Add Entity</h1>
        </div>
      </div>

      <EntityForm
        action={createEntity}
        cancelHref="/entities"
        submitLabel="Create Entity"
      />
    </>
  );
}
