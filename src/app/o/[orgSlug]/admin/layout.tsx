import { AdminShell, type NavItem } from "@/components/AdminShell";
import { getSession } from "@/lib/auth";
import { getPlatformName } from "@/lib/env";
import { getOrganizationBySlug, getOrgType } from "@/lib/organizations";
import { canManageTeam, isRole, ROLE_LABELS } from "@/lib/roles";
import { isSourcingConfigured } from "@/lib/sourcing";
import { getUserById } from "@/lib/users";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

/**
 * App shell for every authenticated admin page. The login page (also under
 * /admin) has no session, so we render it bare — the shell only wraps
 * signed-in pages. Page-level requireOrgSession() still enforces access; this
 * layout only decides chrome.
 */
export default async function AdminLayout({ children, params }: LayoutProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  const session = await getSession();
  const user = session ? getUserById(session.userId) : null;

  const authed = Boolean(organization && user && session && session.orgSlug === orgSlug);
  if (!authed || !organization || !user) {
    return <>{children}</>;
  }

  const base = `/o/${orgSlug}/admin`;
  // Workspace type only relabels existing surfaces — in-house teams think in
  // "Jobs / Applicants", agencies in "Job Orders / Candidates". Same routes,
  // buyer-appropriate words.
  const isAgency = getOrgType(organization) === "agency";
  // One clear home for each job-to-be-done. Applicants and sourced/passive
  // candidates now live as tabs inside Candidates (the CRM), so a recruiter
  // never has to guess which of four lists a person is in.
  const nav: NavItem[] = [
    { key: "dashboard", label: "Dashboard", href: base },
    { key: "queue", label: "Call Queue", href: `${base}/queue` },
    { key: "jobs", label: isAgency ? "Job Orders" : "Jobs", href: `${base}/jobs` },
    { key: "candidates", label: isAgency ? "Candidates" : "Applicants", href: `${base}/candidates` },
    { key: "pipeline", label: "Pipeline", href: `${base}/pipeline` },
    { key: "care", label: "Candidate Care", href: `${base}/care` },
  ];
  // Outbound sourcing/outreach only appears once a sourcing provider is
  // connected — buyers never see an unconfigured feature in the nav.
  if (isSourcingConfigured()) {
    nav.push({ key: "outreach", label: "Outreach", href: `${base}/outreach` });
  }
  nav.push({ key: "reports", label: "Reports", href: `${base}/reports` });
  if (canManageTeam(user.role)) {
    nav.push({ key: "team", label: "Team", href: `${base}/team` });
    nav.push({ key: "settings", label: "Settings", href: `${base}/settings` });
  }

  const roleLabel = isRole(user.role) ? ROLE_LABELS[user.role] : user.role;

  return (
    <AdminShell
      orgSlug={orgSlug}
      orgName={organization.name}
      platformName={getPlatformName()}
      userName={user.name}
      roleLabel={roleLabel}
      nav={nav}
      isDemo={organization.is_demo}
    >
      {children}
    </AdminShell>
  );
}
