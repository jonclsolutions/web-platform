<?php
/**
 * @file UpdateTemplateRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateTemplateRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation of a save of the editor: name, size, output format, caption pattern,
 *   the version the editor started from and the document (an object - its content is checked
 *   by TemplateDocument in the controller, which also checks the ownership of the files it uses).
 * @note document() reads the document from the raw JSON body: the global middleware trims texts
 *   and turns empty texts into null, which would change the texts of the layers.
 * @dependencies TemplateSize (limits of the size).
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Support\TemplateSize;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTemplateRequest extends FormRequest
{
    /** @description Longest caption pattern. */
    public const MAX_CAPTION = 5000;

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Every property of the template is sent with each save.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'             => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'width'            => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'height'           => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'output_format'    => ['required', 'string', 'in:png,jpg'],
            'output_quality'   => ['required', 'integer', 'min:1', 'max:100'],
            'caption_template' => ['present', 'nullable', 'string', 'max:' . self::MAX_CAPTION, 'not_regex:/[\x00-\x09\x0B-\x1F\x7F]/'],
            'version'          => ['required', 'integer', 'min:1'],
            'document'         => ['required', 'array'],
        ];
    }

    /**
     * @description The document exactly as the editor sent it (raw JSON body, at most 64 levels).
     * @return mixed The decoded document; null when the body is not JSON with a document.
     */
    public function document(): mixed
    {
        $body = json_decode($this->getContent(), true, 64);

        return is_array($body) && array_key_exists('document', $body) ? $body['document'] : null;
    }

    /**
     * @description Trims the name; an empty caption pattern is stored as null.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
        if ($this->input('caption_template') === '') {
            $this->merge(['caption_template' => null]);
        }
    }
}
