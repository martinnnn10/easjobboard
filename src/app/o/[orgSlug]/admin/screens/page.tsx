import { notFound } from "next/navigation";
import { ScreenLibrary } from "@/components/ScreenLibrary";
import { requireOrgSession } from "@/lib/auth";
import { getJobAccess, canSeeJob } from "@/lib/job-visibility";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { jobsUsingByScreen, listScreens } from "@/lib/screen-store";
import { SCREEN_CATEGORY_LABELS, SCREEN_OPTIONS } from "@/lib/screens";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ orgSlug: string }> };

/** Categories a built-in starter maps to, so seeded screens land sensibly. */
const BUILTIN_CATEGORY: Record<string, string> = {
  maintenance_tech: "industrial_maintenance",
  industrial_electrician: "electrical_maintenance",
  controls_tech: "controls_plc",
  maintenance_leader: "maintenance_leadership",
};

export default async function ScreensPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();
  const { user } = await requireOrgSession(orgSlug);

  const screens = listScreens(organization.id);
  const usage = jobsUsingByScreen(organization.id);
  const screensWithUsage = screens.map((s) => ({ ...s, jobsUsing: usage[s.id] ?? 0 }));

  const access = getJobAccess(organization.id, user);
  const attachableJobs = listJobsByOrganization(organization.id)
    .filter((j) => j.status !== "closed" && canSeeJob(access, j.id))
    .map((j) => ({ id: j.id, title: j.title, status: j.status }));

  const starters = SCREEN_OPTIONS.map((o) => ({
    key: o.key,
    label: o.shortLabel,
    blurb: o.blurb,
    category: BUILTIN_CATEGORY[o.key] ?? "custom",
  }));

  return (
    <ScreenLibrary
      orgSlug={orgSlug}
      screens={screensWithUsage}
      starters={starters}
      attachableJobs={attachableJobs}
      categoryLabels={SCREEN_CATEGORY_LABELS}
      canWrite={canWrite(user.role)}
    />
  );
}
