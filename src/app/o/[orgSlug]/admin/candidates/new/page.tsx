import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddCandidateForm } from "@/components/AddCandidateForm";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function NewCandidatePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  // Viewers are read-only; they can't add candidates.
  if (!canWrite(user.role)) {
    redirect(`/o/${orgSlug}/admin/candidates`);
  }

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-blue-600 hover:underline">
          ← Back to candidate pool
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Add a sourced candidate</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Save a passive candidate into the pool before they apply — from Apollo, LinkedIn, a referral, or manual
          research. We&apos;ll flag duplicates so the same person never gets two records.
        </p>
      </div>
      <AddCandidateForm orgSlug={orgSlug} />
    </div>
  );
}
