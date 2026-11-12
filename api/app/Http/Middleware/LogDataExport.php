<?php
/**
 * @file LogDataExport.php
 * @path app/Http/Middleware/LogDataExport.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of data exports, written by the server: the admin loads the data of an
 * export / report with the query parameter `export` (`csv`, `xlsx`, `json`, `txt`, `raw_<format>`
 * for the import-compatible variant, `report` for a graph report). When such a GET of a signed-in
 * user succeeds, one row is written to the log of the module owning the data (api/<application>/…
 * → the log of that application, AppManifest::logModel(); anything else → core log): event `export_<format>` / `generate_report`,
 * the path, the number of records served and the filters (request payload of LogsActivity).
 * @note An unknown `export` value is not logged (no free text from the browser in the log). The
 *   browser never writes the log itself - only what the server really served is recorded.
 * @dependencies LogsActivity, CoreLog, AppRegistry.
 */

namespace App\Http\Middleware;

use App\Models\Core\CoreLog;
use App\Support\Apps\AppRegistry;
use App\Traits\LogsActivity;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogDataExport
{
    use LogsActivity;

    /** @description Accepted values of the `export` parameter. */
    private const FORMAT_PATTERN = '/^(?:(raw_)?(csv|xlsx|json|txt)|report)$/';

    /**
     * @description Passes the request on and logs a successful export GET.
     * @param Request $request Incoming request.
     * @param Closure $next Next handler.
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $format = $request->query('export');
        if (
            $request->isMethod('GET') && is_string($format) && preg_match(self::FORMAT_PATTERN, $format)
            && $request->user() !== null && $response->isSuccessful()
        ) {
            $this->logExport($request, $response, $format);
        }

        return $response;
    }

    /**
     * @description Writes the export row.
     * @param Request $request Export request.
     * @param Response $response Its answer (the served records).
     * @param string $format Validated `export` value.
     * @return void
     */
    private function logExport(Request $request, Response $response, string $format): void
    {
        $data = $response instanceof JsonResponse ? $response->getData(true)['data'] ?? null : null;
        $count = is_array($data) ? count($data) : 0;
        $segment = explode('/', preg_replace('#^api/#', '', $request->path()))[0] ?? '';
        $path = $request->path();

        [$event, $description] = $format === 'report'
            ? ['generate_report', "Generated a report of {$count} records from {$path}"]
            : ["export_{$format}", "Exported {$count} records (" . strtoupper(str_replace('raw_', 'raw ', $format)) . ") from {$path}"];

        $this->logAction($request, AppRegistry::logModel($segment) ?? CoreLog::class, $event, $path, $description, null, 'collection');
    }
}
