import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/nav";
import { ClerkProvider } from "@clerk/nextjs";
import { requireValidClerkConfiguration } from "@/lib/clerk-config";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "tax-able — Tax Obligations Register",
  description: "In-house tax team system of record",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <html lang="en" className={inter.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );

  return requireValidClerkConfiguration(process.env) === "configured" ? (
    <ClerkProvider>{content}</ClerkProvider>
  ) : (
    content
  );
}
