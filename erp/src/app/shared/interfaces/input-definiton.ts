import { UploadProfile } from '../utils/upload-rules';

export interface InputDefinition {
  column_name: string;
  label: string;
  placeholder?: string;
  /**
   * Field type. 'avatar' = profile photo of the edited account (AvatarEditorComponent, edit mode
   * only - saved at once by its own endpoint, not with the form; `editable: false` shows it only).
   */
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  /** Validate the value with the password policy (Unicode rules, finding #37) instead of `pattern`. */
  passwordPolicy?: boolean;
  errorMessage?: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  step?: number;
  editable?: boolean;
  show_in_edit?: boolean;
  show_in_create?: boolean;
  hide_in_edit?: boolean;
  disabledOptionValues?: (string | number)[];
  hint?: string;
  /**
   * Attachment rules of a `'file'` / `'files'` field - profile of `GET upload-rules`
   * (App\Support\Uploads\AttachmentPolicy): allowed types, count and size limits.
   */
  uploadProfile?: UploadProfile;
}