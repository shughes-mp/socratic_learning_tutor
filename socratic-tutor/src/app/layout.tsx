import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { validateEnvironment } from "@/lib/env-check";

validateEnvironment();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
