import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { ChangePasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Manage your password and account security."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Use a strong, unique password. 8+ characters with upper, lower,
            number, and special character.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
