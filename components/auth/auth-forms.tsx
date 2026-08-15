"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, FormField } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/**
 * Authentication form components (Phase 4) — reuse the Phase 2 design system
 * and toast feedback. Each form posts to its /api/auth/* endpoint and
 * redirects on success.
 */

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    success: boolean;
    data?: unknown;
    message?: string;
    error?: { code?: string; message?: string; details?: unknown };
  }>;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  name,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  name: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition-colors hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Button type="submit" loading={loading} className="w-full">
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------
 * Login
 * ------------------------------------------------------------ */
export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/login", { email, password });
    setLoading(false);
    if (result.success) {
      toast({ variant: "success", title: "Signed in." });
      router.push("/dashboard");
      router.refresh();
    } else {
      toast({
        variant: "error",
        title: result.error?.message ?? "Unable to sign in.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </FormField>
      <FormField label="Password" required>
        <PasswordInput
          name="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </FormField>
      <div className="flex items-center justify-between">
        <Link
          href="/forgot-password"
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton loading={loading}>Sign in</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        New to Revora AI?{" "}
        <Link href="/register" className="text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------
 * Register
 * ------------------------------------------------------------ */
export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/register", form);
    setLoading(false);
    if (result.success) {
      toast({
        variant: "success",
        title: "Account created. You can sign in.",
      });
      router.push("/login");
    } else {
      toast({
        variant: "error",
        title: result.error?.message ?? "Registration failed.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Full name" required>
        <Input
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          placeholder="Jane Doe"
          autoComplete="name"
        />
      </FormField>
      <FormField label="Organization name" required>
        <Input
          value={form.organizationName}
          onChange={(e) => set("organizationName", e.target.value)}
          placeholder="Acme Inc."
        />
      </FormField>
      <FormField label="Email" required>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </FormField>
      <FormField label="Password" required hint="8+ chars, upper, lower, number, special.">
        <PasswordInput
          name="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <FormField label="Confirm password" required>
        <PasswordInput
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={(v) => set("confirmPassword", v)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <SubmitButton loading={loading}>Create account</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------
 * Forgot password
 * ------------------------------------------------------------ */
export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/forgot-password", { email });
    setLoading(false);
    // Uniform messaging.
    if (result.success) setSent(true);
    toast({
      variant: "info",
      title: "If the account exists, a reset email was sent.",
    });
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists for <span className="font-medium">{email}</span>,
        you will receive a password reset link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </FormField>
      <SubmitButton loading={loading}>Send reset link</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------
 * Reset password
 * ------------------------------------------------------------ */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/reset-password", {
      token,
      password,
      confirmPassword,
    });
    setLoading(false);
    if (result.success) {
      toast({ variant: "success", title: "Password reset. Sign in." });
      router.push("/login");
    } else {
      toast({
        variant: "error",
        title: result.error?.message ?? "Unable to reset password.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="New password" required>
        <PasswordInput
          name="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <FormField label="Confirm password" required>
        <PasswordInput
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <SubmitButton loading={loading}>Reset password</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------
 * Change password (authenticated)
 * ------------------------------------------------------------ */
export function ChangePasswordForm() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/change-password", form);
    setLoading(false);
    if (result.success) {
      toast({ variant: "success", title: "Password changed." });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast({
        variant: "error",
        title: result.error?.message ?? "Unable to change password.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Current password" required>
        <PasswordInput
          name="currentPassword"
          value={form.currentPassword}
          onChange={(v) => set("currentPassword", v)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </FormField>
      <FormField label="New password" required>
        <PasswordInput
          name="newPassword"
          value={form.newPassword}
          onChange={(v) => set("newPassword", v)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <FormField label="Confirm new password" required>
        <PasswordInput
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={(v) => set("confirmPassword", v)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>
      <SubmitButton loading={loading}>Update password</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------
 * Profile form (authenticated)
 * ------------------------------------------------------------ */
export function ProfileForm({
  initial,
}: {
  initial: { fullName: string; jobTitle: string | null };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(initial.fullName);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, jobTitle: jobTitle || null }),
    });
    const result = await res.json();
    setLoading(false);
    if (result.success) {
      toast({ variant: "success", title: "Profile updated." });
      router.refresh();
    } else {
      toast({
        variant: "error",
        title: result.error?.message ?? "Unable to update profile.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Full name" required>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </FormField>
      <FormField label="Job title">
        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      </FormField>
      <SubmitButton loading={loading}>Save changes</SubmitButton>
    </form>
  );
}
