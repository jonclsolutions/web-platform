export interface FilterColumns {
    key: string;
    header: string;
    placeholder: string;
    type: string;
    canSort: boolean;
    options?: string[] | { value: string | number; label: string }[];
}