import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { MatchScore } from "@/components/MatchScore";
import {
  countApplicationsByOrganization,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";

const PAGE_SIZE = 25;

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function OrgApplicantsPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const total = countApplicationsByOrganization(organization.id);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), pageCount) : 1;

  const applicants = listApplicationsByOrganization(organization.id, {
    orderBy: "score",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + applicants.length;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Applicants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ranked by how well each resume matches the job&apos;s skills. Resumes are also emailed to{" "}
          {organization.application_email} when candidates apply.
        </p>
      </div>

      {applicants.length === 0 ? (
        <div className="card text-zinc-600">No applications yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Resume</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((application) => (
                <tr key={application.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{application.applicant_name}</div>
                    <div className="text-zinc-500">{application.applicant_email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{application.job_title}</td>
                  <td className="px-4 py-3">
                    <MatchScore score={application.match_score} skills={application.resume_skills} />
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationStatusSelect
                      orgSlug={orgSlug}
                      applicationId={application.id}
                      initialStatus={application.status}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{application.applicant_phone || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{new Date(application.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <a href={`/api/o/${orgSlug}/applications/${application.id}/resume`} className="text-blue-600 hover:underline">
                      {application.resume_filename}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Showing {rangeStart}–{rangeEnd} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/o/${orgSlug}/admin/applicants?page=${page - 1}`}
                className="btn-secondary px-3 py-1.5"
              >
                ← Previous
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-50">← Previous</span>
            )}
            {page < pageCount ? (
              <Link
                href={`/o/${orgSlug}/admin/applicants?page=${page + 1}`}
                className="btn-secondary px-3 py-1.5"
              >
                Next →
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-50">Next →</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
