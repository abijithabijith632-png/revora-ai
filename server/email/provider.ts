import { serverEnv } from "@/config/env";

/**
 * Email provider abstraction (Phase 14).
 *
 * The CRM data model supports two-way synchronization (messageId, threadId,
 * direction, recipients, attachments, open/click tracking). This interface
 * defines the seam for a real provider (Gmail / Outlook / SMTP).
 *
 * Honesty rule: without configured credentials, `isConfigured()` returns false
 * and NO live synchronization or tracking is claimed. Email *records* can
 * still be stored manually; only outbound delivery is gated.
 */

export interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; contentType: string; content: string }>;
}

export interface EmailProvider {
  isConfigured(): boolean;
  send(input: SendEmailInput): Promise<{ messageId: string } | null>;
}

class NoopEmailProvider implements EmailProvider {
  isConfigured(): boolean {
    return Boolean(serverEnv.emailProviderApiKey);
  }

  async send(): Promise<{ messageId: string } | null> {
    // Deliberately not implemented: no external provider credentials.
    return null;
  }
}

export const emailProvider: EmailProvider = new NoopEmailProvider();
