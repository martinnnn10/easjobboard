import Link from "next/link";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";
import { getInviteByToken } from "@/lib/invites";
import { getOrganizationById } from "@/lib/organizations";
import { getUserByEmail } from "@/lib/users";

type PageProps = { params: Promise<{ token: string }> };

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params;
  const invite = getInviteByToken(token);

  const invalid =
    !invite ||
    invite.status !== "pending" ||
    new Date(invite.expiresAt).getTime() < Date.now() ||
    Boolean(getUserByEmail(invite.email));

  const organization = invite ? getOrganizationById(invite.organizationId) : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      {invalid || !organization ? (
        <div className="card space-y-3 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">This invitation isn&apos;t valid</h1>
          <p className="text-sm text-zinc-600">
            It may have expired, been revoked, or already been used. Ask your admin to send a new one.
          </p>
          <Link href="/login" className="btn-secondary inline-block">
            Go to sign in
          </Link>
        </div>
      ) : (
        <AcceptInviteForm token={token} email={invite!.email} orgName={organization.name} />
      )}
    </div>
  );
}
