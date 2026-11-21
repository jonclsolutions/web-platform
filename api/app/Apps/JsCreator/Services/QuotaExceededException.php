<?php
/**
 * @file QuotaExceededException.php
 * @path app/Apps/JsCreator/Services/QuotaExceededException.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A new file does not fit into the quota of the workspace - answered as 422 with
 *   `error_code: quota_exceeded` (the admin shows its own text and the usage bar).
 */

namespace App\Apps\JsCreator\Services;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class QuotaExceededException extends RuntimeException
{
    /**
     * @description Answer of the API (Laravel calls render() of the exception).
     * @return JsonResponse 422.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message'    => 'The workspace is full. Delete files or empty the trash to free space.',
            'error_code' => 'quota_exceeded',
        ], 422);
    }
}
