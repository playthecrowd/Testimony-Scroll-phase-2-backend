import { AuthScreen } from "@/components/auth/AuthScreen";

// D2 (Trello mCY4Thmo): must never be statically prerendered/cached -- a signed-in visitor hitting
// this route depends on proxy.ts's AUTH_PATHS redirect running on every request, which a cached
// static response can bypass. See docs/REPAIR_D2_DIAGNOSIS.md.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <AuthScreen initialTab="signup" />;
}
