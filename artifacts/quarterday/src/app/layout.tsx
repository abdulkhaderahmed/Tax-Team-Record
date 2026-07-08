import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/nav";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Quarterday — Tax Obligations Register",
  description: "In-house tax team system of record",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppShell>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
