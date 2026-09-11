<?php
/**
 * @file ImportFileParser.php
 * @path app/Services/Import/ImportFileParser.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Parsuje nahraný importní soubor (CSV/JSON/TXT) do pole asociativních
 * řádků. Řeší VÝHRADNĚ parsování a strukturální kontrolu (skutečný typ obsahu, striktní
 * shoda hlaviček, limit počtu řádků) - byznys validaci jednotlivých hodnot řeší
 * `ImportRowValidator`.
 *
 * @refactor-note (2026-08-23) XLSX PODPORA ODEBRÁNA. Čtení binárního .xlsx formátu
 * vyžadovalo `phpoffice/phpspreadsheet`, který má tvrdou závislost na PHP rozšíření
 * `ext-gd` - na některých hostinzích (sdílený hosting bez možnosti měnit PHP moduly,
 * lokální XAMPP bez ručně zapnutého `gd`) to zbytečně komplikovalo nasazení kvůli
 * jedinému formátu, který má plnohodnotnou náhradu (CSV umí uložit z Excelu/Sheets
 * jedním kliknutím). CSV/JSON/TXT fungují čistě přes nativní PHP, BEZ JAKÉKOLIV
 * composer závislosti - pro ty tahle změna nic nemění.
 *
 * @security Typ souboru se ověřuje podle SKUTEČNÉHO obsahu (`finfo`/Symfony
 * `UploadedFile::getMimeType()`), NE podle přípony - útočník může nahrát cokoliv
 * s příponou `.csv`.
 *
 * @note Hlavičky sloupců MUSÍ přesně (jako množina) odpovídat `importable_columns`
 * daného kontroleru - žádné fuzzy matchování, žádné ignorování navíc/chybějících
 * sloupců. Důvod: nejednoznačné mapování sloupců je nejčastější příčina tichého
 * zapsání dat do špatného pole při hromadných importech - radši tvrdé odmítnutí
 * s jasnou hláškou než hádání.
 */

namespace App\Services\Import;

use Illuminate\Http\UploadedFile;
use RuntimeException;

class ImportFileParser
{
    /** @description Podporované formáty a jejich očekávané MIME typy (skutečný obsah, ne přípona). */
    private const ALLOWED_MIME_TYPES = [
        'csv'  => ['text/csv', 'text/plain', 'application/csv'],
        'txt'  => ['text/plain'],
        'json' => ['application/json', 'text/plain'],
    ];

    /**
     * @description Parsuje soubor a vrátí hlavičky + syrové řádky. Neprovádí ŽÁDNOU
     * byznys validaci hodnot - jen strukturální kontrolu (typ, hlavičky, počet řádků).
     *
     * @param UploadedFile $file
     * @param string $format 'csv' | 'json' | 'txt'
     * @param string[] $expectedColumns Přesná množina očekávaných sloupců.
     * @param int $maxRows Tvrdý strop počtu datových řádků (bez hlavičky).
     * @return array{headers: string[], rows: array<int, array<string, string|null>>}
     * @throws RuntimeException Při neplatném typu souboru, neshodě hlaviček nebo překročení limitu řádků.
     */
    public function parse(UploadedFile $file, string $format, array $expectedColumns, int $maxRows): array
    {
        $this->assertRealMimeType($file, $format);

        $rows = match ($format) {
            'csv'  => $this->parseDelimited($file, ';'),
            'txt'  => $this->parseDelimited($file, "\t"),
            'json' => $this->parseJson($file),
            default => throw new RuntimeException("Unsupported file format: {$format}"),
        };

        if (empty($rows)) {
            throw new RuntimeException('The file contains no data.');
        }

        $headers = array_keys($rows[0]);
        $this->assertHeadersMatch($headers, $expectedColumns);

        $dataRowCount = count($rows);
        if ($dataRowCount > $maxRows) {
            throw new RuntimeException(
                "The file contains {$dataRowCount} rows, the maximum is {$maxRows}. Please split the import into multiple files."
            );
        }

        return ['headers' => $headers, 'rows' => $rows];
    }

    /**
     * @description Ověří skutečný MIME typ souboru proti očekávanému formátu -
     * nikdy nespoléhá na příponu ani na `Content-Type` hlavičku poslanou klientem
     * (obojí lze snadno zfalšovat), `UploadedFile::getMimeType()` detekuje typ ze
     * SKUTEČNÉHO obsahu souboru (finfo).
     */
    private function assertRealMimeType(UploadedFile $file, string $format): void
    {
        $allowed = self::ALLOWED_MIME_TYPES[$format] ?? null;
        if ($allowed === null) {
            throw new RuntimeException("Unsupported file format: {$format}");
        }

        $actualMime = $file->getMimeType();
        if (!in_array($actualMime, $allowed, true)) {
            throw new RuntimeException(
                "The file does not match the selected format '{$format}' (detected type: {$actualMime}). "
                . 'Please check that you selected the correct format and that the file is not corrupted.'
            );
        }
    }

    /**
     * @description Porovná hlavičky souboru s očekávanou množinou sloupců JAKO
     * MNOŽINY (pořadí sloupců v souboru nevadí, ale nesmí chybět ani přebývat).
     */
    private function assertHeadersMatch(array $actualHeaders, array $expectedColumns): void
    {
        $actual = array_map('trim', $actualHeaders);
        sort($actual);
        $expected = $expectedColumns;
        sort($expected);

        if ($actual !== $expected) {
            $missing = array_diff($expected, $actual);
            $extra = array_diff($actual, $expected);
            $parts = [];
            if (!empty($missing)) $parts[] = 'missing: ' . implode(', ', $missing);
            if (!empty($extra)) $parts[] = 'extra: ' . implode(', ', $extra);

            throw new RuntimeException(
                'The column headers in the file do not match the expected format (' . implode('; ', $parts) . '). '
                . 'Please use the downloaded template.'
            );
        }
    }

    /**
     * @description Parsuje CSV/TXT (oddělovač čárka/tab) do pole asociativních řádků,
     * první řádek souboru je vždy hlavička.
     */
    private function parseDelimited(UploadedFile $file, string $delimiter): array
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw new RuntimeException('Failed to open the file.');
        }

        try {
            $header = fgetcsv($handle, 0, $delimiter);
            if ($header === false) {
                return [];
            }
            $header = array_map('trim', $header);

            $rows = [];
            while (($line = fgetcsv($handle, 0, $delimiter)) !== false) {
                // Přeskočit zcela prázdné řádky (typicky poslední prázdný řádek souboru).
                if (count($line) === 1 && ($line[0] === null || trim((string) $line[0]) === '')) {
                    continue;
                }
                $rows[] = $this->combineRow($header, $line);
            }

            return $rows;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @description Parsuje JSON - očekává pole objektů `[{ "sloupec": "hodnota", ... }, ...]`.
     */
    private function parseJson(UploadedFile $file): array
    {
        $content = file_get_contents($file->getRealPath());
        $decoded = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('The file is not a valid JSON: ' . json_last_error_msg());
        }
        if (!is_array($decoded)) {
            throw new RuntimeException('The JSON file must contain an array of records ([{...}, {...}]).');
        }
        if (empty($decoded)) {
            return [];
        }
        if (!is_array($decoded[0] ?? null)) {
            throw new RuntimeException('The JSON file must contain an array of OBJECTS, not an array of primitive values.');
        }

        // Prázdný string -> null (stejná normalizace jako u CSV/TXT v combineRow(),
        // viz jeho bugfix-note) - JSON sice UMÍ nést skutečné `null`, ale pokud ho
        // export/ruční úprava zapíše jako `""`, chováni musí být konzistentní napříč
        // všemi třemi formáty.
        return array_map(function ($item) {
            if (!is_array($item)) {
                throw new RuntimeException('Each record in the JSON array must be an object.');
            }
            return array_map(function ($v) {
                if ($v === null || $v === '') return null;
                return is_scalar($v) ? (string) $v : json_encode($v);
            }, $item);
        }, $decoded);
    }

    /**
     * @description Spojí hlavičku a hodnoty řádku do asociativního pole. Pokud má
     * datový řádek jiný počet sloupců než hlavička (běžné u ručně upravovaných CSV),
     * chybějící hodnoty se doplní jako `null`, přebytečné se zahodí - přesná shoda
     * SLOUPCŮ (hlaviček) je vynucena zvlášť v `assertHeadersMatch()`, tohle je jen
     * ochrana proti pádu na neshodě počtu hodnot v jednotlivém řádku.
     *
     * @bugfix-note (2026-08-23) PRÁZDNÝ STRING SE NORMALIZUJE NA `null`. CSV/TXT nemá
     * koncept "chybějící hodnoty" - prázdná buňka se vždy parsuje jako `""`, ne `null`.
     * Laravel validační pravidlo `nullable` ale bere `nullable` DOSLOVA jako `is_null()`,
     * ne jako "cokoliv prázdné" - pole s pravidlem `nullable|regex:...` by tak prázdný
     * string `""` NEPŘESKOČILO a spadlo by na regexu (např. `contact_phone` u
     * WebRawRequestCommission), zatímco skutečné `null` (jak vypadala PŮVODNÍ hodnota
     * v DB před exportem) by v pořádku prošlo. Bez týhle normalizace by se export
     * záznamu s prázdným nepovinným polem a jeho následný zpětný import choval jinak
     * než původní data - tichý, matoucí rozdíl mezi "export/import kolo dokola" a
     * realitou.
     */
    private function combineRow(array $header, array $values): array
    {
        $row = [];
        foreach ($header as $i => $col) {
            $value = array_key_exists($i, $values) ? $values[$i] : null;
            $row[$col] = ($value === '') ? null : $value;
        }
        return $row;
    }
}