
export interface KpiCard {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  color: 'indigo' | 'green' | 'amber' | 'rose' | 'sky';
}

export interface RecentOrder {
  id: number;
  order_number: string;
  status: string;
  status_label?: string;
  payment_status: string;
  payment_status_label?: string;
  final_amount: number;
  created_at: string;
  customer?: { full_name: string; email: string };
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  stock_warning_level: number;
}

export interface ChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
}

export interface StatusBreakdown {
  label: string;
  count: number;
  color: string;
  pct: number;
}