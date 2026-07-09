export interface LangMeta {
  code: string; 
  name: string;        
  iconUrl?: string;    
  active: boolean;
  isBuiltIn?: boolean; 
}

export interface FlatKey {
  path: string;
  value: string;
  missing: boolean;
}