import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function NewOrgJobPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  if (!canWrite(user.role)) redirect(`/o/${orgSlug}/admin`);

  const labels = getOrgLabels(organization);
  const members = listUsersByOrganization(organization.id).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Create {labels.jobSingular}</h1>
      </div>

      <div className="card">
        <JobForm
          orgSlug={orgSlug}
          defaultCompanyName={organization.name}
          members={members}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
