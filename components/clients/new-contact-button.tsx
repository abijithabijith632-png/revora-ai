"use client";

import { useState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { ContactForm } from "./contact-form";

export interface ContactClientOption {
  id: string;
  companyName: string;
}

/**
 * "New Contact" entry point for the Contacts page. Opens the existing
 * ContactForm in a modal; creation itself goes through POST /api/contacts.
 */
export function NewContactButton({ clients }: { clients: ContactClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  if (!clients.length) return null;

  return <>
    <Button size="sm" onClick={() => { setClientId(clients[0]?.id ?? ""); setOpen(true); }}>
      New Contact
    </Button>
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="New Contact"
      description="Add a person associated with one of your client accounts."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <FormField label="Client account" htmlFor="new-contact-client">
          <Select
            id="new-contact-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>
        </FormField>
        {clientId && (
          <ContactForm
            key={clientId}
            clientId={clientId}
            onDone={() => setOpen(false)}
          />
        )}
      </div>
    </Modal>
  </>;
}
