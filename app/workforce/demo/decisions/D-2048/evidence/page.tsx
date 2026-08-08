import { redirect } from "next/navigation";

// Migrated: Evidence & Outcomes is now the org-wide hub (A6) at /workforce/demo/evidence -- this
// single-decision dataset means "org-wide" and "for D-2048" are the same content in this
// checkpoint, so the content moved rather than being duplicated across two routes.
export default function LegacyDecisionEvidenceRedirect() {
  redirect("/workforce/demo/evidence");
}
