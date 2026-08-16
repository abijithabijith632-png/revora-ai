"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, Command } from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/operations";

interface SearchResult {
  entityType: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

interface SearchResponse {
  success: boolean;
  data: SearchResult[];
}

/** Authenticated app topbar with tenant-scoped global search and sign-out. */
export function Topbar({
  onMenuClick,
  user,
  unreadNotifications,
}: {
  onMenuClick: () => void;
  user: { name: string; email: string };
  unreadNotifications?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=10`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as SearchResponse;
        if (response.ok && body.success) {
          setResults(body.data);
          setHasSearched(true);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setHasSearched(true);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const body = (await response.json()) as { success?: boolean };
      if (response.ok && body.success) {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative hidden w-full max-w-md sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-surface-subtle py-2 pl-9 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus:border-border-strong"
          placeholder="Search leads, clients, opportunities…"
          aria-label="Search leads, clients, opportunities"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-faint">
          <Command className="h-3 w-3" aria-hidden="true" />K
        </span>
        {query.trim() && (
          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            {results.map((result) => (
              <button
                key={`${result.entityType}-${result.id}`}
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-surface-hover"
                onClick={() => {
                  setQuery("");
                  router.push(result.href);
                }}
              >
                <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[result.entityType, result.subtitle].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
            {hasSearched && results.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">No results found.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />
      <NotificationCenter initialCount={unreadNotifications ?? 0} />
      <ThemeToggle />
      <Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label="Sign out" onClick={handleLogout} loading={isSigningOut}>
        <Avatar name={user.name} status="online" size="sm" />
      </Button>
    </header>
  );
}
