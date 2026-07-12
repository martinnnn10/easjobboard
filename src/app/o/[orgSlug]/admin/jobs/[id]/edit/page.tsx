import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { requireOrgSession } from "@/lib/auth";
import { canSeeJob, getJobAccess, getJobVisibleUserIds } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

export default async function EditOrgJobPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  if (!canWrite(user.role)) redirect(`/o/${orgSlug}/admin`);

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) notFound();
  // Can't edit a restricted job you aren't allowed to see.
  if (!canSeeJob(getJobAccess(organization.id, user), job.id)) notFound();

  const members = listUsersByOrganization(organization.id).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));
  const initialVisibleUserIds = getJobVisibleUserIds(job.id);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Edit job</h1>
      </div>

      <div className="card">
        <JobForm
          orgSlug={orgSlug}
          job={job}
          defaultCompanyName={organization.name}
          members={members}
          currentUserId={user.id}
          initialVisibleUserIds={initialVisibleUserIds}
        />
      </div>
    </div>
  );
}
