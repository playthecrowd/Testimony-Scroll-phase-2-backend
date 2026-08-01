export type EntityType = "church" | "organization";

// Single shared source for every user-facing "Church ___" / "Organization ___" string, so
// Organization pages never show leftover Church wording by omission. Callers pass whichever entity
// type they actually have on hand -- a loaded churches row's entityType where one was already
// fetched, or the signed-in user's own accountType ("organization" vs "host"/"member") for
// session-only contexts (account_type and a manager's own churches.entity_type always agree by
// construction: create_church_with_host only ever inserts entity_type = the intent that was
// authorized against the caller's account_type).
const LABELS = {
  church: {
    entityName: "Church",
    nameField: "Church Name",
    dashboard: "Church Dashboard",
    profile: "Church Profile",
    members: "Church Members",
    experiences: "Church Experiences",
    lessons: "Church Lessons",
    manager: "Church Host",
    createButton: "Create My Church",
    typeField: "Church Type / Tradition",
  },
  organization: {
    entityName: "Organization",
    nameField: "Organization Name",
    dashboard: "Organization Dashboard",
    profile: "Organization Profile",
    members: "Organization Members",
    experiences: "Organization Experiences",
    lessons: "Organization Lessons",
    manager: "Organization Manager",
    createButton: "Create My Organization",
    typeField: "Organization Type / Category",
  },
} as const satisfies Record<EntityType, Record<string, string>>;

export type EntityLabelKey = keyof (typeof LABELS)["church"];

export function entityLabel(entityType: EntityType, key: EntityLabelKey): string {
  return LABELS[entityType][key];
}
