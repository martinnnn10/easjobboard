import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddCandidateForm } from "@/components/AddCandidateForm";
import { requireOrgSession } from "@/lib/auth";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

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

  const jobs = listJobsByOrganization(organization.id).map((j) => ({ id: j.id, title: j.title }));
  const recruiters = listUsersByOrganization(organization.id)
    .filter((u) => u.role !== "viewer")
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-brand-700 hover:underline">
          ← Back to candidates
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Add / import a candidate</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Add someone who didn&apos;t apply through a public job page — from a referral, LinkedIn, Indeed, ZipRecruiter,
          100Hires, or manual research. Optionally upload a resume, attach them to a job, and assign a recruiter.
          We&apos;ll flag duplicates so the same person never gets two records.
        </p>
      </div>
      <AddCandidateForm orgSlug={orgSlug} jobs={jobs} recruiters={recruiters} />
    </div>
  );
}
