<?php
/**
 * @file ImportFileParser.php
 * @path app/Services/Import/ImportFileParser.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Parses an uploaded import file (CSV / JSON / TXT) into associative rows. ONLY
 * parsing and structural checks (real content type, exact header match, row limit) - the
 * business validation of the values is done by `ImportRowValidator`.
 * @security The file type is checked by its REAL content (`finfo` / Symfony
 * `UploadedFile::getMimeType()`), NOT by the extension - anything can be uploaded as `.csv`.
 * @note The column headers MUST match `importable_columns` of the controller exactly (as a set) -
 * no fuzzy matching, no ignored extra / missing columns: ambiguous column mapping is the most
 * common cause of data silently written into the wrong field.
 */

namespace App\Services\Import;

use Illuminate\Http\UploadedFile;
use RuntimeException;

class ImportFileParser
{
    /** @description Supported formats and their expected MIME types (real content, not the extension). */
    private const ALLOWED_MIME_TYPES = [
        'csv'  => ['text/csv', 'text/plain', 'application/csv'],
        'txt'  => ['text/plain'],
        'json' => ['application/json', 'text/plain'],
    ];

    /**
     * @description Parses the file and returns the headers + raw rows. NO business validation of
     * the values - only structural checks (type, headers, row count).
     *
     * @param UploadedFile $file
     * @param string $format 'csv' | 'json' | 'txt'
     * @param string[] $expectedColumns Exact set of the expected columns.
     * @param int $maxRows Hard limit of data rows (without the header).
     * @return array{headers: string[], rows: array<int, array<string, string|null>>}
     * @throws RuntimeException On an invalid file type, a header mismatch or too many rows.
     */
    public function parse(UploadedFile $file, string $format, array $expectedColumns, int $maxRows): array
    {
        $this->assertRealMimeType($file, $format);

        $rows = match ($format) {
            'csv'  => $this->parseDelimited($file, ';'),
            'txt'  => $this->parseDelimited($file, "\t"),
            'json' => $this->parseJson($file),
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
     * @description Checks the real MIME type of the file against the expected format - never
     * trusts the extension or the client's `Content-Type` (both are easy to fake);
     * `UploadedFile::getMimeType()` detects the type from the REAL content (finfo).
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
     * @description Compares the file headers with the expected columns AS SETS (the order does
     * not matter, but none may be missing or extra).
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
     * @description Parses CSV / TXT (separator comma / tab) into associative rows; the first line
     * is always the header.
     */
    private function parseDelimited(UploadedFile $file, string $delimiter): array
    {
        // `@`: Laravel turns the PHP warning of a failed fopen() into an ErrorException (500),
        // the check below is meant to answer with the readable message instead.
        $handle = @fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw new RuntimeException('Failed to open the file.');
        }

        try {
            // An empty file never gets here (its MIME type is application/x-empty), so the
            // header line always exists; `?: []` only keeps the types safe.
            $header = array_map('trim', fgetcsv($handle, 0, $delimiter) ?: []);

            $rows = [];
            while (($line = fgetcsv($handle, 0, $delimiter)) !== false) {
                // Skip completely empty lines (usually the last line of the file).
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
     * @description Parses JSON - expects an array of objects `[{ "column": "value", ... }, ...]`.
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

        // Empty string -> null (same normalization as CSV / TXT in combineRow()): JSON can carry a real
        // `null`, but an export / manual edit may write `""` - the behaviour must be the same for all
        // three formats.
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
     * @description Combines the header and the values of a row into an associative array. A row
     * with a different number of values than the header (common in hand-edited CSV) gets the
     * missing values as `null` and the extra ones dropped - the exact column match is enforced
     * separately in `assertHeadersMatch()`, this only prevents a crash on a short / long row.
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