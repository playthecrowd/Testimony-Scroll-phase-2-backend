import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { avatar } from "@/lib/images";
import { AccountType, User } from "@/types";

export interface Session {
  isLoggedIn: boolean;
  accountType: AccountType;
  isPlatformAdmin: boolean;
  user: User;
}

export const defaultSession: Session = {
  isLoggedIn: false,
  accountType: "member",
  isPlatformAdmin: false,
  user: { id: "", fullName: "", email: "", accountType: "member", avatarUrl: "", createdAt: "" },
};

export interface AuthResult {
  error?: string;
}

export interface SignUpResult extends AuthResult {
  status: "signed-in" | "check-email";
}

export async function signUp(
  fullName: string,
  email: string,
  password: string,
  accountType: AccountType,
  redirectTo?: string
): Promise<SignUpResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: accountType },
      ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
    },
  });

  if (error) return { status: "check-email", error: error.message };
  // If Supabase's "Confirm email" setting is off (local dev), a session is returned immediately.
  // If it's on (production), no session exists yet -- the user must confirm via email first.
  return data.session ? { status: "signed-in" } : { status: "check-email" };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Supabase's resetPasswordForEmail never reveals whether the address is registered -- it resolves
// without an error either way -- so surfacing error.message here stays neutral by construction; it
// only ever fires for genuine problems (bad email format, rate limiting), never account existence.
export async function requestPasswordReset(email: string, redirectTo?: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  return error ? { error: error.message } : {};
}

// Requires an active session -- either a normal signed-in session, or the temporary one Supabase
// establishes after verifyOtp({ type: "recovery" }) succeeds in app/auth/confirm/route.ts.
export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

export async function getCurrentSession(supabase: SupabaseClient = createClient()): Promise<Session> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaultSession;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, account_type, avatar_url, created_at, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return defaultSession;

  const { data: membership } = await supabase
    .from("church_memberships")
    .select("church_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  const accountType = profile.account_type as AccountType;

  return {
    isLoggedIn: true,
    accountType,
    isPlatformAdmin: !!profile.is_platform_admin,
    user: {
      id: profile.id,
      fullName: profile.full_name ?? "",
      email: profile.email,
      accountType,
      avatarUrl: profile.avatar_url || avatar(profile.full_name || profile.email),
      churchId: membership?.church_id ?? undefined,
      createdAt: profile.created_at,
    },
  };
}

// Where to send a signed-in user right after auth succeeds (sign-in, immediate post-signup
// session, or the email-confirmation callback). A host or organization account with no entity
// membership yet is sent to the matching onboarding flow instead of straight to a dashboard --
// both land on the same reused /host-dashboard once onboarded, per the "one dashboard, dynamic
// labels" design (lib/entityLabel.ts), not a separate Organization dashboard route.
export async function resolvePostAuthDestination(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.account_type === "host" || profile?.account_type === "organization") {
    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);
    if (count && count > 0) return "/host-dashboard";
    return profile.account_type === "organization" ? "/onboarding/organization" : "/onboarding/church";
  }

  return "/dashboard";
}
