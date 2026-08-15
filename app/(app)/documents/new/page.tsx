import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { DocumentForm } from "@/components/commercial";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="Add Document" description="Record a document in the repository." />
      <Card>
        <CardContent className="pt-6">
          <DocumentForm />
        </CardContent>
      </Card>
    </div>
  );
}
