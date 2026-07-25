import Link from "next/link";
import { HeroShowcase } from "@/components/marketing/HeroShowcase";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { ProductPreviews } from "@/components/marketing/ProductPreviews";
import { getPlatformEmail } from "@/lib/env";

const ROLE_CATEGORIES = [
  "Maintenance Technicians",
  "Industrial Electricians",
  "Controls / PLC Technicians",
  "Automation Engineers",
  "Ammonia / Refrigeration",
  "Plant Leadership",
];

const PROBLEMS = [
  { t: "Resumes reward keywords", b: "A polished resume proves someone can describe the work — not that they can troubleshoot a live fault at 2am." },
  { t: "Weak interviews burn hours", b: "Every 45-minute interview with a can't-do-the-work candidate is time your recruiters and hiring managers never get back." },
  { t: "Manufacturing needs evidence", b: "Maintenance, controls, and electrical roles turn on practical judgment that a resume filter simply can't see." },
  { t: "Recruiters need proof", b: "Agencies get one shot with a client — a submission needs demonstrated ability behind it, not just a strong-looking CV." },
];

const STEPS = [
  { t: "Publish the role", b: "Post a manufacturing job to your EAS Recruit careers page in minutes, with the skills screen that fits the role." },
  { t: "Capture applicants", b: "Resume-required applications arrive from your careers page, flyer, or QR — plus candidates you import or source." },
  { t: "Run a practical screen", b: "Candidates answer real plant-floor scenarios. Every response is scored on demonstrated ability, not keywords." },
  { t: "Rank who to call first", b: "The Call Queue surfaces the strongest candidates by ability and risk signals — the right first phone calls." },
  { t: "Build the intelligence", b: "Candidate profiles and hiring-manager presentations assemble the evidence behind each call and submission." },
  { t: "Keep follow-up on track", b: "Candidate Care keeps interviews, check-ins, and follow-ups from slipping through the cracks." },
];

const DIFFERENTIATORS: { icon: string; t: string; b: string }[] = [
  { icon: "trap", t: "Resume Trap", b: "Spot candidates who look strong on paper but lack practical troubleshooting evidence — before you spend an interview." },
  { icon: "screen", t: "Practical skills screens", b: "Let candidates show how they think through real maintenance, electrical, controls, and safety situations." },
  { icon: "queue", t: "Ranked Call Queue", b: "Rank who deserves the first phone call based on demonstrated ability and risk signals — not resume keywords." },
  { icon: "intel", t: "Candidate intelligence", b: "Strengths, risks, and what to verify on the phone — assembled from the screen, not guessed." },
  { icon: "care", t: "Candidate Care", b: "Keep follow-ups, interviews, and check-ins from falling through the cracks after the first call." },
  { icon: "kit", t: "Hiring-manager presentations", b: "Hand a hiring manager or client a clean, evidence-backed case for why a candidate is worth their time." },
  { icon: "factory", t: "Built for manufacturing", b: "Screens and scoring shaped by real industrial hiring judgment — maintenance, controls, electrical, refrigeration, and operations." },
];

const FAQS = [
  {
    q: "Is this an ATS replacement?",
    a: "It can be used standalone, but it's strongest as a manufacturing hiring intelligence layer — the part that tells you who can actually do the job before you interview.",
  },
  {
    q: "How do jobs get distributed?",
    a: "Published jobs go live on your EAS Recruit careers page and become eligible for Google Jobs once Google crawls them (JobPosting structured data + sitemap). You also get feed URLs that are ready for job boards that accept an XML feed. LinkedIn and ZipRecruiter are a manual share — we don't promise a board integration we haven't built.",
  },
  {
    q: "Is this for agencies or employers?",
    a: "Both. Employers hire faster with fewer wasted interviews; manufacturing recruiting agencies rank candidates, document the evidence, and build client-ready submissions before they submit.",
  },
  {
    q: "How does the Resume Trap work?",
    a: "Every candidate's resume keyword match is scored against how they actually perform on a practical skills screen. When the resume looks strong but the demonstrated score is low, that gap is the Resume Trap — surfaced before you spend an interview.",
  },
  {
    q: "Do candidates need to complete a skills screen?",
    a: "That's the core signal, and it's short — a handful of real plant-floor scenarios that take a few minutes on a phone. You can review resume-only applicants too, but the screen is what powers the ranking.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — a 14-day free trial, no credit card required. You can explore a clearly-labelled demo workspace or start with your real jobs right away.",
  },
];

function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    trap: (
      <>
        <path d="M12 3v6" />
        <path d="M5 21a7 7 0 0 1 14 0" />
        <path d="M8 9h8l-1.5 4.5a3 3 0 0 1-5 0z" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 20h8M8 9l2 2-2 2M13 13h3" />
      </>
    ),
    queue: (
      <>
        <path d="M4 7h10M4 12h7M4 17h4" />
        <path d="M17.5 8.5 20 11l-2.5 2.5" />
      </>
    ),
    intel: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M11 12h1v4h1" />
      </>
    ),
    care: (
      <>
        <path d="M12 21s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9z" />
        <path d="M3.5 12h4l1.5-3 2.5 5 1.5-3h4.5" />
      </>
    ),
    kit: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    factory: (
      <>
        <path d="M3 21h18" />
        <path d="M4 21V10l5 3V10l5 3V7l6 4v10" />
        <path d="M8 21v-4M14 21v-4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

export default function HomePage() {
  const email = getPlatformEmail();

  return (
    <div className="pb-24">
      {/* 1 — Hero */}
      <section className="hero-dark">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="eyebrow text-brand-300">Manufacturing Hiring Intelligence</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
              Know who can actually do the job before you interview.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-300">
              EAS Recruit helps manufacturing teams and recruiting firms rank candidates by practical ability — not just
              resume keywords. Traditional tools rank resumes. We rank demonstrated ability.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-accent px-6 py-3 text-base">
                Start free trial
              </Link>
              <Link
                href="/book-demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Book a demo
              </Link>
            </div>
            <p className="mt-6 text-sm text-zinc-400">
              14-day free trial · no credit card required. Built for maintenance, controls, automation, skilled trades,
              and manufacturing recruiting teams.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroShowcase />
          </div>
        </div>
      </section>

      {/* 1b — Role strip (honest — capabilities, not customer logos) */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Purpose-built for the roles that keep plants running
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm font-medium text-zinc-500">
            {ROLE_CATEGORIES.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 2 — Problem */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">The problem</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            Resumes are noisy. Ability isn&apos;t.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Keyword matches don&apos;t prove troubleshooting ability — and in manufacturing, that gap is expensive. The
            candidates who read best on paper are often the ones who can&apos;t do the work.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((p) => (
            <div key={p.t} className="rounded-2xl border-l-4 border-l-red-300 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-zinc-900">{p.t}</h3>
              <p className="mt-2 text-sm text-zinc-600">{p.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — How it works (connected workflow) */}
      <section className="surface-steel border-y border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
              One connected workflow, from posting to the first call.
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Not a pile of disconnected features — a straight line from a published role to the candidate worth calling
              first.
            </p>
          </div>
          <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white ring-4 ring-brand-100">
                    {i + 1}
                  </span>
                  <span className="hidden h-px flex-1 bg-zinc-300 sm:block" />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">{s.t}</h3>
                <p className="mt-1.5 text-sm text-zinc-600">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 — Differentiators */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why EAS Recruit</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            A decision layer on top of your applicants.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Every capability points at one outcome: knowing who&apos;s actually worth your team&apos;s time.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.t} className="feature-card">
              <span className="icon-tile">
                <FeatureIcon name={d.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-zinc-900">{d.t}</h3>
              <p className="mt-1.5 text-sm text-zinc-600">{d.b}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-sm">
            <p className="text-lg font-bold leading-snug">Know who can actually do the job</p>
            <p className="mt-1 text-sm text-white/80">— before you spend an hour interviewing them.</p>
            <Link href="/signup" className="btn-accent mt-4 w-fit px-4 py-2 text-sm">
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* 5 — Audience split */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="surface-panel flex flex-col p-8">
            <p className="eyebrow">For manufacturing hiring teams</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              Hire the people who keep the line running.
            </h3>
            <p className="mt-3 flex-1 text-zinc-600">
              Find stronger maintenance, controls, engineering, and operations candidates without relying on resume
              keywords alone — and stop losing interview hours to great-on-paper applicants.
            </p>
            <Link href="/signup" className="btn-primary mt-6 w-fit">
              Start free trial
            </Link>
          </div>
          <div className="surface-panel flex flex-col p-8">
            <p className="eyebrow">For recruiting agencies</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              Submit candidates with evidence behind them.
            </h3>
            <p className="mt-3 flex-1 text-zinc-600">
              Rank candidates, document the demonstrated ability, and create client-ready submissions faster — so every
              candidate you send carries proof, not just a polished resume.
            </p>
            <Link href="/book-demo" className="btn-secondary mt-6 w-fit">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      {/* 6 — Product previews (real UI vocabulary) */}
      <section className="surface-steel border-y border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">See it in the product</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
              The working surfaces recruiters live in.
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Ranked call queues, candidate intelligence, skills-screen results, and claim-vs-proof — built from the real
              product, not stock screenshots.
            </p>
          </div>
          <div className="mt-12">
            <ProductPreviews />
          </div>
        </div>
      </section>

      {/* 7 — Comparison */}
      <section className="mx-auto w-full max-w-4xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why not a generic ATS?</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            EAS Recruit vs. a generic ATS or job board
          </h2>
        </div>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-700">Capability</th>
                <th className="px-4 py-3 text-center font-semibold text-brand-700">EAS Recruit</th>
                <th className="px-4 py-3 text-center font-semibold text-zinc-500">Generic ATS / job board</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Practical skills screening", true, false],
                ["Resume Trap detection", true, false],
                ["Ranked Call Queue", true, false],
                ["Manufacturing-specific scoring", true, false],
                ["Hiring-manager presentations", true, false],
                ["Candidate intelligence profile", true, false],
                ["Job posting & applicant tracking", true, true],
              ].map(([label, eas, ats]) => (
                <tr key={label as string} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-800">{label}</td>
                  <td className="px-4 py-3 text-center">
                    {eas ? <span className="font-bold text-brand-600">✓</span> : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ats ? <span className="font-semibold text-zinc-500">✓</span> : <span className="text-zinc-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8 — Proof / founder (honest) */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20">
        <div className="surface-panel p-8 md:p-12">
          <p className="eyebrow">Built from real manufacturing recruiting workflows</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            Made by operators who&apos;ve done this hiring themselves.
          </h2>
          <p className="mt-4 max-w-3xl text-zinc-600">
            EAS Recruit was built by manufacturing recruiting operators who were tired of interviewing candidates who
            looked great on paper and couldn&apos;t do the work. The skills screens, Resume Trap scoring, and Call Queue
            come straight from how skilled-trades hiring actually gets done on the plant floor — not a generic HR
            playbook.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/book-demo" className="btn-secondary">
              See a sample skills screen &amp; interview kit
            </Link>
            <a href={`mailto:${email}`} className="btn-secondary">
              Talk to the team
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Each organization&apos;s candidate data is private to that workspace. We don&apos;t publish customer names
            without permission — so you won&apos;t find invented testimonials or logos here.
          </p>
        </div>
      </section>

      {/* 9 — Pricing */}
      <section id="pricing" className="surface-steel border-y border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
              Simple, transparent pricing.
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Every plan starts with a 14-day free trial — no credit card required, cancel anytime.
            </p>
          </div>
          <div className="mt-12">
            <PricingTiers />
          </div>
        </div>
      </section>

      {/* 10 — Closing CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="hero-dark rounded-3xl px-8 py-16 text-center md:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
            Start ranking candidates by demonstrated ability.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
            Start your 14-day free trial and see your first ranked Call Queue this week.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-accent px-6 py-3 text-base">
              Start free trial
            </Link>
            <Link
              href="/book-demo"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      {/* 11 — FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4">
        <div className="text-center">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">Questions, answered</h2>
        </div>
        <dl className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="card">
              <dt className="font-semibold text-zinc-900">{f.q}</dt>
              <dd className="mt-2 text-sm text-zinc-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
