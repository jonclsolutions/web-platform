<?php
/**
 * @file HandlesAttachments.php
 * @path app/Traits/HandlesAttachments.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sdílená logika pro ukládání a mazání souborových příloh, znovupoužitelná
 * pro libovolný model s `morphMany(WebAttachment::class, 'attachable')` vztahem.
 * @refactor-note (2026-08-2) Přidána storeSingleAttachment() - WebJobApplication (CV) a
 *      WebSupportTicket (attachment) byly převedeny z vlastních `cv_path`/`attachment_path`
 *      sloupců na tenhle stejný polymorfní `web_attachments` systém jako WebSalesOrder/
 *      WebRawRequestCommission (sjednocení - jeden download/náhled mechanismus pro
 *      všechny entity, viz PublicFileDownloadController). Na rozdíl od nich ale smí mít
 *      tyhle dvě entity vždy jen JEDEN soubor - storeAttachments() níže na to není
 *      stavěná (očekává pole souborů z `<input multiple>`, `foreach` přes jeden
 *      UploadedFile by dopadl špatně), proto samostatná metoda místo předělávání
 *      původní (funkční, use'ované na 2 místech) storeAttachments().
 */

namespace App\Traits;

use App\Models\Web\WebAttachment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

trait HandlesAttachments
{
/**
     * @description Uloží všechny nahrané soubory z daného pole requestu jako
     * WebAttachment záznamy navázané na $model.
     * @param Request $request
     * @param Model $model Model s morphMany('attachments') vztahem.
     * @param string $folder Podsložka v `storage/app/public/{folder}`.
     * @param string $fileField Název pole v requestu (default 'attachments').
     * @return void
     */
protected function storeAttachments(Request $request, Model $model, string $folder, string $fileField = 'attachments'): void
    {
if (!$request->hasFile($fileField)) {
return;
        }

foreach ($request->file($fileField) as $file) {
if (!$file || !$file->isValid()) {
continue;
            }

$path = $file->store($folder, 'public');

$model->attachments()->create([
'disk'              => 'public',
'path'              => $path,
'original_filename' => $file->getClientOriginalName(),
'mime_type'         => $file->getClientMimeType(),
'size_bytes'        => $file->getSize(),
            ]);
        }
    }

    /**
     * @description Uloží PRÁVĚ JEDEN nahraný soubor jako WebAttachment navázaný na
     *              $model a přitom nahradí jakoukoliv dřívější přílohu (smaže ji ze
     *              disku i z DB) - použití pro entity, které smí mít vždy nejvýš 1
     *              soubor (WebJobApplication::cv_file, WebSupportTicket::attachment).
     *              Stejný způsob uložení na disk (náhodné hashované jméno,
     *              originální jméno zachováno v `original_filename`) jako
     *              storeAttachments(), jen bez foreach přes pole souborů - vstupní
     *              pole requestu je tu jeden soubor, ne `input[multiple]`.
     * @param Request $request
     * @param Model $model Model s morphMany('attachments') vztahem.
     * @param string $folder Podsložka v `storage/app/public/{folder}`.
     * @param string $fileField Název pole jednoho souboru v requestu (např. 'cv_file', 'attachment').
     * @return void
     */
    protected function storeSingleAttachment(Request $request, Model $model, string $folder, string $fileField): void
    {
        if (!$request->hasFile($fileField)) {
            return;
        }

        $file = $request->file($fileField);

        if (!$file || !$file->isValid()) {
            return;
        }

        // "Nejvýš 1 soubor" se vynucuje tady - nová příloha vždy nahradí tu
        // předchozí (soubor na disku i DB záznam), nikdy se nehromadí.
        $this->deleteAllAttachments($model);

        $path = $file->store($folder, 'public');

        $model->attachments()->create([
            'disk'              => 'public',
            'path'              => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type'         => $file->getClientMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
    }

/**
     * @description Smaže všechny přílohy modelu (soubor z disku i DB záznam) - použito
     * při force-delete entity.
     * @param Model $model Model s morphMany('attachments') vztahem.
     * @return void
     */
protected function deleteAllAttachments(Model $model): void
    {
foreach ($model->attachments as $attachment) {
            \Illuminate\Support\Facades\Storage::disk($attachment->disk)->delete($attachment->path);
$attachment->delete();
        }
    }
}