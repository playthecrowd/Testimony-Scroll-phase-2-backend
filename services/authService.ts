import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { avatar } from "@/lib/images";
import { AccountType, User } from "@/types";

export interface Session {
  isLoggedIn: boolean;
  accountType: AccountType;
  user: User;
}

export const defaultSession: Session = {
  isLoggedIn: false,
  accountType: "member",
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
  accountType: AccountType
): Promise<SignUpResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: accountType },
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
  await supabase.auth.signOut();
}

export async function getCurrentSession(supabase: SupabaseClient = createClient()): Promise<Session> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaultSession;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, account_type, avatar_url, created_at")
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
// session, or the email-confirmation callback). A host with no church membership yet is sent
// to onboarding instead of straight to a dashboard.
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

  if (profile?.account_type === "host") {
    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);
    return count && count > 0 ? "/host-dashboard" : "/onboarding/church";
  }

  return "/dashboard";
}
