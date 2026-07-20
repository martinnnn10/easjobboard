import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportCenter } from "@/components/ImportCenter";
import { requireOrgSession } from "@/lib/auth";
import { listImportBatches } from "@/lib/candidate-import";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

function ago(iso: string): string {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

export default async function CandidateImportPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);

  const header = (
    <div>
      <p className="eyebrow">Import Center</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Import candidates</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600">
        Bring candidates in from an Indeed Employer or ATS CSV export. EAS Recruit maps your columns, dedupes against
        your pool, and lets you attach candidates to jobs or send skills screens — so imported people become rankable by
        demonstrated ability, not just a résumé.
      </p>
    </div>
  );

  // Viewers are read-only — they cannot import candidate PII.
  if (!canWrite(user.role)) {
    return (
      <div className="page-shell space-y-5">
        {header}
        <div className="card space-y-2 py-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">Importing needs recruiter access</h2>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Your account is a viewer (read-only). Ask an owner to import candidates or upgrade your role in Team settings.
          </p>
          <Link href={`/o/${orgSlug}/admin/candidates`} className="btn-secondary mx-auto mt-2 text-sm">
            Back to candidates
          </Link>
        </div>
      </div>
    );
  }

  const access = getJobAccess(organization.id, user);
  const jobs = listJobsByOrganization(organization.id)
    .filter((j) => canSeeJob(access, j.id))
    .map((j) => ({ id: j.id, title: j.title, status: j.status }));
  const batches = listImportBatches(organization.id, 5);

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {header}
        <Link href={`/o/${orgSlug}/admin/candidates/new`} className="btn-secondary text-sm">
          Add one candidate
        </Link>
      </div>

      <ImportCenter orgSlug={orgSlug} jobs={jobs} />

      {batches.length > 0 ? (
        <section className="space-y-3">
          <p className="eyebrow">Recent imports</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 text-right font-medium">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                  <th className="px-4 py-2.5 text-right font-medium">Skipped</th>
                  <th className="px-4 py-2.5 text-right font-medium">Failed</th>
                  <th className="px-4 py-2.5 font-medium">By</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{b.source_label || b.source}</td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-zinc-500">{b.filename}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-brand-700">{b.created_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{b.updated_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{b.skipped_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{b.failed_count}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{b.imported_by_name || "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{ago(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
