"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Star, Search } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableEmpty,
} from "@/components/ui";
import { preferredChannelLabel } from "@/lib/clients/presentation";

interface ContactRow {
  id: string;
  clientId: string;
  clientName: string;
  firstName: string;
  lastName: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  preferredChannel: string | null;
  isPrimary: boolean;
  createdAt: string;
}

interface ContactMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Client-side contacts table — fetches real PostgreSQL-backed rows from
 * `/api/contacts` (tenant-scoped + RBAC-gated server-side), with search and
 * pagination. Mirrors the established ClientTable/OpportunityTable pattern.
 */
export function ContactTable({
  initialRows,
  initialMeta,
}: {
  initialRows: ContactRow[];
  initialMeta: ContactMeta;
}) {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load contacts");
      setRows(json.data);
      setMeta({
        page: json.meta?.page ?? 1,
        pageSize: json.meta?.pageSize ?? 20,
        total: json.meta?.total ?? 0,
        totalPages: json.meta?.totalPages ?? 1,
      });
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [page, meta.pageSize, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, designation, client…"
            className="pl-9"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead>Primary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">
                  {c.firstName} {c.lastName ?? ""}
                </TableCell>
                <TableCell>{c.clientName}</TableCell>
                <TableCell>{c.designation ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>
                  {c.preferredChannel ? preferredChannelLabel(c.preferredChannel) : "—"}
                </TableCell>
                <TableCell>
                  {c.isPrimary ? (
                    <Badge variant="success">
                      <Star className="h-3 w-3" /> Primary
                    </Badge>
                  ) : (
                    <Badge variant="neutral">—</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No contacts found"
            description="Contacts will appear here once they are added to a client."
          />
        )}

        <TablePagination
          page={meta.page}
          pageCount={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
