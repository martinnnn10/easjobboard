import Link from "next/link";
import { Brandmark } from "@/components/Brandmark";
import { getPlatformCompany, getPlatformEmail, getPlatformName } from "@/lib/env";

export default function HomePage() {
  return (
    <div className="page-shell space-y-16 py-12">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <div className="flex justify-center">
          <Brandmark markSize={56} textClassName="text-3xl" />
        </div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">{getPlatformCompany()}</p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
          The right skills. The right fit. The right hire.
        </h1>
        <p className="text-lg text-zinc-600">
          Screen maintenance, controls, and skilled-trades applicants on real plant-floor scenarios, then post jobs
          once and syndicate to the major US boards — all from a private, branded portal.
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
          <h2 className="font-semibold text-zinc-900">See who can actually do the work</h2>
          <p className="text-sm text-zinc-600">
            Every applicant answers real maintenance, controls, and electrical scenarios. Candidates are ranked by
            demonstrated ability — not resume keywords — with red flags surfaced.
          </p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-zinc-900">One pool, every candidate</h2>
          <p className="text-sm text-zinc-600">
            Applicants and sourced/passive prospects live in one CRM with a shared timeline, tags, owners, and an
            outreach worklist for nurturing people before they apply.
          </p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-zinc-900">Job board syndication</h2>
          <p className="text-sm text-zinc-600">
            Indeed XML feeds and Google for Jobs structured data are generated per organization automatically, with a
            branded careers page at <code className="rounded bg-zinc-100 px-1">/o/your-company</code>.
          </p>
        </div>
      </section>

      <section className="card mx-auto max-w-2xl text-center">
        <h2 className="text-lg font-semibold text-zinc-900">Platform contact</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Questions about {getPlatformName()}? Reach us at{" "}
          <a href={`mailto:${getPlatformEmail()}`} className="text-brand-700 hover:underline">
            {getPlatformEmail()}
          </a>
        </p>
      </section>
    </div>
  );
}
