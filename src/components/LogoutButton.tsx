"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/o/${orgSlug}/admin/login`);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className="btn-secondary">
      Log out
    </button>
  );
}
