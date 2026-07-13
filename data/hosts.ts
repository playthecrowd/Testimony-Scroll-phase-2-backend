import { Host } from "@/types";
import { avatar } from "@/lib/images";

export const hosts: Host[] = [
  {
    id: "host-radiant-life",
    churchId: "church-radiant-life",
    churchName: "Radiant Life Church",
    logoUrl: avatar("Radiant Life", "2f7dff"),
    facilitatorName: "Pastor Daniel Okoro",
    facilitatorAvatarUrl: avatar("Daniel Okoro", "2f7dff"),
    joinedCount: 1284,
    status: "live",
  },
  {
    id: "host-river",
    churchId: "church-river",
    churchName: "The River Church",
    logoUrl: avatar("The River Church", "5aa2ff"),
    facilitatorName: "Pastor Sarah Mitchell",
    facilitatorAvatarUrl: avatar("Sarah Mitchell", "5aa2ff"),
    joinedCount: 832,
    status: "live",
  },
  {
    id: "host-grace-community",
    churchId: "church-cornerstone",
    churchName: "Grace Community",
    logoUrl: avatar("Grace Community", "8b6cf2"),
    facilitatorName: "Pastor James Lee",
    facilitatorAvatarUrl: avatar("James Lee", "8b6cf2"),
    joinedCount: 614,
    status: "live",
  },
  {
    id: "host-citylight",
    churchId: "church-citylight",
    churchName: "City Light Church",
    logoUrl: avatar("City Light", "e8b34d"),
    facilitatorName: "Pastor David Kim",
    facilitatorAvatarUrl: avatar("David Kim", "e8b34d"),
    joinedCount: 642,
    status: "live",
  },
  {
    id: "host-faith-collective",
    churchId: "church-faith-collective",
    churchName: "Faith Collective",
    logoUrl: avatar("Faith Collective", "36c98a"),
    facilitatorName: "Pastor Alex Morgan",
    facilitatorAvatarUrl: avatar("Alex Morgan", "36c98a"),
    joinedCount: 367,
    status: "scheduled",
  },
  {
    id: "host-new-hope",
    churchId: "church-new-hope",
    churchName: "New Hope Church",
    logoUrl: avatar("New Hope", "2f7dff"),
    facilitatorName: "Pastor Mark Ellison",
    facilitatorAvatarUrl: avatar("Mark Ellison", "2f7dff"),
    joinedCount: 452,
    status: "live",
  },
  {
    id: "host-cornerstone",
    churchId: "church-cornerstone",
    churchName: "Cornerstone Church",
    logoUrl: avatar("Cornerstone", "8b6cf2"),
    facilitatorName: "Bishop Caleb Morris",
    facilitatorAvatarUrl: avatar("Caleb Morris", "8b6cf2"),
    joinedCount: 298,
    status: "scheduled",
  },
  {
    id: "host-abundant-life",
    churchId: "church-abundant-life",
    churchName: "Abundant Life Church",
    logoUrl: avatar("Abundant Life", "e8b34d"),
    facilitatorName: "Pastor Sarah M.",
    facilitatorAvatarUrl: avatar("Sarah M", "e8b34d"),
    joinedCount: 210,
    status: "live",
  },
  {
    id: "host-summit",
    churchId: "church-summit",
    churchName: "Summit Church",
    logoUrl: avatar("Summit", "2f7dff"),
    facilitatorName: "Pastor David Lee",
    facilitatorAvatarUrl: avatar("David Lee", "2f7dff"),
    joinedCount: 188,
    status: "scheduled",
  },
  {
    id: "host-redemption",
    churchId: "church-redemption",
    churchName: "Redemption Church",
    logoUrl: avatar("Redemption", "36c98a"),
    facilitatorName: "Pastor Michael Reyes",
    facilitatorAvatarUrl: avatar("Michael Reyes", "36c98a"),
    joinedCount: 301,
    status: "live",
  },
  {
    id: "host-impact",
    churchId: "church-impact",
    churchName: "Impact Church",
    logoUrl: avatar("Impact Church", "5aa2ff"),
    facilitatorName: "David L. Roberts",
    facilitatorAvatarUrl: avatar("David Roberts", "5aa2ff"),
    joinedCount: 176,
    status: "scheduled",
  },
];

export function getHostById(id: string) {
  return hosts.find((h) => h.id === id);
}

export function getHostsByIds(ids: string[]) {
  return ids.map(getHostById).filter(Boolean) as Host[];
}
