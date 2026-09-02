<?php
/**
 * @file HandlesAttachments.php
 * @path app/Traits/HandlesAttachments.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sdílená logika pro ukládání a mazání souborových příloh, znovupoužitelná
 * pro libovolný model s `morphMany(WebAttachment::class, 'attachable')` vztahem.
 *
 * @refactor-note (2026-08-31) BACKLOG "privátní úložiště citlivých příloh": `storeAttachments()`
 * a `storeSingleAttachment()` dostaly nový volitelný parametr `$disk`, s DEFAULTNÍ hodnotou
 * změněnou z `'public'` na `'private'` (nový disk, viz config/filesystems.php - kořen
 * `storage/app/private`, BEZ symlinku, fyzicky nedosažitelný přímo přes webserver).
 * Protože je tenhle trait sdílený VŠEMI čtyřmi controllery s přílohami
 * (WebRawRequestCommissionController, WebSalesOrderController, WebSupportTicketController,
 * WebJobApplicationController), tahle JEDNA změna defaultu automaticky přesouvá VŠECHNY
 * nově nahrávané přílohy (CV, tickety, poptávky, realizace) na privátní disk, aniž by
 * bylo nutné upravovat volání v jednotlivých controllerech. Přístup k souboru pak jde
 * výhradně přes AttachmentDownloadController (dřív PublicFileDownloadController) a
 * krátkodobě podepsané (`signed`) URL - viz WebAttachmentResource a routes/api.php.
 * `deleteAllAttachments()`/`deleteAttachmentsByIds()` beze změny - už dřív čtou
 * `$attachment->disk` dynamicky z DB záznamu, takže fungují správně bez ohledu na to,
 * na kterém disku byla konkrétní příloha uložena.
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
     * @param string $folder Podsložka v `storage/app/{$disk}/{folder}`.
     * @param string $fileField Název pole v requestu (default 'attachments').
     * @param string $disk Cílový disk - 'private' (default) pro citlivé přílohy,
     *   'public' jen pro obsah, který má být přímo veřejně dostupný.
     * @return void
     */
    protected function storeAttachments(Request $request, Model $model, string $folder, string $fileField = 'attachments', string $disk = 'private'): void
    {
        if (!$request->hasFile($fileField)) {
            return;
        }

        foreach ($request->file($fileField) as $file) {
            if (!$file || !$file->isValid()) {
                continue;
            }

            $path = $file->store($folder, $disk);

            $model->attachments()->create([
                'disk'              => $disk,
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
     * @param Request $request
     * @param Model $model Model s morphMany('attachments') vztahem.
     * @param string $folder Podsložka v `storage/app/{$disk}/{folder}`.
     * @param string $fileField Název pole jednoho souboru v requestu (např. 'cv_file', 'attachment').
     * @param string $disk Cílový disk - 'private' (default).
     * @return void
     */
    protected function storeSingleAttachment(Request $request, Model $model, string $folder, string $fileField, string $disk = 'private'): void
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

        $path = $file->store($folder, $disk);

        $model->attachments()->create([
            'disk'              => $disk,
            'path'              => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type'         => $file->getClientMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
    }

    /**
     * @description Smaže všechny přílohy modelu (soubor z disku i DB záznam) - použito
     * při force-delete entity. Čte `$attachment->disk` dynamicky - funguje správně
     * bez ohledu na to, jestli je příloha na 'public' nebo 'private' disku.
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

    /**
     * @description Smaže VYBRANÉ přílohy podle ID (ne všechny) - použito pro odebrání
     * jednotlivých existujících příloh při update. Striktně SCOPED na `$model` přes
     * `$model->attachments()` relaci - `$ids`, které nepatří tomuto modelu, se prostě
     * nenajdou a tiše se ignorují.
     * @param Model $model Model s morphMany('attachments') vztahem.
     * @param array $ids ID příloh k odstranění (soubor z disku i DB záznam).
     * @return void
     */
    protected function deleteAttachmentsByIds(Model $model, array $ids): void
    {
        if (empty($ids)) {
            return;
        }

        $attachments = $model->attachments()->whereIn('id', $ids)->get();

        foreach ($attachments as $attachment) {
            \Illuminate\Support\Facades\Storage::disk($attachment->disk)->delete($attachment->path);
            $attachment->delete();
        }
    }
}