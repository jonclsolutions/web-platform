/**
 * @file welcome-page.interface.ts
 * @path src/app/admin/core-pages/welcome-page/welcome-page.interface.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Types of the welcome page. NavSection is used for one card only (quick link
 *              "Report a bug") - the same shape the dashboard uses for its quick links, so
 *              the look and the data model stay consistent. QuickStat and ActivityLog are
 *              not used here at the moment (the sensitive overviews stay on the Dashboard).
 */

export interface ActivityLog {
  id: number;
  event_type: string;
  module: string;
  description: string;
  user_plain: string;
  origin: string;
  created_at: string;
}

export interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
  color: 'indigo' | 'green' | 'amber' | 'rose' | 'sky' | 'slate';
}

export interface NavSection {
  title: string;
  icon: string;
  route: string;
  description: string;
  color: 'indigo' | 'green' | 'amber' | 'sky' | 'rose' | 'slate';
}