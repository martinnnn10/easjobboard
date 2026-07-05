import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { LogoutButton } from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";
import { getPlatformCompany, getPlatformName } from "@/lib/env";
import { getOrganizationById } from "@/lib/organizations";

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

/**
 * Session-aware header nav: signed-in users see their org and a dashboard link
 * instead of the marketing "Sign in / Get started" pair.
 */
async function HeaderNav() {
  const session = await getSession();
  const organization = session ? getOrganizationById(session.orgId) : null;

  if (session && organization) {
    return (
      <nav className="flex items-center gap-4 text-sm">
      <Link href={`/o/${organization.slug}/admin`} className="font-medium text-zinc-900 hover:text-blue-700">
          {organization.name}
        </Link>
        <Link href={`/o/${organization.slug}/admin`} className="btn-primary px-3 py-1.5 text-sm">
          Dashboard
        </Link>
        <LogoutButton
          orgSlug={organization.slug}
          redirectTo="/"
          label="Sign out"
          className="text-zinc-600 hover:text-zinc-900"
        />
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
        Sign in
      </Link>
      <Link href="/signup" className="btn-primary px-3 py-1.5 text-sm">
        Get started
      </Link>
    </nav>
  );
}

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
            <HeaderNav />
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
