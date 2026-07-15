import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/lib/auth";
import { getPublicBaseUrl, hasConfiguredPublicDomain } from "@/lib/env";
import { getOrganizationBySlug } from "@/lib/organizations";
import { SYNDICATION_BOARDS } from "@/lib/syndication";

type PageProps = { params: Promise<{ orgSlug: string }> };

const FEEDS = [
  {
    label: "Indeed feed",
    path: "/feed/indeed.xml",
    description: "Register this feed URL with Indeed's XML feed program. After that, Indeed pulls updates on its own schedule.",
  },
  {
    label: "Job boards feed",
    path: "/feed/jobs.xml",
    description: "The same link works for Jooble, Talent.com, Adzuna, and other boards — submit it once to each.",
  },
  {
    label: "Developer feed (JSON)",
    path: "/feed/jobs.json",
    description: "For custom integrations — your live jobs as structured data.",
  },
];

export default async function SyndicationPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const domainReady = hasConfiguredPublicDomain();
  const base = getPublicBaseUrl();
  const url = (path: string) => `${base}/o/${orgSlug}${path}`;

  const activeBoards = SYNDICATION_BOARDS.filter((b) => b.tier !== "integration");
  const manualBoards = SYNDICATION_BOARDS.filter((b) => b.tier === "integration");

  return (
    <div className="page-shell space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Job distribution</h1>
        <p className="mt-1 text-sm text-zinc-600">
          EAS Recruit makes published jobs eligible for Google Jobs by adding JobPosting structured data and including
          the job in the sitemap. Google must crawl and index the page before it can appear — placement is not
          guaranteed. The other boards below use your feed URLs: register each feed once, then each board pulls updates
          on its own schedule.
        </p>
      </div>

      {!domainReady ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Set your public domain first.</span> Feed and sharing URLs point at your
          public address. Configure it in{" "}
          <Link href={`/o/${orgSlug}/admin/settings`} className="font-medium underline">
            Settings
          </Link>{" "}
          (e.g. <code className="rounded bg-white/70 px-1">https://jobs.yourcompany.com</code>) so the links below are
          ready to submit to job boards.
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Your feeds</h2>
        <div className="grid gap-3">
          {FEEDS.map((feed) => (
            <div key={feed.label} className="card space-y-1">
              <p className="font-medium text-zinc-900">{feed.label}</p>
              {domainReady ? (
                <a
                  href={url(feed.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-sm text-brand-700 hover:underline"
                >
                  {url(feed.path)}
                </a>
              ) : (
                <p className="text-sm text-zinc-400">Set your public domain in Settings to generate this URL.</p>
              )}
              <p className="text-xs text-zinc-500">{feed.description}</p>
            </div>
          ))}
          <div className="card space-y-1">
            <p className="font-medium text-zinc-900">Google for Jobs</p>
            <p className="text-sm text-zinc-600">
              Structured data is embedded on every job page automatically. No feed to register — Google picks it up on
              crawl once your careers pages are publicly reachable over HTTPS.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Embed on your website</h2>
        <p className="text-sm text-zinc-600">
          Paste this snippet into your company site to show your live openings — it updates automatically as you post
          and close jobs.
        </p>
        {domainReady ? (
          <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 text-xs text-zinc-100">
            {`<div data-eas-jobs></div>\n<script src="${url("/embed.js")}" async></script>`}
          </pre>
        ) : (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
            The embed snippet appears here once your public domain is set in Settings.
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">Search &amp; social visibility</h2>
        <ul className="space-y-2 text-sm text-zinc-600">
          <li>
            <span className="font-medium text-zinc-900">Sitemap:</span>{" "}
            {domainReady ? (
              <a href={url("/sitemap.xml")} target="_blank" rel="noreferrer" className="break-all text-brand-700 hover:underline">
                {url("/sitemap.xml")}
              </a>
            ) : (
              <span className="text-zinc-400">available once your public domain is set</span>
            )}{" "}
            — submit to Google Search Console &amp; Bing Webmaster Tools so search engines can discover and crawl your
            jobs. Indexing and placement aren&apos;t guaranteed.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Social cards:</span> job and careers pages include Open Graph /
            Twitter tags, so links shared to LinkedIn, Slack, and X render a rich preview automatically.
          </li>
          <li>
            <span className="font-medium text-zinc-900">QR codes:</span> every published job has a scannable QR (from
            the Jobs list) for flyers, job fairs, and trade shows.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Boards reached by your feeds</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Board</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium">How to enable</th>
              </tr>
            </thead>
            <tbody>
              {activeBoards.map((board) => (
                <tr key={board.name} className="border-b border-zinc-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <a href={board.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                      {board.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        board.tier === "automatic" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {board.tier === "automatic" ? "Automatic" : "Register feed once"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{board.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {manualBoards.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Manual share required</h2>
          <p className="text-sm text-zinc-600">
            These boards don&apos;t accept an open job feed — they need their own paid program or API. Post to them
            directly.
          </p>
          <div className="flex flex-wrap gap-2">
            {manualBoards.map((board) => (
              <a
                key={board.name}
                href={board.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-300"
              >
                {board.name} ↗
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
