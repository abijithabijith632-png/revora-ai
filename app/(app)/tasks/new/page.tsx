import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { TaskForm } from "@/components/operations";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="New Task" description="Create an actionable task." />
      <Card>
        <CardContent className="pt-6">
          <TaskForm />
        </CardContent>
      </Card>
    </div>
  );
}
