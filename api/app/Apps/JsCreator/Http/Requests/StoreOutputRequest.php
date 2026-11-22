<?php
/**
 * @file StoreOutputRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreOutputRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A generated output sent by the browser: `file` - the PNG drawn by the renderer
 *   (upload profile `js_creator_output`: PNG by content AND extension, at most 20 MB) - or, for a
 *   carousel, `pages` - the tokens of its pages staged before (StageOutputPageRequest), in their
 *   order -, the template it was made from, the target folder (null = top level), the name
 *   (empty = the name of the template and the time) and the text of the post. The size of the
 *   PNG, the number of pages, the ownership of the template, of the staged pages and of the
 *   folder are checked by OutputController.
 * @dependencies AttachmentPolicy (profile js_creator_output), OutputController::store()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Apps\JsCreator\Support\TemplateDocument;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

class StoreOutputRequest extends FormRequest
{
    /** @description Longest text of a post (the same limit as the caption pattern of a template). */
    public const MAX_CAPTION = 5000;

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description One PNG (or 2 … MAX_PAGES staged pages), template id, optional folder, name and text of the post.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file'        => ['required_without:pages', ...AttachmentPolicy::fileRules(JsCreatorApp::UPLOAD_OUTPUT)],
            'pages'       => ['prohibits:file', 'array', 'min:2', 'max:' . TemplateDocument::MAX_PAGES],
            'pages.*'     => ['string', 'distinct', 'regex:/^[A-Za-z0-9]{32}$/'],
            'template_id' => ['required', 'integer', 'min:1'],
            'folder_id'   => ['nullable', 'integer', 'min:1'],
            'name'        => ['nullable', 'string', 'max:150', 'not_regex:/[\x00-\x1F\x7F]/'],
            'caption'     => ['nullable', 'string', 'max:' . self::MAX_CAPTION],
        ];
    }
}
