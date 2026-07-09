import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";
import { Brandmark } from "@/components/Brandmark";
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
  description: `Manufacturing hiring intelligence by ${getPlatformCompany()} — screen maintenance, controls, and skilled-trades applicants for real troubleshooting ability before you interview.`,
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
      <Link href="/#pricing" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
        Pricing
      </Link>
      <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
        Sign in
      </Link>
      <Link href="/signup" className="btn-primary px-3 py-1.5 text-sm">
        Start free trial
      </Link>
    </nav>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Authenticated app pages (/o/[org]/admin/*) get the sidebar shell from the
  // admin layout instead of the marketing header/footer.
  const isAdmin = (await headers()).get("x-is-admin") === "1";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {isAdmin ? (
          children
        ) : (
          <>
            <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3.5">
                <Link href="/" className="flex items-center">
                  <Brandmark />
                </Link>
                <HeaderNav />
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="mt-auto border-t border-zinc-200 bg-white">
              <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-zinc-500">
                <Brandmark textClassName="text-base" markSize={26} />
                <span>Manufacturing hiring intelligence by {getPlatformCompany()}</span>
              </div>
            </footer>
          </>
        )}
      </body>
    </html>
  );
}
