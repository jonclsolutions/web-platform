<?php
/**
 * @file StageOutputPageRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StageOutputPageRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One page of a carousel output sent before the output itself: `file` - the PNG of
 *   the page drawn by the renderer (upload profile `js_creator_output`, at most 20 MB) and the
 *   template it belongs to. Every page goes in its own request (20 pages would exceed the limit
 *   of one request); OutputController::store() then joins the staged pages into one output.
 * @dependencies AttachmentPolicy (profile js_creator_output), OutputController::stagePage()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

class StageOutputPageRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description One PNG and the template.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file'        => ['required', ...AttachmentPolicy::fileRules(JsCreatorApp::UPLOAD_OUTPUT)],
            'template_id' => ['required', 'integer', 'min:1'],
        ];
    }
}
