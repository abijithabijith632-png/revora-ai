import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Avatar } from "@/components/ui";
import { ProfileForm, ChangePasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function ProfilePage() {
  const session = await requireSession();
  const [row] = await db
    .select({
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      department: users.department,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      location: users.location,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.organizationId, session.organizationId)))
    .limit(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your personal information and account security."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
              <CardDescription>
                Signed in as {session.email}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                initial={{
                  userId: session.userId,
                  organizationId: session.organizationId,
                  fullName: row?.fullName ?? session.fullName,
                  jobTitle: row?.jobTitle ?? session.jobTitle,
                  department: row?.department ?? null,
                  avatarUrl: row?.avatarUrl ?? null,
                  phone: row?.phone ?? null,
                  location: row?.location ?? null,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Update the password used to sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your CRM identity and status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar
                  name={row?.fullName ?? session.fullName}
                  src={row?.avatarUrl?.startsWith("private-blob:") ? "/api/auth/profile/photo" : row?.avatarUrl ?? undefined}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {row?.fullName ?? session.fullName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {session.email}
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium text-foreground">
                    {session.roleNames.length ? session.roleNames.join(", ") : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={row?.status === "active" ? "success" : "neutral"} dot>
                      {row?.status ?? "—"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-foreground">{row?.phone ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium text-foreground">
                    {row?.department ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="font-medium text-foreground">{row?.location ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Date joined</dt>
                  <dd className="font-medium text-foreground" suppressHydrationWarning>
                    {formatDateTime(row?.createdAt ?? null)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Last login</dt>
                  <dd className="font-medium text-foreground" suppressHydrationWarning>
                    {formatDateTime(row?.lastLoginAt ?? null)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
