export type LessonStatus = "draft" | "published";
export type LessonEditAction = "save-draft" | "publish" | "save-changes" | "unpublish";

// Which action buttons are legal for a lesson's current status -- draft lessons offer
// Save Draft/Publish, published lessons offer Save Changes/Unpublish.
export function isValidActionForStatus(currentStatus: LessonStatus, action: LessonEditAction): boolean {
  if (currentStatus === "draft") return action === "save-draft" || action === "publish";
  return action === "save-changes" || action === "unpublish";
}

// The status the lesson row should end up with after the given action -- never derived from
// anything the client sends directly, only from this fixed action -> status mapping.
export function resolveNextStatus(currentStatus: LessonStatus, action: LessonEditAction): LessonStatus {
  if (!isValidActionForStatus(currentStatus, action)) {
    throw new Error(`"${action}" is not valid for a ${currentStatus} lesson.`);
  }
  switch (action) {
    case "save-draft":
      return "draft";
    case "publish":
    case "save-changes":
      return "published";
    case "unpublish":
      return "draft";
  }
}
