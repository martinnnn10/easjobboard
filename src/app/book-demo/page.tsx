import type { Metadata } from "next";
import { BookDemoForm } from "@/components/marketing/BookDemoForm";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "See how EAS Recruit exposes the Resume Trap and ranks who to call first for manufacturing hiring.",
};

export default function BookDemoPage() {
  return (
    <div className="page-shell max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <p className="section-label text-brand-700">Book a demo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">See EAS Recruit on your roles</h1>
        <p className="mx-auto mt-3 max-w-lg text-zinc-600">
          A short walkthrough of the Resume Trap, skills screens, and the ranked Call Queue — using the kinds of
          manufacturing roles you actually hire for. Tell us a bit about your hiring and we&apos;ll reach out.
        </p>
      </div>
      <BookDemoForm />
    </div>
  );
}
