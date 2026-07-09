import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallQueueCount } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string }> };

function StepCard({
  n,
  title,
  body,
  done,
  cta,
  href,
}: {
  n: number;
  title: string;
  body: string;
  done: boolean;
  cta: string;
  href: string;
}) {
  return (
    <div className={`card flex flex-wrap items-center gap-4 ${done ? "border-brand-200 bg-brand-50/40" : ""}`}>
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
          done ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-500"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-[12rem] flex-1">
        <p className="font-semibold text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-600">{body}</p>
      </div>
      <Link href={href} className={done ? "btn-secondary text-sm" : "btn-primary text-sm"}>
        {done ? "Review" : cta}
      </Link>
    </div>
  );
}

export default async function OnboardingPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const base = `/o/${orgSlug}/admin`;

  const jobs = listJobsByOrganization(organization.id);
  const hasJob = jobs.length > 0;
  const hasScreen = jobs.some((j) => Boolean(j.screen_key));
  const queueCount = getCallQueueCount(organization.id);
  const teamCount = listUsersByOrganization(organization.id).length;
  const isOwner = canManageTeam(user.role);

  const steps = [
    {
      n: 1,
      title: "Create or import a job",
      body: "Post a manufacturing role from a template — maintenance, controls, electrical, and more.",
      done: hasJob,
      cta: "Create a job",
      href: `${base}/jobs/new`,
    },
    {
      n: 2,
      title: "Attach a skills screen",
      body: "Pick the practical screen that matches the role so applicants are scored on real ability.",
      done: hasScreen,
      cta: hasJob ? "Add a screen" : "Create a job first",
      href: hasJob ? `${base}/jobs` : `${base}/jobs/new`,
    },
    {
      n: 3,
      title: "Review your Call Queue",
      body: "Once candidates complete a screen, the strongest ones rank here — ready to call.",
      done: queueCount > 0,
      cta: "Open Call Queue",
      href: `${base}/queue`,
    },
    {
      n: 4,
      title: "Invite your team",
      body: "Add recruiters so calls, notes, and follow-ups are shared across your workspace.",
      done: teamCount > 1,
      cta: isOwner ? "Invite teammates" : "View team",
      href: `${base}/team`,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <div>
        <p className="section-label text-brand-700">Welcome to EAS Recruit</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
          Let&apos;s get {organization.name} to its first ranked call
        </h1>
        <p className="mt-2 text-zinc-600">
          Four quick steps. You can do these in any order — we&apos;ll check them off as you go.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold text-zinc-700">
          {completed} / {steps.length}
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((s) => (
          <StepCard key={s.n} {...s} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
        <p className="text-sm text-zinc-500">
          You&apos;re on a 14-day free trial. Manage your plan anytime in{" "}
          <Link href={`${base}/settings`} className="text-brand-700 hover:underline">
            Settings → Billing
          </Link>
          .
        </p>
        <Link href={base} className="btn-secondary text-sm">
          Skip to dashboard →
        </Link>
      </div>
    </div>
  );
}
