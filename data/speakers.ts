import { Speaker } from "@/types";
import { avatar } from "@/lib/images";

export const speakers: Speaker[] = [
  { id: "spk-daniel-okoro", name: "Pastor Daniel Okoro", avatarUrl: avatar("Daniel Okoro", "2f7dff"), churchId: "church-radiant-life" },
  { id: "spk-grace-johnson", name: "Grace Johnson", avatarUrl: avatar("Grace Johnson", "5aa2ff"), churchId: "church-river" },
  { id: "spk-mark-ellison", name: "Pastor Mark Ellison", avatarUrl: avatar("Mark Ellison", "2f7dff"), churchId: "church-new-hope" },
  { id: "spk-alicia-grant", name: "Dr. Alicia Grant", avatarUrl: avatar("Alicia Grant", "8b6cf2"), churchId: "church-citylight" },
  { id: "spk-james-t", name: "Pastor James T.", avatarUrl: avatar("James T", "36c98a"), churchId: "church-faith-collective" },
  { id: "spk-caleb-morris", name: "Bishop Caleb Morris", avatarUrl: avatar("Caleb Morris", "8b6cf2"), churchId: "church-cornerstone" },
  { id: "spk-sarah-m", name: "Pastor Sarah M.", avatarUrl: avatar("Sarah M", "e8b34d"), churchId: "church-abundant-life" },
  { id: "spk-david-lee", name: "Pastor David Lee", avatarUrl: avatar("David Lee", "2f7dff"), churchId: "church-summit" },
  { id: "spk-michael-reyes", name: "Pastor Michael Reyes", avatarUrl: avatar("Michael Reyes", "36c98a"), churchId: "church-redemption" },
  { id: "spk-david-roberts", name: "David L. Roberts", avatarUrl: avatar("David Roberts", "5aa2ff"), churchId: "church-impact" },
];

export function getSpeakerById(id: string) {
  return speakers.find((s) => s.id === id);
}
