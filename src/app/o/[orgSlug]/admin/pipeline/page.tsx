import Link from "next/link";
import { notFound } from "next/navigation";
import { PipelineBoard, type PipelineCard } from "@/components/PipelineBoard";
import { listApplicationsByOrganization } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication } from "@/lib/candidate-intel";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

// The board renders the most recent applications; older ones remain reachable
// through the paginated applicants list and the candidate pool.
const BOARD_LIMIT = 200;

export default async function PipelinePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  const applications = listApplicationsByOrganization(organization.id, {
    orderBy: "score",
    limit: BOARD_LIMIT,
  });

  const cards: PipelineCard[] = applications.map((application) => ({
    id: application.id,
    name: application.applicant_name,
    email: application.applicant_email,
    jobTitle: application.job_title,
    screenScore: application.screen_score,
    screenStatus: application.screen_status,
    badges: badgesForApplication(application),
    status: application.status,
    appliedAt: application.created_at,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900">Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Ranked by practical skills-screen score within each stage. Drag cards to move people forward.
          </p>
        </div>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="btn-secondary">
          Candidate pool
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="card text-zinc-600">
          No applications yet. Once candidates apply, they&apos;ll appear here as cards you can move through your
          hiring stages.
        </div>
      ) : (
        <PipelineBoard orgSlug={orgSlug} initialCards={cards} readOnly={!writable} />
      )}
    </div>
  );
}
