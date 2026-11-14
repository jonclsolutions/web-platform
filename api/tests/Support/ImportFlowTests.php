<?php

/**
 * @file ImportFlowTests.php
 * @path api/tests/Support/ImportFlowTests.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared feature tests of the bulk import of one resource (core HandlesImportBatches):
 *   template download, validation (dry run) and commit. The test class of an application lists its
 *   importable resources in `resources()` and names its audit log in `assertImportLog()`.
 * @dependencies Tests\TestCase (signIn, userWith, failOn), Tests\Support\CommonFixtures
 *   (importFile); Storage fake 'local' (temporary import files) set up by the
 *   test class.
 */

namespace Tests\Support;

use App\Models\Core\CoreImportBatch;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * @description Used by the import tests of the applications (one data set per resource).
 */
trait ImportFlowTests
{
    /**
     * @description The importable resources: endpoint, create permission, columns, one valid
     *   row, one invalid row, model class, template file name.
     * @return array<string, array{0: string, 1: string, 2: string[], 3: array, 4: array, 5: class-string, 6: string}>
     */
    abstract public static function resources(): array;

    /**
     * @description Asserts an entry in the audit log of the application of the resource.
     * @param string $eventType Event type.
     * @param string $descriptionContains Part of the description.
     * @return void
     */
    abstract protected function assertImportLog(string $eventType, string $descriptionContains): void;

    /**
     * @description Builds a ';' separated CSV from rows (header = keys of the first row).
     * @param array<int, array<string, string>> $rows Rows.
     * @return string CSV text.
     */
    private function csv(array $rows): string
    {
        $lines = [implode(';', array_keys($rows[0]))];
        foreach ($rows as $row) {
            $lines[] = implode(';', $row);
        }

        return implode("\n", $lines) . "\n";
    }

    /**
     * @description The template has exactly the importable columns, in CSV (';'), TXT (tab)
     *   and JSON; another format is refused; the create permission is required.
     * @input GET import/template ?format=csv|txt|json|xml, without permission.
     * @output Header lines / one empty JSON record, download file names; 422; 403.
     */
    #[DataProvider('resources')]
    public function test_template(string $endpoint, string $permission, array $columns, array $valid, array $invalid, string $model, string $file): void
    {
        $this->signIn($this->user());
        $this->get("/api/{$endpoint}/import/template", ['Accept' => 'application/json'])->assertStatus(403);

        $this->signIn($this->userWith([$permission]));
        $this->get("/api/{$endpoint}/import/template")->assertOk()
            ->assertHeader('Content-Disposition', "attachment; filename=\"{$file}.csv\"")
            ->assertContent(implode(';', $columns) . "\n");
        $this->get("/api/{$endpoint}/import/template?format=txt")->assertOk()->assertContent(implode("\t", $columns) . "\n");
        $json = $this->get("/api/{$endpoint}/import/template?format=json")->assertOk()
            ->assertHeader('Content-Disposition', "attachment; filename=\"{$file}.json\"")->getContent();
        $this->assertSame([array_fill_keys($columns, '')], json_decode($json, true));
        $this->getJson("/api/{$endpoint}/import/template?format=xml")->assertStatus(422);
    }

    /**
     * @description The downloaded CSV template can be imported back once rows are added
     *   (same delimiter in template and parser).
     * @input Template CSV + one valid row, import/validate.
     * @output 200 {valid_rows: 1, invalid_rows: 0}.
     */
    #[DataProvider('resources')]
    public function test_template_round_trip(string $endpoint, string $permission, array $columns, array $valid): void
    {
        $this->signIn($this->userWith([$permission]));
        $template = $this->get("/api/{$endpoint}/import/template")->getContent();

        $this->post("/api/{$endpoint}/import/validate", [
            'format' => 'csv', 'file' => $this->importFile('csv', $template . implode(';', $valid) . "\n"),
        ], ['Accept' => 'application/json'])->assertOk()->assertJson(['data' => ['valid_rows' => 1, 'invalid_rows' => 0]]);
    }

    /**
     * @description Validation (dry run): counts valid and invalid rows, lists the errors with
     *   the file row number, stores the file temporarily and creates a 'validated' batch -
     *   nothing is imported yet.
     * @input CSV with one valid and one invalid row.
     * @output 200 {import_token, total 2, valid 1, invalid 1, errors[0].row 3, can_commit};
     *   batch 'validated'; temp file exists; no records.
     */
    #[DataProvider('resources')]
    public function test_validate(string $endpoint, string $permission, array $columns, array $valid, array $invalid, string $model): void
    {
        $this->signIn($this->userWith([$permission]));

        $response = $this->post("/api/{$endpoint}/import/validate", [
            'format' => 'csv', 'file' => $this->importFile('csv', $this->csv([$valid, $invalid])),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJson(['data' => ['total_rows' => 2, 'valid_rows' => 1, 'invalid_rows' => 1, 'can_commit' => true]])
            ->assertJsonPath('data.errors.0.row', 3);

        $batch = CoreImportBatch::findOrFail($response->json('data.import_token'));
        $this->assertSame('validated', $batch->status);
        $this->assertSame($endpoint, $batch->resource);
        Storage::disk('local')->assertExists($batch->temp_path);
        $this->assertSame(0, $model::count());
    }

    /**
     * @description Validation refuses a missing file / unknown format and a file the parser
     *   rejects (wrong header) with the parser's message.
     * @input POST {} ; JSON file with other keys.
     * @output 422 errors format/file; 422 "The column headers in the file do not match…".
     */
    #[DataProvider('resources')]
    public function test_validate_rejects_bad_input(string $endpoint, string $permission): void
    {
        $this->signIn($this->userWith([$permission]));

        $this->postJson("/api/{$endpoint}/import/validate", [])->assertStatus(422)->assertJsonValidationErrors(['format', 'file']);
        $this->post("/api/{$endpoint}/import/validate", [
            'format' => 'json', 'file' => $this->importFile('json', json_encode([['foo' => 'bar']])),
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'column headers in the file do not match'));
    }

    /**
     * @description Commit imports only the valid rows, completes the batch, deletes the
     *   temporary file and logs the import; the same batch cannot be committed twice.
     * @input Validated batch (1 valid + 1 invalid row), POST import/commit {import_token} twice.
     * @output 200 {imported 1, skipped 1}; one record; batch 'completed'; file gone; audit log
     *   'import'; second commit 404.
     */
    #[DataProvider('resources')]
    public function test_commit(string $endpoint, string $permission, array $columns, array $valid, array $invalid, string $model): void
    {
        $this->signIn($this->userWith([$permission]));
        $token = $this->post("/api/{$endpoint}/import/validate", [
            'format' => 'json', 'file' => $this->importFile('json', json_encode([$valid, $invalid])),
        ], ['Accept' => 'application/json'])->json('data.import_token');

        $this->postJson("/api/{$endpoint}/import/commit", ['import_token' => $token])->assertOk()
            ->assertJson(['data' => ['queued' => false, 'imported_count' => 1, 'skipped_count' => 1, 'skip_reasons' => []]]);

        $this->assertSame(1, $model::count());
        $batch = CoreImportBatch::find($token);
        $this->assertSame('completed', $batch->status);
        $this->assertNotNull($batch->completed_at);
        Storage::disk('local')->assertMissing($batch->temp_path);
        $this->assertImportLog('import', "file 'import.json'");
        $this->postJson("/api/{$endpoint}/import/commit", ['import_token' => $token])->assertStatus(404);
        $this->postJson("/api/{$endpoint}/import/commit", [])->assertStatus(422);
    }

    /**
     * @description A batch of another account cannot be committed; an expired temporary file
     *   answers 410; a database error fails the batch, deletes the file and answers 500.
     * @input Batch of another user; batch whose file was removed; batch with the table INSERT failing.
     * @output 404; 410 "has expired"; 500 "Import failed." + batch 'failed' + audit log 'error'.
     */
    #[DataProvider('resources')]
    public function test_commit_failures(string $endpoint, string $permission, array $columns, array $valid, array $invalid, string $model): void
    {
        $this->signIn($this->userWith([$permission]));
        $foreign = $this->post("/api/{$endpoint}/import/validate", ['format' => 'csv', 'file' => $this->importFile('csv', $this->csv([$valid]))], ['Accept' => 'application/json'])->json('data.import_token');

        $this->signIn($this->userWith([$permission]));
        $this->postJson("/api/{$endpoint}/import/commit", ['import_token' => $foreign])->assertStatus(404);

        $expired = $this->post("/api/{$endpoint}/import/validate", ['format' => 'csv', 'file' => $this->importFile('csv', $this->csv([$valid]))], ['Accept' => 'application/json'])->json('data.import_token');
        Storage::disk('local')->delete(CoreImportBatch::find($expired)->temp_path);
        $this->postJson("/api/{$endpoint}/import/commit", ['import_token' => $expired])
            ->assertStatus(410)->assertJsonPath('message', fn ($m) => str_contains($m, 'has expired'));

        $broken = $this->post("/api/{$endpoint}/import/validate", ['format' => 'txt', 'file' => $this->importFile('txt', implode("\t", array_keys($valid)) . "\n" . implode("\t", $valid) . "\n")], ['Accept' => 'application/json'])->json('data.import_token');
        $this->failOn((new $model())->getTable(), 'INSERT');
        $this->postJson("/api/{$endpoint}/import/commit", ['import_token' => $broken])
            ->assertStatus(500)->assertJson(['message' => 'Import failed.']);
        $this->assertSame('failed', CoreImportBatch::find($broken)->status);
        Storage::disk('local')->assertMissing(CoreImportBatch::find($broken)->temp_path);
        $this->assertImportLog('error', 'Error during import');
    }
}
