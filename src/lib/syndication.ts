/**
 * Directory of job boards this platform's feeds can reach.
 *
 * Tiers are honest about what happens automatically vs. what needs a one-time
 * registration vs. what this platform can't reach via a feed at all. `feed`
 * names which generated artifact a board consumes. Links point at stable board
 * homepages; registration specifics live in `note` because deep links rot.
 */

export type SyndicationTier = "automatic" | "register" | "integration";

export type SyndicationBoard = {
  name: string;
  tier: SyndicationTier;
  feed: "Indeed / generic XML" | "Google for Jobs JSON-LD" | "Generic XML" | "None (API)";
  url: string;
  note: string;
};

export const SYNDICATION_BOARDS: SyndicationBoard[] = [
  {
    name: "Indeed",
    tier: "register",
    feed: "Indeed / generic XML",
    url: "https://www.indeed.com",
    note: "Register your Indeed XML feed URL once in Indeed's employer/XML feed program; after that one-time setup Indeed pulls updates automatically. Not zero-setup — it requires the manual registration.",
  },
  {
    name: "Google for Jobs",
    tier: "automatic",
    feed: "Google for Jobs JSON-LD",
    url: "https://developers.google.com/search/docs/appearance/structured-data/job-posting",
    note: "No registration — each job page embeds valid JobPosting structured data, so listings appear in Google's job results once the site is publicly crawlable over HTTPS.",
  },
  {
    name: "Jooble",
    tier: "register",
    feed: "Generic XML",
    url: "https://jooble.org",
    note: "Accepts the standard XML feed via their publisher/partner program. Register the jobs.xml URL once.",
  },
  {
    name: "Talent.com (Neuvoo)",
    tier: "register",
    feed: "Generic XML",
    url: "https://www.talent.com",
    note: "Ingests standard XML job feeds through their partner onboarding. Register the jobs.xml URL.",
  },
  {
    name: "Adzuna",
    tier: "register",
    feed: "Generic XML",
    url: "https://www.adzuna.com",
    note: "Accepts an XML feed via their advertiser/partner team. Register the jobs.xml URL.",
  },
  {
    name: "Careerjet",
    tier: "register",
    feed: "Generic XML",
    url: "https://www.careerjet.com",
    note: "Aggregates from standard XML feeds. Submit the jobs.xml URL to their partner program.",
  },
  {
    name: "JobisJob",
    tier: "register",
    feed: "Generic XML",
    url: "https://www.jobisjob.com",
    note: "Accepts standard XML feeds via partner onboarding. Register the jobs.xml URL.",
  },
  {
    name: "LinkedIn Jobs",
    tier: "integration",
    feed: "None (API)",
    url: "https://www.linkedin.com/talent/post-a-job",
    note: "Not reachable via this feed. Requires LinkedIn's job wrapping/API or paid slots — a direct integration, not syndication.",
  },
  {
    name: "ZipRecruiter",
    tier: "integration",
    feed: "None (API)",
    url: "https://www.ziprecruiter.com",
    note: "Feed intake is via their (typically paid) partner program/API rather than an open feed submission.",
  },
];

export const TIER_LABELS: Record<SyndicationTier, string> = {
  automatic: "Automatic",
  register: "Register feed once",
  integration: "Direct integration needed",
};
