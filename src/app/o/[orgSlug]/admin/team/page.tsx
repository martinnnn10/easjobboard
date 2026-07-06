import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamManager } from "@/components/TeamManager";
import { requireOrgSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { listInvitesByOrg } from "@/lib/invites";
import { getOrganizationBySlug } from "@/lib/organizations";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function TeamPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const members = listUsersByOrganization(organization.id).map((u) => ({
    name: u.name,
    email: u.email,
    joinedAt: u.created_at,
  }));

  const invites = listInvitesByOrg(organization.id)
    .filter((inv) => inv.status === "pending" && new Date(inv.expiresAt).getTime() > Date.now())
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      invitedBy: inv.invitedBy,
      inviteUrl: `${getBaseUrl()}/join/${inv.token}`,
    }));

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Your team</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Everyone here shares {organization.name}&apos;s jobs, candidates, and pipeline. Invite the rest of your
          recruiting team.
        </p>
      </div>

      <TeamManager orgSlug={orgSlug} members={members} invites={invites} />
    </div>
  );
}
