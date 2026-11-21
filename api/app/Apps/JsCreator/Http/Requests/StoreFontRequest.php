<?php
/**
 * @file StoreFontRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreFontRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Upload of an own font: the file (TTF / OTF / WOFF / WOFF2 - extension of the upload
 *   profile `js_creator_font`, size limit, signature of the content by FontFile) and the face it
 *   is (family, weight, style).
 * @note The type is checked from the first bytes (FontFile) instead of `mimes:` - PHP's content
 *   type detection does not name font types reliably.
 * @dependencies FontFile, AttachmentPolicy (profile js_creator_font), FontController::store()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Support\FontFile;
use App\Support\Uploads\AttachmentPolicy;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

class StoreFontRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description File within the profile with a font signature fitting its extension; family
     *   1-80 printable characters; weight 100-900 by 100; style normal / italic.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $profile = AttachmentPolicy::profile(JsCreatorApp::UPLOAD_FONT);

        return [
            'file'   => [
                'required', 'file', 'max:' . $profile['max_file_kb'], 'extensions:' . implode(',', $profile['extensions']),
                function (string $attribute, mixed $value, Closure $fail) {
                    if ($value instanceof UploadedFile && self::formatOf($value) === null) {
                        $fail('The file is not a font of an allowed type (TTF, OTF, WOFF, WOFF2).');
                    }
                },
            ],
            ...self::faceRules(),
        ];
    }

    /**
     * @description Rules of the face of a font (also used to change it).
     * @return array<string, mixed>
     */
    public static function faceRules(): array
    {
        return [
            'family' => ['required', 'string', 'max:80', 'regex:/^[\pL\pN][\pL\pN \-_.\']*$/u'],
            'weight' => ['required', 'integer', Rule::in(CreatorFont::WEIGHTS)],
            'style'  => ['required', 'string', Rule::in(CreatorFont::STYLES)],
        ];
    }

    /**
     * @description Detected format of an uploaded font when it fits its extension.
     * @param UploadedFile $file Upload.
     * @return string|null
     */
    public static function formatOf(UploadedFile $file): ?string
    {
        $handle = @fopen($file->getRealPath(), 'rb');
        $head = $handle ? (string) fread($handle, 4) : '';
        if ($handle) {
            fclose($handle);
        }
        $format = FontFile::detect($head);

        return $format !== null && FontFile::matchesExtension($format, strtolower($file->getClientOriginalExtension())) ? $format : null;
    }

    /**
     * @description Trims the family before validation.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('family'))) {
            $this->merge(['family' => trim($this->input('family'))]);
        }
    }
}
