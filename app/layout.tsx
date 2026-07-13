import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Quest for the Kingdom",
  description: "Every lesson becomes a journey. Captured, Studied, Experienced, Applied, Added to the Story.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <PageShell>{children}</PageShell>
        </SessionProvider>
      </body>
    </html>
  );
}
