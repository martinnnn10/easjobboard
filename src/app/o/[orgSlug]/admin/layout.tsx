import { AdminShell, type NavItem } from "@/components/AdminShell";
import { getSession } from "@/lib/auth";
import { getPlatformName } from "@/lib/env";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, isRole, ROLE_LABELS } from "@/lib/roles";
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
  // One clear home for each job-to-be-done. Applicants and sourced/passive
  // candidates now live as tabs inside Candidates (the CRM), so a recruiter
  // never has to guess which of four lists a person is in.
  const nav: NavItem[] = [
    { key: "dashboard", label: "Dashboard", href: base },
    { key: "queue", label: "Call Queue", href: `${base}/queue` },
    { key: "jobs", label: "Jobs", href: `${base}/jobs` },
    { key: "candidates", label: "Candidates", href: `${base}/candidates` },
    { key: "pipeline", label: "Pipeline", href: `${base}/pipeline` },
    { key: "care", label: "Candidate Care", href: `${base}/care` },
    { key: "outreach", label: "Outreach", href: `${base}/outreach` },
    { key: "reports", label: "Reports", href: `${base}/reports` },
  ];
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
    >
      {children}
    </AdminShell>
  );
}
