import { User } from "@/types";
import { avatar } from "@/lib/images";

export const demoMember: User = {
  id: "user-maya",
  fullName: "Maya L.",
  email: "maya@example.com",
  accountType: "member",
  avatarUrl: avatar("Maya L", "2f7dff"),
  churchId: "church-radiant-life",
  createdAt: "2024-01-10",
};

export const demoHost: User = {
  id: "user-maya-host",
  fullName: "Maya L.",
  email: "maya@example.com",
  accountType: "host",
  avatarUrl: avatar("Maya L", "8b6cf2"),
  churchId: "church-radiant-life",
  createdAt: "2024-01-10",
};

// Additional community members referenced by leaderboard / testimonies
export const communityUsers: User[] = [
  { id: "user-ethan", fullName: "Ethan D.", email: "ethan@example.com", accountType: "member", avatarUrl: avatar("Ethan D", "2f7dff"), churchId: "church-cornerstone", createdAt: "2023-11-01" },
  { id: "user-grace-m", fullName: "Grace M.", email: "gracem@example.com", accountType: "member", avatarUrl: avatar("Grace M", "5aa2ff"), churchId: "church-new-hope", createdAt: "2023-10-01" },
  { id: "user-james-t2", fullName: "James T.", email: "jamest@example.com", accountType: "member", avatarUrl: avatar("James T", "36c98a"), churchId: "church-faith-collective", createdAt: "2023-09-01" },
  { id: "user-abigail", fullName: "Abigail R.", email: "abigail@example.com", accountType: "member", avatarUrl: avatar("Abigail R", "e8b34d"), churchId: "church-river", createdAt: "2023-08-01" },
  { id: "user-grace-johnson", fullName: "Grace Johnson", email: "gracej@example.com", accountType: "member", avatarUrl: avatar("Grace Johnson", "8b6cf2"), churchId: "church-river", createdAt: "2023-07-01" },
  { id: "user-michael-r", fullName: "Michael R.", email: "michaelr@example.com", accountType: "member", avatarUrl: avatar("Michael R", "2f7dff"), churchId: "church-impact", createdAt: "2023-06-01" },
  { id: "user-sarah-m2", fullName: "Sarah M.", email: "sarahm@example.com", accountType: "member", avatarUrl: avatar("Sarah M", "e8b34d"), churchId: "church-abundant-life", createdAt: "2023-05-01" },
  { id: "user-lisa-k", fullName: "Lisa K.", email: "lisak@example.com", accountType: "member", avatarUrl: avatar("Lisa K", "36c98a"), churchId: "church-citylight", createdAt: "2023-04-01" },
  { id: "user-david-l", fullName: "David L.", email: "davidl@example.com", accountType: "member", avatarUrl: avatar("David L", "5aa2ff"), churchId: "church-impact", createdAt: "2023-03-01" },
  { id: "user-barbara-w", fullName: "Barbara W.", email: "barbaraw@example.com", accountType: "member", avatarUrl: avatar("Barbara W", "8b6cf2"), churchId: "church-summit", createdAt: "2023-02-01" },
  { id: "user-alex-k", fullName: "Alex K.", email: "alexk@example.com", accountType: "member", avatarUrl: avatar("Alex K", "2f7dff"), churchId: "church-cornerstone", createdAt: "2023-01-01" },
  { id: "user-tiffany-s", fullName: "Tiffany S.", email: "tiffanys@example.com", accountType: "member", avatarUrl: avatar("Tiffany S", "e8b34d"), churchId: "church-redemption", createdAt: "2022-12-01" },
  { id: "user-daniel-o", fullName: "Pastor Daniel O.", email: "danielo@example.com", accountType: "host", avatarUrl: avatar("Daniel O", "36c98a"), churchId: "church-radiant-life", createdAt: "2022-11-01" },
];

export function getUserById(id: string) {
  if (id === demoMember.id) return demoMember;
  if (id === demoHost.id) return demoHost;
  return communityUsers.find((u) => u.id === id);
}
