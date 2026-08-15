"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableEmpty,
} from "@/components/ui";
import {
  CLIENT_STATUSES,
  clientStatusLabel,
  clientStatusVariant,
} from "@/lib/clients/presentation";

interface ClientRow {
  id: string;
  clientNumber: string;
  companyName: string;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  status: string;
  vipFlag: boolean;
  customerSince: string | null;
  accountManagerName: string | null;
  primaryContactName: string | null;
  createdAt: string;
}

interface ClientMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ClientTable({
  initialRows,
  initialMeta,
}: {
  initialRows: ClientRow[];
  initialMeta: ClientMeta;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/clients?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load clients");
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
  }, [page, meta.pageSize, search, status]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client ID, company, website, industry…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {clientStatusLabel(s)}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("export", "1");
                window.location.href = `/api/clients/export?format=csv&${params.toString()}`;
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push("/clients/new")}>
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Primary Contact</TableHead>
              <TableHead>Account Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/clients/${c.id}`} className="font-medium text-brand-600 hover:underline">
                    {c.clientNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${c.id}`} className="text-foreground hover:underline">
                    {c.companyName}
                  </Link>
                </TableCell>
                <TableCell>{c.industry ?? "—"}</TableCell>
                <TableCell>{c.primaryContactName ?? "—"}</TableCell>
                <TableCell>{c.accountManagerName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={clientStatusVariant(c.status)} dot>
                    {clientStatusLabel(c.status)}
                  </Badge>
                </TableCell>
                <TableCell>{c.customerSince ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No clients yet"
            description="Create your first client to start tracking accounts."
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
