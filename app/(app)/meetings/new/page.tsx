import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { MeetingForm } from "@/components/operations";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="New Meeting" description="Schedule a meeting." />
      <Card>
        <CardContent className="pt-6">
          <MeetingForm />
        </CardContent>
      </Card>
    </div>
  );
}
