import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/lib/auth";
import {
  getOrgIndeedFeedUrl,
  getOrgJobUrl,
  getOrgJsonFeedUrl,
  getOrgXmlFeedUrl,
} from "@/lib/env";
import { getOrganizationBySlug } from "@/lib/organizations";
import { SYNDICATION_BOARDS, TIER_LABELS, type SyndicationTier } from "@/lib/syndication";

type PageProps = { params: Promise<{ orgSlug: string }> };

const TIER_STYLES: Record<SyndicationTier, string> = {
  automatic: "bg-green-100 text-green-800",
  register: "bg-amber-100 text-amber-800",
  integration: "bg-zinc-100 text-zinc-600",
};

const FEEDS = [
  {
    label: "Indeed XML feed",
    get: getOrgIndeedFeedUrl,
    description: "Indeed's standard <source> format. Register in Indeed's XML feed program.",
  },
  {
    label: "Generic XML feed",
    get: getOrgXmlFeedUrl,
    description: "Same standard format under a neutral URL — submit to other aggregators.",
  },
  {
    label: "JSON feed",
    get: getOrgJsonFeedUrl,
    description: "Structured JSON for programmatic/custom integrations.",
  },
];

export default async function SyndicationPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const automaticCount = SYNDICATION_BOARDS.filter((b) => b.tier === "automatic").length;
  const registerCount = SYNDICATION_BOARDS.filter((b) => b.tier === "register").length;

  return (
    <div className="page-shell space-y-8">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Job distribution</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Your published jobs syndicate automatically to <span className="font-medium">{automaticCount}</span> channels,
          and the same feeds can be registered with <span className="font-medium">{registerCount}</span> more aggregators.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Your feeds</h2>
        <div className="grid gap-3">
          {FEEDS.map((feed) => {
            const url = feed.get(orgSlug);
            return (
              <div key={feed.label} className="card space-y-1">
                <p className="font-medium text-zinc-900">{feed.label}</p>
                <a href={url} target="_blank" rel="noreferrer" className="block break-all text-sm text-blue-600 hover:underline">
                  {url}
                </a>
                <p className="text-xs text-zinc-500">{feed.description}</p>
              </div>
            );
          })}
          <div className="card space-y-1">
            <p className="font-medium text-zinc-900">Google for Jobs</p>
            <p className="text-sm text-zinc-600">
              Structured data is embedded on every job page automatically — for example{" "}
              <a href={getOrgJobUrl(orgSlug, "[job-slug]")} className="text-blue-600 hover:underline">
                your job pages
              </a>
              . No feed to register; Google picks it up on crawl.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Board directory</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Board</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Consumes</th>
                <th className="px-4 py-3 font-medium">How to enable</th>
              </tr>
            </thead>
            <tbody>
              {SYNDICATION_BOARDS.map((board) => (
                <tr key={board.name} className="border-b border-zinc-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <a href={board.url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                      {board.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_STYLES[board.tier]}`}>
                      {TIER_LABELS[board.tier]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{board.feed}</td>
                  <td className="px-4 py-3 text-zinc-600">{board.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          &ldquo;Register feed once&rdquo; boards accept the standard XML format — submit the generic XML feed URL above to
          each board&apos;s partner program. &ldquo;Direct integration&rdquo; boards require their own API or paid slots.
        </p>
      </section>
    </div>
  );
}
