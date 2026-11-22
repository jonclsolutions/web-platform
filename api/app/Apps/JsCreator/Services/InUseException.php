<?php
/**
 * @file InUseException.php
 * @path app/Apps/JsCreator/Services/InUseException.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A library image or own font cannot be deleted while a template (also one in the
 *   trash) uses it: 409 `in_use` with the list of those templates (they belong to the same
 *   account, so their names may be shown).
 * @dependencies TemplateUsages::ensureUnused().
 */

namespace App\Apps\JsCreator\Services;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class InUseException extends RuntimeException
{
    /**
     * @param list<array{id: int, name: string, section: string, trashed: bool}> $templates Templates using the file.
     */
    public function __construct(public readonly array $templates)
    {
        parent::__construct('in_use');
    }

    /**
     * @description Answer of the API (Laravel calls render() of the exception).
     * @return JsonResponse 409.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message'    => 'The file is used by a template. Remove it from the templates (or delete them for good) first.',
            'error_code' => 'in_use',
            'used_by'    => $this->templates,
        ], 409);
    }
}
