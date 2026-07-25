import Link from "next/link";
import { notFound } from "next/navigation";
import { ScreenBuilder } from "@/components/ScreenBuilder";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { getScreenRecord, listVersions } from "@/lib/screen-store";
import { SCREEN_CATEGORY_LABELS } from "@/lib/screens";

export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function ScreenBuilderPage({ params, searchParams }: PageProps) {
  const { orgSlug, id } = await params;
  const { step } = await searchParams;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();
  const { user } = await requireOrgSession(orgSlug);

  const record = getScreenRecord(id, organization.id);
  if (!record) notFound();
  const versions = listVersions(id, organization.id);

  return (
    <div className="space-y-4">
      <Link href={`/o/${orgSlug}/admin/screens`} className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
        ← Back to Skills Screens
      </Link>
      <ScreenBuilder
        orgSlug={orgSlug}
        record={record}
        categoryLabels={SCREEN_CATEGORY_LABELS}
        canWrite={canWrite(user.role)}
        initialStep={step === "preview" ? "preview" : undefined}
        versionCount={versions.length}
      />
    </div>
  );
}
