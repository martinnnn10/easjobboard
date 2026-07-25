import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getVerifiedSession } from "@/lib/auth";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Already signed in? Don't show the login form — send them to their dashboard
  // (honouring an internal `next` deep-link, but never an off-site redirect).
  const authed = await getVerifiedSession();
  if (authed) {
    const safeNext =
      params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : null;
    redirect(safeNext ?? `/o/${authed.organization.slug}/admin`);
  }

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm nextPath={params.next} />
    </div>
  );
}
