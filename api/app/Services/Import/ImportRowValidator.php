<?php
/**
 * @file ImportRowValidator.php
 * @path app/Services/Import/ImportRowValidator.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validuje jednotlivé importované řádky proti SKUTEČNÝM validačním
 * pravidlům daného resource - znovupoužívá `rules()` z existující `Store*Request`
 * třídy (viz `importable_resources.php` -> `store_request`), omezené na sloupce
 * v `importable_columns`. Žádná duplicitní validační logika - import tak vždy
 * respektuje stejná byznys pravidla jako ruční vytvoření záznamu přes formulář.
 *
 * @security Validace probíhá jak při dry-run (`ImportController::validate()`), tak
 * ZNOVU při commitu (`ImportController::commit()`/`ImportRowsJob`) - nikdy se
 * nespoléhá na to, že mezi validací a zápisem se stav (např. existující záznamy pro
 * kontrolu duplicit) nezměnil.
 */

namespace App\Services\Import;

use Illuminate\Support\Facades\Validator;

class ImportRowValidator
{
    /**
     * @description Sestaví validační pravidla pro import - vezme `rules()` z dané
     * `Store*Request` třídy a omezí je jen na sloupce z `importable_columns` (pravidla
     * pro `attachments` a další nesloupcová pole se zahazují, protože import je čistě
     * datový, bez souborů).
     *
     * @param class-string $storeRequestClass
     * @param string[] $importableColumns
     * @return array<string, array>
     */
    public function buildRules(string $storeRequestClass, array $importableColumns): array
    {
        /** @var \Illuminate\Foundation\Http\FormRequest $instance */
        $instance = new $storeRequestClass();
        $allRules = method_exists($instance, 'rules') ? $instance->rules() : [];

        $filtered = [];
        foreach ($importableColumns as $column) {
            if (isset($allRules[$column])) {
                // 'required' pravidlo zůstává beze změny - import řádek BEZ povinné
                // hodnoty je stejně neplatný, jako by byl neplatný ruční formulář.
                $filtered[$column] = $allRules[$column];
            }
        }

        return $filtered;
    }

    /**
     * @description Zvaliduje jeden řádek. Vrací `null`, pokud je validní, jinak pole
     * chybových hlášek (klíč = sloupec).
     */
    public function validateRow(array $row, array $rules): ?array
    {
        $validator = Validator::make($row, $rules);

        if ($validator->fails()) {
            return $validator->errors()->toArray();
        }

        return null;
    }
}