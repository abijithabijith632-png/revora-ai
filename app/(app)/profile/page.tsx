import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { ProfileForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your personal information."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Signed in as {session.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{ fullName: session.fullName, jobTitle: session.jobTitle }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
