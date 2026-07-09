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