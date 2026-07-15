// Shared by the create (Experience Builder) and edit lesson forms so labels stay wired to their
// inputs consistently (implicit <label> association -- works for screen readers and keyboard nav
// without needing generated id/htmlFor pairs).
export function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">
        {label} {required && <span className="text-accent-blue-light">*</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-red-300 mt-1">{error}</span>}
    </label>
  );
}
