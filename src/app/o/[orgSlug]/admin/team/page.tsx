import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamManager } from "@/components/TeamManager";
import { requireOrgSession } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, ROLE_LABELS, isRole } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function TeamPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user, session } = await requireOrgSession(orgSlug);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Team &amp; access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Owners manage jobs, applicants, and the team. Recruiters manage jobs and applicants and can download resumes.
          Viewers are read-only and cannot download resumes.
        </p>
      </div>

      {!canManageTeam(user.role) ? (
        <div className="card">
          <p className="font-medium text-zinc-900">Owners only</p>
          <p className="mt-1 text-sm text-zinc-600">
            Your role is <span className="font-medium">{isRole(user.role) ? ROLE_LABELS[user.role] : user.role}</span>.
            Ask an owner to manage the team.
          </p>
        </div>
      ) : (
        <TeamManager
          orgSlug={orgSlug}
          members={listUsersByOrganization(organization.id).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            isSelf: u.id === session.userId,
          }))}
        />
      )}
    </div>
  );
}
