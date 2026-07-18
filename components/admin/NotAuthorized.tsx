export function NotAuthorized() {
  return (
    <div className="max-w-lg mx-auto py-24 text-center px-4">
      <p className="text-foreground font-semibold mb-2">You don&apos;t have access to this page.</p>
      <p className="text-muted text-sm">This area is restricted to Quest for the Kingdom production administrators.</p>
    </div>
  );
}
