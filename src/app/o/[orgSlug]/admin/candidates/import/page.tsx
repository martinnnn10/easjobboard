import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ orgSlug: string }> };

/** Import now lives on the add-candidate form; keep this path working. */
export default async function CandidateImportPage({ params }: PageProps) {
  const { orgSlug } = await params;
  redirect(`/o/${orgSlug}/admin/candidates/new`);
}
