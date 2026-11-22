<?php
/**
 * @file InvalidPackageException.php
 * @path app/Apps/JsCreator/Services/InvalidPackageException.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A JSON file of an import (or a selection of an export) is not a valid package of
 *   JS Creator. Rendered as 422 with `error_code: invalid_package` and the paths of the errors
 *   (at most TransferPackage::MAX_ERRORS), so the import dialog can show what is wrong.
 * @dependencies TransferPackage, TransferImport, TransferExport
 */

namespace App\Apps\JsCreator\Services;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class InvalidPackageException extends RuntimeException
{
    /**
     * @param array<string, string> $errors Path in the package (e.g. `templates.0.document.pages.0.layers.2.size`) → message.
     * @param string $code Error code of the answer (`invalid_package` | `export_too_large`).
     */
    public function __construct(public readonly array $errors, public readonly string $errorCode = 'invalid_package')
    {
        parent::__construct($errorCode);
    }

    /**
     * @description Answer of the API (Laravel calls render() of the exception).
     * @return JsonResponse 422.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message'    => $this->errorCode === 'export_too_large'
                ? 'The selection is too large for one file. Export fewer templates at once.'
                : 'The file is not a valid package of JS Creator.',
            'error_code' => $this->errorCode,
            'errors'     => array_map(fn (string $message) => [$message], $this->errors),
        ], 422);
    }
}
