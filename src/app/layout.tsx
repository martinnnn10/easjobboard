import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getPlatformCompany, getPlatformName } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: getPlatformName(),
    template: `%s | ${getPlatformName()}`,
  },
  description: `Multi-organization recruiting platform by ${getPlatformCompany()}.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 bg-white">
          <div className="page-shell flex items-center justify-between py-4">
            <Link href="/" className="text-lg font-semibold text-zinc-900">
              {getPlatformName()}
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary px-3 py-1.5 text-sm">
                Get started
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
          {getPlatformName()} · A recruiting platform by {getPlatformCompany()}
        </footer>
      </body>
    </html>
  );
}
