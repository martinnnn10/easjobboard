import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function NewOrgJobPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  if (!canWrite(user.role)) redirect(`/o/${orgSlug}/admin`);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Create job</h1>
      </div>

      <div className="card">
        <JobForm orgSlug={orgSlug} defaultCompanyName={organization.name} />
      </div>
    </div>
  );
}
