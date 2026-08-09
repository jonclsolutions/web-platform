/**
 * @file welcome-page.interface.ts
 * @path src/app/admin/web-pages/welcome-page/welcome-page.interface.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Typy použité na uvítací stránce. NavSection se tu využívá jen pro jednu
 *              kartu (rychlý odkaz "Nahlásit chybu") - stejný tvar, jaký dashboard používá
 *              pro svoji síť rychlých odkazů, ať je vzhled i datový model konzistentní.
 *              QuickStat a ActivityLog tu nejsou aktuálně použité (ty citlivé přehledy
 *              zůstávají výhradně na Dashboardu), export tu nechávám podle zadání pro
 *              případ budoucího rozšíření welcome page o podobné prvky.
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