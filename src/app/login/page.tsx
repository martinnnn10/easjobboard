import { LoginForm } from "@/components/LoginForm";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm nextPath={params.next} />
    </div>
  );
}
