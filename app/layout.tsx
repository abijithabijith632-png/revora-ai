import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { publicEnv } from "@/config/env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${publicEnv.appName} — AI-powered CRM & Sales Intelligence`,
    template: `%s · ${publicEnv.appName}`,
  },
  description:
    "Revora AI is an enterprise-grade, AI-powered CRM and Sales Intelligence Platform.",
  applicationName: publicEnv.appName,
  keywords: ["CRM", "Sales Intelligence", "AI", "Revora"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
