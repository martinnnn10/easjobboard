"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({
  orgSlug,
  redirectTo,
  className,
  label = "Log out",
}: {
  orgSlug: string;
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo ?? `/o/${orgSlug}/admin/login`);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={className ?? "btn-secondary"}>
      {label}
    </button>
  );
}
