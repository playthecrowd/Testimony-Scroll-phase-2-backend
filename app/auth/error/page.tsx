import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isConfig = reason === "config";

  return (
    <div className="max-w-lg mx-auto py-24 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
        <ShieldAlert size={26} className="text-red-300" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {isConfig ? "Backend not configured" : "Confirmation link problem"}
      </h1>
      <p className="text-muted text-sm mb-8">
        {isConfig
          ? "Supabase isn't configured yet. See docs/SUPABASE_SETUP.md to finish setup."
          : "That confirmation link is invalid or has expired. Try signing in, or create a new account."}
      </p>
      <LinkButton href="/login">Back to Sign In</LinkButton>
    </div>
  );
}
