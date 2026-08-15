import { redirect } from "next/navigation";

/**
 * Root route redirects to the dashboard (the authenticated entry point).
 * Authentication gating is added in a later phase.
 */
export default function Home() {
  redirect("/dashboard");
}
