import { redirect } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { getVerifiedSession } from "@/lib/auth";

export default async function SignupPage() {
  // Already signed in? Send them to their dashboard instead of the signup form.
  const authed = await getVerifiedSession();
  if (authed) redirect(`/o/${authed.organization.slug}/admin`);

  return (
    <div className="page-shell py-10">
      <SignupForm />
    </div>
  );
}
