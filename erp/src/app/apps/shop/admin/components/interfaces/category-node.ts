export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean;
  sort_order: number;
  image_path?: string | null;
  description?: string | null;
  children: CategoryNode[];
  products_count?: number;
  isEditing?: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  directChildrenCount?: number;
  totalRecursiveCount?: number;
}