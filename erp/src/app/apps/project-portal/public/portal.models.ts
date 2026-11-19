/**
 * @file portal.models.ts
 * @path src/app/apps/project-portal/public/portal.models.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Data of the client project portal (answers of the API `projects/public/{token}/…`,
 *   client audience) and the sections of its left menu. Shared by the session service, the layout
 *   and the section components.
 * @note The client sees only what the supplier made public: no internal notes, no internal
 *   checkpoint notes (the API leaves them out).
 */

/** Sections of the left menu (= child routes of /projects/:token). */
export type PortalSection = 'overview' | 'checkpoints' | 'threads' | 'approvals' | 'updates' | 'files' | 'contacts' | 'account' | 'help';

/** Items of the upper part of the left menu, in their order (My account, Help and logout are at the bottom). */
export const PORTAL_SECTIONS: PortalSection[] = ['overview', 'checkpoints', 'threads', 'approvals', 'updates', 'files', 'contacts'];

/** Every section (the address may name any of them, e.g. `?section=` of an e-mail). */
export const PORTAL_ALL_SECTIONS: PortalSection[] = [...PORTAL_SECTIONS, 'account', 'help'];

/**
 * @description The value names a section of the portal.
 * @param value Path segment or `?section=` value.
 */
export function isPortalSection(value: unknown): value is PortalSection {
  return typeof value === 'string' && (PORTAL_ALL_SECTIONS as string[]).includes(value);
}

/** Notification switches the client sets in "My account" (all off by default). */
export const PORTAL_NOTIFICATIONS = ['notify_replies', 'notify_checkpoint_status', 'notify_checkpoint_dates', 'notify_updates', 'notify_approvals'] as const;
export type PortalNotification = typeof PORTAL_NOTIFICATIONS[number];

/** Settings of the own account the client may change. */
export interface PortalAccountSettings {
  email: string;
  language: 'cz' | 'en';
  notify_replies: boolean;
  notify_checkpoint_status: boolean;
  notify_checkpoint_dates: boolean;
  notify_updates: boolean;
  notify_approvals: boolean;
}

/** Item of "What is new" (API ProjectActivityFeed, client audience). */
export interface PortalActivityItem {
  type: 'update' | 'checkpoint' | 'approval_requested' | 'approval_decided' | 'reply';
  at: string;
  title: string;
  detail: string | null;
  actor?: string | null;
  target: { section: string; id: number | null };
  is_new: boolean;
}

/** File attached to a message, an update or an approval request. */
export interface ProjectAttachment {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number;
  download_url: string;
  /** Null for types that are download only (see AttachmentPolicy on the API). */
  view_url: string | null;
}

/** Update of the supplier. */
export interface PortalUpdate {
  id: number;
  title: string;
  body: string;
  author_label: string | null;
  published_at: string | null;
  attachments?: ProjectAttachment[];
}

/** Approval request. */
export interface PortalApproval {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'changes_requested';
  due_date: string | null;
  checkpoint_label?: string | null;
  requested_by_label: string | null;
  requested_at: string | null;
  attachments?: ProjectAttachment[];
  decisions?: { id: number; decision: 'approved' | 'changes_requested'; comment: string | null; author_label: string | null; account_id: number | null; created_at: string }[];
}

/** Step of the project (Progress). */
export interface ProjectCheckpoint {
  id: number;
  /** Title of the checkpoint. */
  label: string;
  /** What the checkpoint covers (written by the supplier) - shown when the item is expanded. */
  description?: string | null;
  /** Planned date (Y-m-d). */
  due_date?: string | null;
  status: 'new' | 'active' | 'done';
}

/** Message of a conversation. */
export interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  /** Client account that wrote the message (null for the supplier). */
  author_account_id?: number | null;
  body: string;
  attachments?: ProjectAttachment[];
  created_at: string;
}

/** Conversation (Communication). */
export interface ProjectThread {
  id: number;
  subject: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  unread_count?: number;
  /** Whose turn it is in an active thread: 'customer' (you) | 'supplier' | null (closed). */
  waiting_on?: 'customer' | 'supplier' | null;
  has_more_older_messages?: boolean;
  messages?: ProjectThreadMessage[];
}

/** Project of the signed-in client account. */
export interface PublicProject {
  id: number;
  name: string;
  description: string | null;
  platform: string | null;
  project_lead: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  technologies: string | null;
  estimated_completion_from: string | null;
  estimated_completion_to: string | null;
  checkpoints: ProjectCheckpoint[];
  /** The signed-in client account with the settings it may change itself. */
  account?: {
    id: number;
    username: string;
    display_name: string;
    email?: string | null;
    language?: 'cz' | 'en';
    notify_replies?: boolean;
    notify_checkpoint_status?: boolean;
    notify_checkpoint_dates?: boolean;
    notify_updates?: boolean;
    notify_approvals?: boolean;
    /** The e-mail was proven by a code / link. */
    email_verified?: boolean;
    /** The account can sign in with a password. */
    has_password?: boolean;
  };
}

/** File of the project (Files section). */
export interface PortalFile {
  id: number;
  original_filename: string;
  size_bytes: number;
  download_url: string;
  /** Where the file comes from: a thread, an update, an approval request. */
  source?: 'thread' | 'update' | 'approval';
  source_id?: number | null;
  source_title?: string | null;
  thread_id: number | null;
  thread_subject: string | null;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  created_at: string;
}

/** Company data of the supplier (Contacts, public site settings). */
export interface CompanySettings {
  company_name?: string;
  ico?: string;
  dic?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
}
