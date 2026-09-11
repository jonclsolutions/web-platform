<?php
/**
 * @file HandlesImportBatches.php
 * @path app/Traits/HandlesImportBatches.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-08-31
 * @description Sdílená logika pro dvoukrokový (dry-run validate -> commit) hromadný
 * import, znovupoužitelná pro libovolný resource controller. Centralizuje MÍSTO, kde
 * dočasné importní soubory (storage/app/private/imports) vznikají i zanikají - dřív
 * každý z pěti import-schopných controllerů (WebRawRequestCommissionController,
 * WebNewsController, WebSalesLeadController, WebSupportTicketController,
 * ShopSupplierController) měl vlastní kopii téhle logiky, což vedlo k tomu, že mazání
 * dočasného souboru PŘI SELHÁNÍ (`catch` blok importCommit()) chybělo nekonzistentně
 * napříč nimi - oprava na jednom místě se musela ručně replikovat všude a snadno se
 * zapomnělo.
 *
 * @architecture `startImportBatch()` uloží soubor a vytvoří `CoreImportBatch` záznam
 * (nahrazuje ruční `Storage::put()` + `CoreImportBatch::create()` v každém
 * controlleru). `runImportCommit()` obaluje samotný zápis do DB (callback) do
 * `try/finally` - dočasný soubor se smaže VŽDY po dokončení pokusu o commit, ať už
 * uspěje, nebo skončí výjimkou. Volající controller tak už nikdy nemůže zapomenout
 * na `Storage::delete()` v `catch` větvi, protože ji vůbec nepíše - `finally` běží
 * nezávisle na tom, jestli closure prošla, nebo hodila exception.
 *
 * @note Bezpečnostní síť navíc: i kdyby request spadl úplně jinak (fatal error mimo
 * try/catch, worker timeout u velkého souboru...), `PurgeImportBatchesCommand`
 * (naplánovaný denně v routes/console.php) smaže staré `validated`/`failed` batch
 * záznamy a jejich temp soubory - tenhle trait řeší běžný/očekávaný cyklus, scheduled
 * command řeší vše ostatní.
 */

namespace App\Traits;

use App\Models\Core\CoreImportBatch;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait HandlesImportBatches
{
    /**
     * @description Disk pro dočasné importní soubory - všechny controllery dosud
     * používaly stejnou hodnotu natvrdo (`private const TEMP_DISK = 'local';`),
     * centralizováno sem, ať se nemůže rozejít.
     */
    protected function importTempDisk(): string
    {
        return 'local';
    }

    /**
     * @description Uloží nahraný soubor do `imports/` na `importTempDisk()` a vytvoří
     * odpovídající `CoreImportBatch` záznam ve stavu `'validated'`. Nahrazuje ruční
     * `Storage::disk(self::TEMP_DISK)->put(...)` + `CoreImportBatch::create([...])`
     * dřív duplikované v každém importním controlleru.
     * @param Request $request Aktuální request (kvůli user_id a nahranému souboru).
     * @param string $resource Klíč resource (např. 'web/news') - jen popisný, do DB.
     * @param string $format 'csv'|'json'|'txt'.
     * @param int $totalRows
     * @param int $validRows
     * @param int $invalidRows
     * @param array $errorSummary
     * @return CoreImportBatch
     */
    protected function startImportBatch(
        Request $request,
        string $resource,
        string $format,
        int $totalRows,
        int $validRows,
        int $invalidRows,
        array $errorSummary
    ): CoreImportBatch {
        $tempPath = 'imports/' . Str::uuid() . '.' . $format;
        Storage::disk($this->importTempDisk())->put(
            $tempPath,
            file_get_contents($request->file('file')->getRealPath())
        );

        return CoreImportBatch::create([
            'resource'          => $resource,
            'user_id'           => $request->user()->id,
            'original_filename' => $request->file('file')->getClientOriginalName(),
            'format'            => $format,
            'temp_path'         => $tempPath,
            'status'            => 'validated',
            'total_rows'        => $totalRows,
            'valid_rows'        => $validRows,
            'invalid_rows'      => $invalidRows,
            'error_summary'     => $errorSummary,
        ]);
    }

    /**
     * @description Najde a ověří platnost `CoreImportBatch` podle `import_token` -
     * musí patřit volajícímu uživateli a být ve stavu `'validated'`. Nahrazuje
     * duplikovanou kontrolu na začátku každého importCommit().
     * @return CoreImportBatch|null Null = neplatný/cizí/už zpracovaný token.
     */
    protected function findPendingImportBatch(Request $request, int $importToken): ?CoreImportBatch
    {
        $batch = CoreImportBatch::find($importToken);

        if ($batch === null || $batch->user_id !== $request->user()->id || $batch->status !== 'validated') {
            return null;
        }

        return $batch;
    }

    /**
     * @description Obaluje samotný zápis importu do DB (callback `$commitFn`) tak, aby
     * dočasný soubor na disku byl VŽDY smazán po dokončení pokusu - ať už `$commitFn`
     * vrátí výsledek v pořádku, nebo hodí výjimku. Tohle je JÁDRO opravy: dřív se
     * `Storage::delete($batch->temp_path)` volalo ručně jen v success větvi, `catch`
     * blok na něj nekonzistentně zapomínal (viz refactor-note v hlavičce souboru).
     * `finally` běží nezávisle na výsledku closure, takže na mazání už NELZE zapomenout,
     * protože ho volající controller vůbec nepíše sám.
     * @param CoreImportBatch $batch
     * @param callable(UploadedFile $uploadedFile): array $commitFn Callback, který
     *   dostane znovu sestavený `UploadedFile` z temp souboru a vrátí pole
     *   `['imported_count' => int, 'skipped_count' => int]`. Smí hodit výjimku -
     *   ta se v `runImportCommit()` NEZACHYTÁVÁ (volající si ji zpracuje sám v
     *   vlastním try/catch), `finally` blok ale i tak proběhne a soubor smaže.
     * @return array{imported_count: int, skipped_count: int} Výsledek `$commitFn`.
     * @throws \Throwable Cokoliv, co hodí `$commitFn` - propaguje se dál nezměněné.
     */
    protected function runImportCommit(CoreImportBatch $batch, callable $commitFn): array
    {
        if (!Storage::disk($this->importTempDisk())->exists($batch->temp_path)) {
            throw new \RuntimeException('The temporary import file has expired. Please upload the file again.', 410);
        }

        $batch->update(['status' => 'processing']);

        try {
            $realPath = Storage::disk($this->importTempDisk())->path($batch->temp_path);
            $uploadedFile = new UploadedFile($realPath, $batch->original_filename ?? 'import', null, null, true);

            $result = $commitFn($uploadedFile);

            $batch->update([
                'status'         => 'completed',
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'completed_at'   => now(),
            ]);

            return $result;
        } catch (\Throwable $e) {
            $batch->update(['status' => 'failed']);
            throw $e;
        } finally {
            // Nezávisle na úspěchu/selhání výše - soubor už není potřeba. Tohle je
            // JEDINÉ místo v celé aplikaci, které dočasný importní soubor maže -
            // žádný jiný controller ho už nikdy nesmí mazat ručně, ať zůstane
            // zaručeně konzistentní.
            Storage::disk($this->importTempDisk())->delete($batch->temp_path);
        }
    }
}