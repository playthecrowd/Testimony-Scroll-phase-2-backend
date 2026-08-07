import Link from "next/link";
import { Compass } from "lucide-react";

// One consistent wordmark/icon treatment, reused by both the public homepage header and the
// authenticated app shell -- per the UI content guide's own "use one consistent Plotabl Workforce
// wordmark and icon treatment in production" rule.
export function WorkforceLogo({ href = "/workforce" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 shrink-0 focus-ring rounded-lg">
      <span className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center shrink-0">
        <Compass size={18} className="text-[#16210a]" strokeWidth={2.25} />
      </span>
      <span className="font-semibold tracking-tight text-foreground">Plotabl Workforce</span>
    </Link>
  );
}
