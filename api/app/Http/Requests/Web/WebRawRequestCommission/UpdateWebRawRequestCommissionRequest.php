<?php
/**
 * @file UpdateWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/UpdateWebRawRequestCommissionRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing commission requests, including secure file handling.
 *
 * @refactor-note (2026-08) `attachment` (jeden soubor, max 10 MB) nahrazeno `attachments`
 * (pole, max. 10 souborů, každý max. 20 MB, souhrnně max. 50 MB) - sjednoceno se
 * StoreWebRawRequestCommissionRequest, ať mají create i update stejnou politiku.
 *
 * @refactor-note (2026-08-19) BACKLOG "mazání jednotlivých existujících příloh v editu":
 * přidáno `attachments_removed_ids` - pole ID příloh, které admin v editačním formuláři
 * odebral (UI-only akce, propíše se až s uložením celého formuláře). Validace zde řeší
 * jen TVAR vstupu (pole celých čísel) - vlastnictví (že dané ID skutečně patří k
 * editovanému požadavku) ověřuje až `HandlesAttachments::deleteAttachmentsByIds()`
 * v kontroleru, scoped přes `$model->attachments()` relaci - cizí ID se tam tiše
 * ignorují, takže sem záměrně NEPŘIDÁVÁME `exists:web_attachments,id` (to by ověřilo
 * jen globální existenci záznamu, ne vlastnictví, a zbytečně by to plodilo 422 chybu
 * místo tichého no-opu u případného race-conditions scénáře, kdy mezitím jinam zásahem
 * příloha už zanikla).
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for update requests, ensuring data consistency and security.
 */
class UpdateWebRawRequestCommissionRequest extends FormRequest
{
use ValidatesAttachmentSecurity;

/** @description Max. počet příloh přidaných v rámci JEDNOHO update requestu. */
private const MAX_ATTACHMENTS = 10;

/** @description Max. velikost jednoho souboru v kB (Laravel `max:` pravidlo je v kB). */
private const MAX_FILE_SIZE_KB = 20480; // 20 MB

/** @description Max. souhrnná velikost všech nově nahraných příloh v bytech. */
private const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

public function authorize(): bool
    {
return true;
    }

public function rules(): array
    {
return [
'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-_]+$/u'],
'contact_email'              => ['sometimes', 'email', 'max:255'],
'contact_phone'              => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
'order_description'          => ['sometimes', 'string', 'max:10000'],
'status'   => ['sometimes', 'string', 'in:new,in_progress,done,cancelled'],
'priority' => ['sometimes', 'string', 'in:low,neutral,high'],
'note'                       => ['sometimes', 'nullable', 'string'],
'attachments'                => ['sometimes', 'nullable', 'array', 'max:' . self::MAX_ATTACHMENTS, new AttachmentsTotalSize(self::MAX_TOTAL_SIZE_BYTES)],
'attachments.*'              => ['file', 'max:' . self::MAX_FILE_SIZE_KB, $this->attachmentExtensionRule()],
'attachments_removed_ids'    => ['sometimes', 'array'],
'attachments_removed_ids.*'  => ['integer'],
        ];
    }

/**
     * Perform additional MIME type validation to prevent malicious file uploads.
     *
     * @param \Illuminate\Validation\Validator $validator
     * @return void
     */
public function withValidator($validator)
    {
$validator->after(fn ($v) => $this->validateAttachmentMime($v));
    }

public function messages(): array
    {
return [
'thema.min'                          => 'The subject must be between 3 and 255 characters.',
'thema.max'                          => 'The subject must be between 3 and 255 characters.',
'thema.regex'                        => 'The subject contains invalid characters.',
'contact_email.email'                => 'Please provide a valid email address.',
'contact_phone.regex'                => 'Please provide a valid phone number.',
'order_description.max'              => 'The request description is too long.',
'attachments.max'                    => 'You can upload a maximum of ' . self::MAX_ATTACHMENTS . ' files at once.',
'attachments.*.max'                  => 'Each file may not be greater than 20 MB.',
'attachments.*.file'                 => 'The attachment must be a valid file.',
'attachments_removed_ids.array'      => 'Invalid format for the removed attachments list.',
'attachments_removed_ids.*.integer'  => 'Invalid ID for the removed attachment.',
        ];
    }
}