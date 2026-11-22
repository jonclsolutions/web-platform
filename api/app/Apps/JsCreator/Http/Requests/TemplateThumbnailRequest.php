<?php
/**
 * @file TemplateThumbnailRequest.php
 * @path app/Apps/JsCreator/Http/Requests/TemplateThumbnailRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation of the thumbnail of a template: one PNG / WebP drawn by the editor
 *   (type checked by the content and the name, at most 2 MB); its pixels are re-encoded by
 *   LibraryImage::thumbnail().
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TemplateThumbnailRequest extends FormRequest
{
    /** @description Largest thumbnail (KB). */
    public const MAX_KB = 2048;

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description One PNG / WebP file.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'thumb' => ['required', 'file', 'max:' . self::MAX_KB, 'mimes:png,webp', 'extensions:png,webp'],
        ];
    }
}
