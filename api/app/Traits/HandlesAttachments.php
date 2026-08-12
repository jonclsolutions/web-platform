<?php
/**
 * @file HandlesAttachments.php
 * @path app/Traits/HandlesAttachments.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sdílená logika pro ukládání a mazání více souborových příloh (max. 10 na
 * request, jednotlivě max. 20 MB, celkem max. 50 MB - vynuceno již ve validaci
 * FormRequestu, tady jen bezpečně ukládáme, co validace propustila). Znovupoužitelné pro
 * libovolný model s `morphMany(WebAttachment::class, 'attachable')` vztahem - viz
 * WebRawRequestCommission/WebSalesOrder a budoucí entity v části 2 (admin formuláře).
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