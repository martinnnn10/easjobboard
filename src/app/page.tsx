import Link from "next/link";
import { getPlatformEmail, getPlatformName } from "@/lib/env";

const STEPS = [
  {
    n: "01",
    title: "Post in under a minute",
    body: "Start from a role template, let AI write the posting, and publish. No forms to wrestle with.",
  },
  {
    n: "02",
    title: "Reach every channel",
    body: "Your branded careers page, Indeed, Google for Jobs, an embeddable widget, and printable QR flyers — all at once.",
  },
  {
    n: "03",
    title: "Hire from one board",
    body: "Resumes are parsed and scored on arrival. Drag candidates through your pipeline and email them without leaving the app.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-dark">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <div className="max-w-3xl">
            <p className="section-label text-blue-300">{getPlatformName()}</p>
            <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl">
              Post once.
              <br />
              <span className="text-blue-400">Hire everywhere.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              The recruiting platform built for the trades. Publish a job in under a minute — it goes live on your
              branded careers page, syndicates to job boards, and every applicant lands scored and ready to review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-accent px-6 py-3 text-base">
                Start free →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="card card-hover space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-700 font-mono text-sm font-bold text-white">
                {step.n}
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">{step.title}</h2>
              <p className="text-sm leading-relaxed text-zinc-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capability strip */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px px-4 py-12 sm:grid-cols-4">
          {[
            ["Resume scoring", "Every applicant ranked on arrival"],
            ["Kanban pipeline", "Drag candidates through stages"],
            ["QR job flyers", "Print-ready for the shop floor"],
            ["Outbound sourcing", "Find passive candidates too"],
          ].map(([title, sub]) => (
            <div key={title} className="px-2">
              <p className="font-semibold text-zinc-900">{title}</p>
              <p className="mt-1 text-sm text-zinc-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="rounded-3xl bg-blue-700 px-8 py-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Your next hire is one post away.</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">
            Spin up a branded careers portal and post your first job free — no credit card, no setup call.
          </p>
          <div className="mt-8">
            <Link href="/signup" className="btn-accent px-6 py-3 text-base">
              Create your organization →
            </Link>
          </div>
          <p className="mt-6 text-sm text-blue-200">
            Questions? {" "}
            <a href={`mailto:${getPlatformEmail()}`} className="font-medium text-white underline">
              {getPlatformEmail()}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
