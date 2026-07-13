import { Loader2, AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="qk-card p-10 text-center text-muted text-sm flex flex-col items-center gap-2">
      <Loader2 size={20} className="animate-spin text-accent-blue-light" />
      {label}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong. Please try again." }: { message?: string }) {
  return (
    <div className="qk-card p-10 text-center text-sm flex flex-col items-center gap-2">
      <AlertTriangle size={20} className="text-red-300" />
      <span className="text-red-300">{message}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="qk-card p-10 text-center text-muted text-sm flex flex-col items-center gap-2">
      <Inbox size={20} className="text-muted" />
      {message}
    </div>
  );
}
