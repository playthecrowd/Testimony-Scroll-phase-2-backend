import { RoleProvider } from "@/components/workforce/demo/RoleContext";
import { WorkforceStoreProvider } from "@/components/workforce/demo/StoreContext";

// Wraps every /workforce/demo/** page in the preview-role context and the shared mutable demo
// state store so both persist across client-side navigation between pages -- Next.js layouts stay
// mounted across sibling route changes within their subtree, which is what makes the
// localStorage-backed state in both providers survive navigation without a re-read on every page.
export default function WorkforceDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <WorkforceStoreProvider>{children}</WorkforceStoreProvider>
    </RoleProvider>
  );
}
