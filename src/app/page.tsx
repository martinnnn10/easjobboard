import Link from "next/link";
import { getPlatformCompany, getPlatformEmail, getPlatformName } from "@/lib/env";

export default function HomePage() {
  return (
    <div className="page-shell space-y-16 py-12">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">{getPlatformCompany()}</p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">{getPlatformName()}</h1>
        <p className="text-lg text-zinc-600">
          Post jobs once, syndicate to major US job boards, and receive applicant resumes directly in each
          organization&apos;s inbox — all from a private portal.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn-primary">
            Create organization
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in to your portal
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="card space-y-2">
          <h2 className="font-semibold text-zinc-900">Your own careers portal</h2>
          <p className="text-sm text-zinc-600">
            Each organization gets a branded careers page, job listings, and an apply form at{" "}
            <code className="rounded bg-zinc-100 px-1">/o/your-company</code>.
          </p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-zinc-900">Resumes to your email</h2>
          <p className="text-sm text-zinc-600">
            When candidates apply, their resume is emailed to the address you set — not a shared inbox.
          </p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-zinc-900">Job board syndication</h2>
          <p className="text-sm text-zinc-600">
            Indeed XML feeds and Google for Jobs structured data are generated per organization automatically.
          </p>
        </div>
      </section>

      <section className="card mx-auto max-w-2xl text-center">
        <h2 className="text-lg font-semibold text-zinc-900">Platform contact</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Questions about {getPlatformName()}? Reach us at{" "}
          <a href={`mailto:${getPlatformEmail()}`} className="text-blue-600 hover:underline">
            {getPlatformEmail()}
          </a>
        </p>
      </section>
    </div>
  );
}
