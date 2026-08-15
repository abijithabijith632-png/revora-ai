import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata = { title: "Access restricted" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg text-danger">
        <ShieldX className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Access restricted</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You do not have permission to access this resource. Contact your
        administrator if you believe this is a mistake.
      </p>
      <Link href="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  );
}
