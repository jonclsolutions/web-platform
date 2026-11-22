<?php
/**
 * @file LibraryZipRequest.php
 * @path app/Apps/JsCreator/Http/Requests/LibraryZipRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Selection of library files (images / own icons, or own fonts) to download as one
 *   ZIP: `ids` (1 … MAX_IDS). Files that are not own (or are in the trash) are ignored by the
 *   controller.
 * @dependencies AssetController::zip(), FontController::zip()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LibraryZipRequest extends FormRequest
{
    /** @description Most files of one ZIP. */
    public const MAX_IDS = 200;

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Ids of the files.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ids'   => ['required', 'array', 'min:1', 'max:' . self::MAX_IDS],
            'ids.*' => ['integer', 'min:1', 'distinct'],
        ];
    }

    /**
     * @description The ids as unique integers.
     * @return int[]
     */
    public function ids(): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input('ids', []))));
    }
}
