import Link from "next/link";
import { AdviceDemo } from "./advice-demo";

export default function GuidedAdviceDemoPage() {
  return (
    <>
      <div className="demo-breadcrumb">
        <Link href="/">Tax workbench</Link>
        <span>/</span>
        <span>Guided advice review</span>
      </div>
      <AdviceDemo />
    </>
  );
}
