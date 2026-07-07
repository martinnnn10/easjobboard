import { notFound, redirect } from "next/navigation";
import { ClientPresentation } from "@/components/ClientPresentation";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { buildPresentation } from "@/lib/presentation";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

export default async function PresentationPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  // Presentations expose candidate PII + resume — recruiters/owners only.
  if (!canWrite(user.role)) {
    redirect(`/o/${orgSlug}/admin/candidates/${id}`);
  }

  const data = buildPresentation(orgSlug, organization.id, organization.name, id);
  if (!data) notFound();

  return <ClientPresentation orgSlug={orgSlug} data={data} />;
}
