import {
  LayoutDashboard,
  Users,
  Building2,
  Contact,
  Target,
  GitBranch,
  Activity,
  ListTodo,
  CalendarDays,
  Sparkles,
  BarChart3,
  FileText,
  Bell,
  Settings,
  UserCircle,
  ShieldCheck,
  UserCog,
  UserRoundCog,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

/**
 * Primary navigation model. Each item declares a required permission; the
 * sidebar filters items by the authenticated user's permissions.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: Users, permission: "leads.view" },
      { label: "Assignments", href: "/leads/assignments", icon: UserRoundCog, permission: "leads.assign" },
      { label: "Clients", href: "/clients", icon: Building2, permission: "clients.view" },
      { label: "Contacts", href: "/contacts", icon: Contact, permission: "contacts.view" },
      { label: "Opportunities", href: "/opportunities", icon: Target, permission: "opportunities.view" },
      { label: "Pipeline", href: "/pipeline", icon: GitBranch, permission: "pipeline.view" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Activities", href: "/activities", icon: Activity, permission: "activities.view" },
      { label: "Tasks", href: "/tasks", icon: ListTodo, permission: "tasks.view" },
      { label: "Meetings", href: "/meetings", icon: CalendarDays, permission: "meetings.view" },
      { label: "Proposals", href: "/proposals", icon: FileText, permission: "proposals.view" },
      { label: "Documents", href: "/documents", icon: FileText, permission: "documents.view" },
      { label: "Email Templates", href: "/email-templates", icon: FileText, permission: "proposals.view" },
      { label: "Notifications", href: "/notifications", icon: Bell, permission: "notifications.view" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Assistant", href: "/ai-assistant", icon: Sparkles, permission: "ai_insights.view" },
      { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/settings/users", icon: UserCog, permission: "users.view" },
      { label: "Roles", href: "/settings/roles", icon: ShieldCheck, permission: "roles.view" },
      { label: "Lead Statuses", href: "/settings/lead-statuses", icon: Settings, permission: "lead_statuses.view" },
      { label: "Lead Sources", href: "/settings/lead-sources", icon: Settings, permission: "lead_sources.view" },
      { label: "Pipeline", href: "/settings/pipeline", icon: GitBranch, permission: "pipeline.view" },
      { label: "Billing", href: "/settings/billing", icon: BarChart3, permission: "billing.view" },
      { label: "Audit Logs", href: "/settings/audit", icon: ShieldCheck, permission: "audit_logs.view" },
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile", href: "/profile", icon: UserCircle, permission: "dashboard.view" }],
  },
];
