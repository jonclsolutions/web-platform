<?php
/**
 * @file TransferController.php
 * @path app/Apps/JsCreator/Http/Controllers/TransferController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Export and import of templates, blocks and sets of a section as one JSON file
 *   (TransferPackage) - to move them to another account or keep a copy:
 *   - POST js-creator/<section>/export: package of a selection of own items (with the images,
 *     icons, fonts and blocks they need) as `data`; the browser saves it as a .json file;
 *   - POST js-creator/<section>/import: `file` (JSON only) - checked strictly and imported all
 *     or nothing (TransferImport); taken names get ` (2)`.
 *   Both actions are written to the audit log (module Transfer) without names or content.
 * @dependencies TransferExport, TransferImport, ExportRequest, ImportRequest, LogsActivity.
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\ExportRequest;
use App\Apps\JsCreator\Http\Requests\ImportRequest;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\TransferExport;
use App\Apps\JsCreator\Services\TransferImport;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;

class TransferController extends Controller
{
    use LogsActivity;

    /**
     * @description Package of the selected own templates, blocks and sets of the section.
     * @param ExportRequest $request `template_ids`, `block_ids`, `set_ids`.
     * @return JsonResponse The package (`data`); 422 `invalid_package` (not own / missing file)
     *   or `export_too_large`.
     */
    public function export(ExportRequest $request): JsonResponse
    {
        $result = TransferExport::build(
            $request->user()->id,
            (string) $request->route('section'),
            $request->ids('template_ids'),
            $request->ids('block_ids'),
            $request->ids('set_ids'),
        );
        $counts = $result['counts'];
        $this->logAction($request, JsCreatorLog::class, 'export', 'Transfer',
            "Exported {$counts['templates']} templates, {$counts['blocks']} blocks, {$counts['sets']} sets, {$counts['assets']} images, {$counts['fonts']} fonts");

        return $this->respond($result['package']);
    }

    /**
     * @description Imports a package into the own workspace of the section.
     * @param ImportRequest $request `file`.
     * @return JsonResponse 201 with the summary (counts, renamed items, ids of the new templates
     *   and blocks - the browser draws their thumbnails); 422 `invalid_package` or `quota_exceeded`.
     */
    public function import(ImportRequest $request): JsonResponse
    {
        $summary = TransferImport::run(
            $request->user()->id,
            (string) $request->route('section'),
            (string) file_get_contents($request->file('file')->getRealPath()),
        );
        $this->logAction($request, JsCreatorLog::class, 'import', 'Transfer',
            "Imported {$summary['templates']} templates, {$summary['blocks']} blocks, {$summary['sets']} sets, {$summary['assets']} images, {$summary['fonts']} fonts", null, null, ['file']);

        return $this->respond($summary, 201);
    }
}
