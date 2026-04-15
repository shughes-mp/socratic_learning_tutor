import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { validateEnvironment } from "@/lib/env-check";

validateEnvironment();

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Socratic Tutor",
  description:
    "A Socratic tutoring tool for professional learning courses. Guides adult learners through assigned readings using probing questions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable} app-shell`}>
        {children}
      </body>
    </html>
  );
}
