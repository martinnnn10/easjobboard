import Link from "next/link";
import { ClaimVsProof } from "@/components/ScreenSignals";
import { ProductPreviews } from "@/components/marketing/ProductPreviews";
import { getPlatformEmail } from "@/lib/env";

const demoMailto = (email: string) =>
  `mailto:${email}?subject=${encodeURIComponent("EAS Recruit — book a demo")}`;

const VALUE_PROPS = [
  {
    title: "Practical skills screening",
    body: "Applicants answer real maintenance, electrical, and controls scenarios — not keyword-stuffed resume fields. You see demonstrated ability, scored.",
  },
  {
    title: "Call Queue ranked by ability",
    body: "The strongest candidates surface first, with the recommended next action and one-tap call or email. No more scrolling a flat applicant list.",
  },
  {
    title: "Resume Trap detection",
    body: "Every candidate's resume keyword match is shown against their demonstrated score, so a great-on-paper / weak-in-practice applicant can't slip through.",
  },
  {
    title: "Candidate intelligence profile",
    body: "Strengths, risks, what to verify on the phone, and questions to ask the hiring manager — assembled from the screen, not guessed.",
  },
  {
    title: "Interview kits for hiring managers",
    body: "Hand a hiring manager or client a clean, redaction-ready summary of why this candidate is worth their time — generated in a click.",
  },
];

const CATEGORIES = [
  "Maintenance Technicians",
  "Industrial Electricians",
  "Controls / PLC Technicians",
  "Automation Engineers",
  "Maintenance Managers",
  "Ammonia / Refrigeration",
  "Food Manufacturing",
  "Packaging",
  "Plastics",
  "Plant Leadership",
];

const FAQS = [
  {
    q: "Is this an ATS replacement?",
    a: "It can be used standalone, but it's strongest as a manufacturing hiring intelligence layer — the part that tells you who can actually do the job before you interview.",
  },
  {
    q: "Does it work for agencies?",
    a: "Yes — especially for manufacturing recruiting agencies that need to prove candidate quality to their clients before submitting.",
  },
  {
    q: "Does it replace Indeed?",
    a: "No. Indeed and other boards bring you applicants; EAS Recruit helps you qualify, rank, and manage them after they apply or are sourced.",
  },
  {
    q: "What roles is it built for?",
    a: "Maintenance, controls, electrical, automation, refrigeration, and manufacturing leadership — skilled-trades roles where practical ability matters more than a resume.",
  },
  {
    q: "Do I need AI enabled?",
    a: "No. Skills screens and scoring work without semantic AI. When you configure AI, it improves scoring nuance and candidate summaries — but the core product runs without it.",
  },
];

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-zinc-700">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0z"
          clipRule="evenodd"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export default function HomePage() {
  const email = getPlatformEmail();

  return (
    <div className="space-y-24 pb-24">
      {/* 1 — Hero */}
      <section className="hero-dark">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
              Manufacturing Hiring Intelligence
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              Stop interviewing candidates who only look good on paper.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-300">
              EAS Recruit screens maintenance, electrical, controls, and manufacturing applicants for real-world
              ability — so recruiters know who to call first.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="btn-accent px-6 py-3 text-base">
                Start free trial
              </Link>
              <a
                href={demoMailto(email)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Book a demo
              </a>
            </div>
            <p className="mt-6 text-sm text-zinc-400">
              Built for maintenance, controls, automation, skilled trades, and manufacturing recruiting teams.
            </p>
          </div>
        </div>
      </section>

      {/* 2 — Resume Trap */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label text-red-600">The Resume Trap</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            The resume said 88. The skills screen said 9.
          </h2>
          <p className="mt-4 text-zinc-600">
            Generic ATS tools reward keyword-heavy resumes. Skilled-trades candidates often have weak resumes but real
            ability — and the polished resumes often can&apos;t do the work. EAS Recruit compares resume match against
            demonstrated skill, so you see who is actually worth calling.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card space-y-4 border-l-4 border-l-red-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900">Candidate A</p>
                <p className="text-xs text-zinc-500">Great on paper — can&apos;t do the work</p>
              </div>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Resume Trap
              </span>
            </div>
            <ClaimVsProof resumeMatch={88} screenScore={9} />
            <p className="text-sm text-zinc-600">
              Exactly who a keyword job board would have shortlisted first — and who would have cost you an interview.
            </p>
          </div>

          <div className="card space-y-4 border-l-4 border-l-brand-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900">Candidate B</p>
                <p className="text-xs text-zinc-500">Weaker resume — strong demonstrated ability</p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                Call first
              </span>
            </div>
            <ClaimVsProof resumeMatch={41} screenScore={86} />
            <p className="text-sm text-zinc-600">
              The candidate a resume filter buries — and the one your plant floor actually needs. EAS Recruit puts them
              at the top of the queue.
            </p>
          </div>
        </div>
      </section>

      {/* 3 — Product previews */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">See it in the product</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            The decision layer on top of your applicants
          </h2>
          <p className="mt-4 text-zinc-600">
            Ranked call queues, candidate intelligence, and interview kits — the working surfaces recruiters live in
            every day.
          </p>
        </div>
        <div className="mt-10">
          <ProductPreviews />
        </div>
      </section>

      {/* 4 — How it works */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Three steps to your first call</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { n: "1", t: "Post or import a role", b: "Create a manufacturing job from a template or import one, and attach the skills screen that fits the role." },
            { n: "2", t: "Candidates complete a practical screen", b: "Applicants answer real plant-floor scenarios. Every response is scored on demonstrated ability." },
            { n: "3", t: "Call the strongest first", b: "Your Call Queue ranks candidates by ability with the recommended next action — so you spend time on the right people." },
          ].map((s) => (
            <div key={s.n} className="card space-y-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {s.n}
              </span>
              <h3 className="font-semibold text-zinc-900">{s.t}</h3>
              <p className="text-sm text-zinc-600">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 — Value props */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Why EAS Recruit</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            Not another ATS. A hiring intelligence layer.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <div key={v.title} className="card space-y-2">
              <h3 className="font-semibold text-zinc-900">{v.title}</h3>
              <p className="text-sm text-zinc-600">{v.body}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-2xl border border-brand-200 bg-brand-50 p-6">
            <p className="text-lg font-bold text-brand-800">Know who can actually do the job</p>
            <p className="mt-1 text-sm text-brand-800/80">— before you spend an hour interviewing them.</p>
          </div>
        </div>
      </section>

      {/* 6 — Built for manufacturing */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Built for manufacturing hiring</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            Purpose-built for the roles that keep plants running
          </h2>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* 7 — ROI */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
            <div className="space-y-4">
              <p className="section-label text-brand-700">The ROI</p>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Every bad interview costs your team time.</h2>
              <p className="text-zinc-600">
                If your team spends 30–60 minutes interviewing weak-fit candidates, every bad interview is time your
                recruiters and hiring managers don&apos;t get back. EAS Recruit helps you screen them out before the
                interview — so the meetings you take are with people who can do the job.
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-2xl bg-brand-50 p-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Interview-hours saved</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">Fewer wasted hours</p>
              <p className="mt-2 text-sm text-zinc-600">
                The product tracks how many weak or high-risk candidates the screen filtered before anyone wasted an
                interview — real numbers from your activity, never estimated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8 — Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Simple, per-seat pricing</h2>
          <p className="mt-4 text-zinc-600">Start with a 14-day free trial. No long-term contract.</p>
        </div>
        <div className="mx-auto mt-10 max-w-lg">
          <div className="card space-y-6 border-2 border-brand-500">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">EAS Recruit</p>
              <p className="mt-2">
                <span className="text-5xl font-bold tracking-tight text-zinc-900">$99</span>
                <span className="text-lg font-medium text-zinc-500">/month per seat</span>
              </p>
              <p className="mt-2 text-sm text-zinc-600">14-day free trial · no credit card required to start</p>
            </div>
            <ul className="space-y-2.5">
              <CheckRow>Practical skills screening on every applicant</CheckRow>
              <CheckRow>Call Queue ranked by demonstrated ability</CheckRow>
              <CheckRow>Resume Trap detection &amp; candidate intelligence</CheckRow>
              <CheckRow>Interview kits &amp; client presentations</CheckRow>
              <CheckRow>Branded careers page &amp; job board syndication</CheckRow>
              <CheckRow>No long-term contract — cancel anytime</CheckRow>
            </ul>
            <Link href="/signup" className="btn-primary w-full py-3 text-base">
              Start your 14-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* 9 — Trial band */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="hero-dark rounded-3xl px-8 py-14 text-center md:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white">
            Know who can actually do the job — before you interview.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300">
            Start your 14-day free trial and see your first ranked Call Queue this week.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-accent px-6 py-3 text-base">
              Start your 14-day free trial
            </Link>
            <a
              href={demoMailto(email)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>

      {/* 10 — FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4">
        <div className="text-center">
          <p className="section-label">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Questions, answered</h2>
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
