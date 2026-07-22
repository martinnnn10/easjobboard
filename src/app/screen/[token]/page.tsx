import type { Metadata } from "next";
import { PublicScreenForm } from "@/components/PublicScreenForm";
import { getJobById } from "@/lib/jobs";
import { getOrganizationById } from "@/lib/organizations";
import { getInviteByToken, markInviteStarted } from "@/lib/screen-invites";
import { estimateMinutes, resolveScreen } from "@/lib/screen-store";
import { toPublicScreen } from "@/lib/screens";

export const runtime = "nodejs";

// Never index a candidate's private screening link.
export const metadata: Metadata = {
  title: "Skills screen",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</div>;
}

function MessageCard({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{body}</p>
      </div>
    </Shell>
  );
}

export default async function ScreenTokenPage({ params }: PageProps) {
  const { token } = await params;
  const invite = getInviteByToken(token);

  if (!invite) {
    return (
      <MessageCard
        title="Link not found"
        body="This screening link is invalid or has been removed. If you think this is a mistake, reply to the email you received."
      />
    );
  }

  if (invite.status === "expired") {
    return (
      <MessageCard
        title="This link has expired"
        body="This screening link is no longer active. Reply to the email you received and the hiring team can send you a fresh one."
      />
    );
  }

  if (invite.status === "completed") {
    return (
      <MessageCard
        title="Already completed"
        body="You've already finished this skills screen — thank you. There's nothing more to do here. If you're a fit, the hiring team will be in touch."
      />
    );
  }

  const template = resolveScreen(invite.screen_key);
  if (!template) {
    return (
      <MessageCard
        title="Screen unavailable"
        body="We couldn't load this screen right now. Please reply to the email you received so the hiring team can help."
      />
    );
  }

  // Record the first open for the recruiter's funnel (idempotent; never changes
  // status, never touches a completed invite).
  markInviteStarted(invite.token);

  const organization = getOrganizationById(invite.organization_id);
  const job = invite.job_id ? getJobById(invite.job_id) : null;
  const orgName = organization?.name ?? "the hiring team";
  const jobTitle = job?.title ?? "";
  const publicScreen = toPublicScreen(template);
  const minutes = estimateMinutes(template.questions);

  return (
    <Shell>
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            {orgName}
            {jobTitle ? ` · ${jobTitle}` : ""}
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Show what you can actually do</h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            This short screen helps you show what you can actually do, even if your resume does not tell the full story.
            It should only take a few minutes, and there are no trick questions — answer the way you&apos;d handle it on
            the floor.
          </p>
          <p className="text-xs font-medium text-zinc-500">
            About {minutes} minute{minutes === 1 ? "" : "s"} · {publicScreen.questions.length} question
            {publicScreen.questions.length === 1 ? "" : "s"}
          </p>
          {invite.message ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {invite.message}
            </p>
          ) : null}
        </header>

        <PublicScreenForm token={invite.token} screen={publicScreen} orgName={orgName} jobTitle={jobTitle} />
      </div>
    </Shell>
  );
}
