"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { ConvertLeadDialog } from "./convert-lead-dialog";

/**
 * Client-side trigger for the conversion review dialog. Only rendered for
 * qualified leads by the server page; the dialog re-validates server-side.
 */
export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ArrowRightLeft className="h-4 w-4" />
        Convert to Client
      </Button>
      {open && <ConvertLeadDialog leadId={leadId} onClose={() => setOpen(false)} />}
    </>
  );
}
