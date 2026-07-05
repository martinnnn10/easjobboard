import Link from "next/link";
import { getPlatformEmail, getPlatformName } from "@/lib/env";

const STEPS = [
  {
    n: "01",
    title: "Post the role with a skills screen",
    body: "Pick a maintenance, controls, electrical, or leadership screen. Every applicant answers real plant-floor scenarios when they apply.",
  },
  {
    n: "02",
    title: "See who can actually troubleshoot",
    body: "Answers are scored on practical ability — not resume keywords. Candidates are ranked by who can really do the work, with red flags surfaced.",
  },
  {
    n: "03",
    title: "Interview the right people",
    body: "Open the strong-fit list, get suggested interview questions per candidate, and skip the ones who only look good on paper.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-dark">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <div className="max-w-3xl">
            <p className="section-label text-blue-300">{getPlatformName()} · Manufacturing hiring intelligence</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Know who can actually
              <br />
              <span className="text-blue-400">troubleshoot before you interview.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              {getPlatformName()} screens maintenance, controls, and skilled-trades applicants on real plant-floor
              scenarios so manufacturers can find the people who can repair, troubleshoot, lead, and stay.
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
            ["Skills screens", "Maintenance, controls, electrical, leadership"],
            ["Practical scoring", "Ranked by ability, not keywords"],
            ["Risk flags", "Pay, commute, and job-hop signals"],
            ["Interview questions", "Tailored follow-ups per candidate"],
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
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Stop wasting interviews on candidates who only look good on paper.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">
            Built for manufacturing hiring: maintenance, controls, electrical, refrigeration, and plant leadership.
            Post your first screened role free — no credit card, no setup call.
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
