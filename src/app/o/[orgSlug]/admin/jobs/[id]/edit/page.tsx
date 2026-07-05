import Link from "next/link";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { requireOrgSession } from "@/lib/auth";
import { getJobById } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

export default async function EditOrgJobPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) notFound();

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Edit job</h1>
      </div>

      <div className="card">
        <JobForm orgSlug={orgSlug} job={job} defaultCompanyName={organization.name} />
      </div>
    </div>
  );
}
