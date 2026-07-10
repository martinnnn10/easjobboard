import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function CandidateImportPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const base = `/o/${orgSlug}/admin`;

  return (
    <div className="page-shell max-w-2xl space-y-6">
      <div>
        <Link href={`${base}/candidates`} className="text-sm text-brand-700 hover:underline">
          ← Back to candidates
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Import candidates</h1>
      </div>

      <div className="card space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900">Bulk resume &amp; spreadsheet import is on the way</h2>
            <p className="mt-1 text-sm text-zinc-600">
              We&apos;re building bulk upload so you can drop in a folder of resumes or a spreadsheet and have EAS Recruit
              parse and screen them automatically. In the meantime, you can:
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {writable ? (
            <Link href={`${base}/candidates/new`} className="rounded-xl border border-zinc-200 p-4 transition hover:border-brand-300">
              <p className="font-semibold text-zinc-900">Add a candidate manually</p>
              <p className="mt-1 text-sm text-zinc-600">Enter one candidate now and attach them to a job.</p>
              <span className="mt-2 inline-block text-sm font-medium text-brand-700">Add candidate →</span>
            </Link>
          ) : null}
          <Link href={`${base}/jobs/new`} className="rounded-xl border border-zinc-200 p-4 transition hover:border-brand-300">
            <p className="font-semibold text-zinc-900">Create a job</p>
            <p className="mt-1 text-sm text-zinc-600">Post a role so candidates apply and complete a skills screen.</p>
            <span className="mt-2 inline-block text-sm font-medium text-brand-700">Create job →</span>
          </Link>
        </div>

        <p className="text-xs text-zinc-500">
          Want early access to bulk import? Let us know from{" "}
          <Link href={`${base}/settings`} className="text-brand-700 hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
