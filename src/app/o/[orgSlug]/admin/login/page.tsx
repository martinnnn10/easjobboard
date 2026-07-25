import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getVerifiedSession } from "@/lib/auth";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function OrgAdminLoginPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;

  // Already signed in for THIS org? Skip the form and go straight to the
  // dashboard. A session for a different org still sees the login form.
  const authed = await getVerifiedSession();
  if (authed && authed.organization.slug === orgSlug) redirect(`/o/${orgSlug}/admin`);

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm orgSlug={orgSlug} nextPath={query.next ?? `/o/${orgSlug}/admin`} />
    </div>
  );
}
