import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SourcingPanel } from "@/components/SourcingPanel";
import { SourcingUnavailable } from "@/components/SourcingUnavailable";
import { extractSkills } from "@/lib/skills";
import { requireOrgSession } from "@/lib/auth";
import { canManageTeam, canWrite } from "@/lib/roles";
import { getJobById } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { isSourcingConfigured } from "@/lib/sourcing";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

export default async function SourceCandidatesPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  if (!canWrite(user.role)) redirect(`/o/${orgSlug}/admin`);

  // No sourcing provider connected → clean, buyer-facing unavailable state
  // instead of exposing an unconfigured feature.
  if (!isSourcingConfigured()) {
    return <SourcingUnavailable orgSlug={orgSlug} canManage={canManageTeam(user.role)} title="Source candidates" />;
  }

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) notFound();

  const jobSkills = extractSkills(`${job.title} ${job.description}`);
  const roleTitle = job.title;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Source candidates</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Search the passive candidate market for{" "}
          <span className="font-medium">{roleTitle}</span>, then rank matches by the job&apos;s required skills. This
          complements inbound applications with outbound reach.
        </p>
      </div>

      {jobSkills.length > 0 ? (
        <div className="card space-y-2">
          <p className="text-sm font-medium text-zinc-900">Searching against these skills</p>
          <div className="flex flex-wrap gap-1">
            {jobSkills.map((skill) => (
              <span key={skill} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <SourcingPanel orgSlug={orgSlug} jobId={job.id} />
    </div>
  );
}
