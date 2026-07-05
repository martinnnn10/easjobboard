import { LoginForm } from "@/components/LoginForm";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function OrgAdminLoginPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm orgSlug={orgSlug} nextPath={query.next ?? `/o/${orgSlug}/admin`} />
    </div>
  );
}
