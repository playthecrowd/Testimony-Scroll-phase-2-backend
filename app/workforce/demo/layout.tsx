import { RoleProvider } from "@/components/workforce/demo/RoleContext";

// Wraps every /workforce/demo/** page in the preview-role context so the active role persists
// across client-side navigation between pages -- Next.js layouts stay mounted across sibling
// route changes within their subtree, which is what makes the localStorage-backed state in
// RoleProvider survive navigation without a re-read on every page.
export default function WorkforceDemoLayout({ children }: { children: React.ReactNode }) {
  return <RoleProvider>{children}</RoleProvider>;
}
