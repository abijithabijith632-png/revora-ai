"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
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
  documentTypeLabel,
  documentStatusLabel,
} from "@/lib/commercial/presentation";

interface DocumentRow {
  id: string;
  name: string;
  documentType: string;
  clientName: string | null;
  opportunityName: string | null;
  version: number;
  status: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface DocumentMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function DocumentList({
  initialRows,
  initialMeta,
}: {
  initialRows: DocumentRow[];
  initialMeta: DocumentMeta;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [docType, setDocType] = useState(searchParams.get("documentType") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);
      if (docType) params.set("documentType", docType);

      const res = await fetch(`/api/documents?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load documents");
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
  }, [page, meta.pageSize, search, docType]);

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
              placeholder="Search documents…"
              className="pl-9"
            />
          </div>
          <Select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All types</option>
            {["proposal", "contract", "invoice", "presentation", "nda", "other"].map((t) => (
              <option key={t} value={t}>
                {documentTypeLabel(t)}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => router.push("/documents/new")}>
            <Plus className="h-4 w-4" />
            Add Document
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/documents/${d.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell>{documentTypeLabel(d.documentType)}</TableCell>
                <TableCell>{d.clientName ?? "—"}</TableCell>
                <TableCell>{d.opportunityName ?? "—"}</TableCell>
                <TableCell>v{d.version}</TableCell>
                <TableCell>
                  <Badge variant={d.status === "active" ? "success" : "neutral"}>
                    {documentStatusLabel(d.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No documents yet"
            description="Upload your first document to build the repository."
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
