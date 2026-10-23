<?php

/**
 * @file ImportServicesTest.php
 * @path api/tests/Unit/Other/ImportServicesTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the shared import building blocks: ImportFileParser (formats,
 *   MIME check, headers, row limit, JSON shape), ImportRowValidator (rules of a store request)
 *   and the HandlesImportBatches trait (batch start, ownership, commit with guaranteed temp
 *   file cleanup), plus the stale-batch purge command.
 * @dependencies
 * - Tests\TestCase; Storage fake (local disk); Illuminate\Http\UploadedFile fakes.
 */

namespace Tests\Unit\Other;

use App\Models\Core\CoreImportBatch;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use App\Traits\HandlesImportBatches;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/**
 * @description App\Services\Import\*, App\Traits\HandlesImportBatches, imports:purge-stale.
 */
class ImportServicesTest extends TestCase
{
    /**
     * @description Fake disk of the temporary import files.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /**
     * @description Parses content with the given format and columns.
     * @param string $format csv / txt / json.
     * @param string $content File content.
     * @param string[] $columns Expected columns.
     * @param int $maxRows Row limit.
     * @return array{headers: string[], rows: array}
     */
    private function parse(string $format, string $content, array $columns = ['name', 'email'], int $maxRows = 10): array
    {
        return (new ImportFileParser())->parse(UploadedFile::fake()->createWithContent("f.{$format}", $content), $format, $columns, $maxRows);
    }

    /**
     * @description Asserts that parsing fails with a message containing the fragment.
     * @param string $fragment Expected message part.
     * @param callable $parse Parsing call.
     * @return void
     */
    private function assertParseError(string $fragment, callable $parse): void
    {
        try {
            $parse();
            $this->fail("Expected parser error '{$fragment}'.");
        } catch (RuntimeException $e) {
            $this->assertStringContainsString($fragment, $e->getMessage());
        }
    }

    /**
     * @description CSV (';') and TXT (tab): header in any order with spaces trimmed, empty cells
     *   → null, missing trailing cells → null, empty lines skipped.
     * @input CSV " email ;name" + 2 rows + empty line; TXT with one short row.
     * @output headers [email, name]; rows with null for empty / missing values.
     */
    public function test_delimited_files(): void
    {
        $csv = $this->parse('csv', " email ;name\na@b.cz;Ann\n;Bob\n\n");
        $this->assertSame(['email', 'name'], $csv['headers']);
        $this->assertSame([['email' => 'a@b.cz', 'name' => 'Ann'], ['email' => null, 'name' => 'Bob']], $csv['rows']);

        $txt = $this->parse('txt', "name\temail\nEve\n");
        $this->assertSame([['name' => 'Eve', 'email' => null]], $txt['rows']);
    }

    /**
     * @description JSON: array of objects; "" → null, numbers → strings, nested values JSON-encoded.
     * @input [{"name": "", "email": 5}, {"name": {"a": 1}, "email": null}].
     * @output [{name null, email '5'}, {name '{"a":1}', email null}].
     */
    public function test_json_files(): void
    {
        $rows = $this->parse('json', json_encode([['name' => '', 'email' => 5], ['name' => ['a' => 1], 'email' => null]]))['rows'];

        $this->assertSame([['name' => null, 'email' => '5'], ['name' => '{"a":1}', 'email' => null]], $rows);
    }

    /**
     * @description Every refusal of the parser with its message.
     * @input Unknown format; binary file as CSV; JSON '[]'; broken JSON; JSON string; JSON object;
     *        array of numbers; object + number; other headers; 3 rows with limit 2; unreadable file.
     * @output RuntimeException with the matching message each.
     */
    public function test_parser_errors(): void
    {
        $this->assertParseError('Unsupported file format: xml', fn () => $this->parse('xml', 'x'));
        $this->assertParseError("does not match the selected format 'csv'", fn () => (new ImportFileParser())->parse($this->fakeImage('p.png'), 'csv', ['name'], 5));
        $this->assertParseError('The file contains no data.', fn () => $this->parse('json', '[]'));
        $this->assertParseError('The file is not a valid JSON', fn () => $this->parse('json', '[{"name": }'));
        $this->assertParseError('must contain an array of records', fn () => $this->parse('json', '"text"'));
        $this->assertParseError('array of OBJECTS', fn () => $this->parse('json', '{"name": "a"}'));
        $this->assertParseError('array of OBJECTS', fn () => $this->parse('json', '[1, 2]'));
        $this->assertParseError('Each record in the JSON array must be an object.', fn () => $this->parse('json', '[{"name": "a", "email": "b"}, 3]'));
        $this->assertParseError('missing: email; extra: mail', fn () => $this->parse('csv', "name;mail\na;b\n"));
        $this->assertParseError('The file contains 3 rows, the maximum is 2.', fn () => $this->parse('csv', "name;email\na;b\nc;d\ne;f\n", ['name', 'email'], 2));

        $file = UploadedFile::fake()->createWithContent('f.csv', "name;email\n");
        $unreadable = new class ($file->getPathname()) extends UploadedFile {
            /** Real file for the MIME check, a missing one for reading. */
            public function __construct(string $path) { parent::__construct($path, 'f.csv', 'text/csv', null, true); }
            public function getRealPath(): string|false { return '/nonexistent/f.csv'; }
        };
        $this->assertParseError('Failed to open the file.', fn () => (new ImportFileParser())->parse($unreadable, 'csv', ['name', 'email'], 5));
    }

    /**
     * @description The row validator takes the rules of the importable columns from a store
     *   request (other rules and requests without rules() are ignored) and returns errors or null.
     * @input Request with rules {name required, email email, secret required}; columns [name, email, extra].
     * @output rules {name, email}; valid row null; invalid row errors for name / email; no-rules class [].
     */
    public function test_row_validator(): void
    {
        $validator = new ImportRowValidator();
        $request = new class extends FormRequest {
            /** Rules of a fake store request. */
            public function rules(): array { return ['name' => 'required|string', 'email' => 'nullable|email', 'secret' => 'required']; }
        };

        $rules = $validator->buildRules($request::class, ['name', 'email', 'extra']);
        $this->assertSame(['name' => 'required|string', 'email' => 'nullable|email'], $rules);
        $this->assertNull($validator->validateRow(['name' => 'Ann', 'email' => null], $rules));
        $this->assertSame(['name', 'email'], array_keys($validator->validateRow(['name' => '', 'email' => 'bad'], $rules)));
        $this->assertSame([], $validator->buildRules(\stdClass::class, ['name']));
    }

    /**
     * @description Object exposing the protected methods of HandlesImportBatches.
     * @return object
     */
    private function batches(): object
    {
        return new class {
            use HandlesImportBatches;

            /** Proxies a protected trait method. */
            public function __call(string $method, array $args): mixed
            {
                return $this->{$method}(...$args);
            }
        };
    }

    /**
     * @description Starting a batch stores the upload under imports/ and records it as
     *   'validated'; only the owner finds a pending batch; commit marks it completed with the
     *   counts and deletes the temp file; a failing commit marks it failed and still deletes the
     *   file; an expired file answers code 410.
     * @input Owner A uploads; A / B look it up; commit ok (3 / 1); second batch commit throws;
     *        third batch with its file removed.
     * @output temp file + batch; A finds it, B null, finished batch null; 'completed' + counts + no
     *   file; 'failed' + no file + exception rethrown; RuntimeException code 410.
     */
    public function test_handles_import_batches(): void
    {
        $owner = $this->user();
        $request = Request::create('/import', 'POST', [], [], ['file' => UploadedFile::fake()->createWithContent('people.csv', "name\nAnn\n")]);
        $request->setUserResolver(fn () => $owner);
        $trait = $this->batches();

        $batch = $trait->startImportBatch($request, 'test/people', 'csv', 4, 3, 1, [['row' => 3]]);
        $this->assertSame(['test/people', 'validated', 'people.csv', 4, 3, 1], [$batch->resource, $batch->status, $batch->original_filename, $batch->total_rows, $batch->valid_rows, $batch->invalid_rows]);
        $this->assertSame([['row' => 3]], $batch->fresh()->error_summary);
        $this->assertStringStartsWith('imports/', $batch->temp_path);
        Storage::disk('local')->assertExists($batch->temp_path);
        $this->assertSame("name\nAnn\n", Storage::disk('local')->get($batch->temp_path));
        $this->assertTrue($batch->user->is($owner));

        $stranger = Request::create('/');
        $stranger->setUserResolver(fn () => $this->user());
        $this->assertTrue($trait->findPendingImportBatch($request, $batch->id)->is($batch));
        $this->assertNull($trait->findPendingImportBatch($stranger, $batch->id));
        $this->assertNull($trait->findPendingImportBatch($request, 999));

        $result = $trait->runImportCommit($batch, function (UploadedFile $file) {
            $this->assertSame("name\nAnn\n", $file->getContent());
            $this->assertSame('people.csv', $file->getClientOriginalName());

            return ['imported_count' => 3, 'skipped_count' => 1];
        });
        $this->assertSame(['imported_count' => 3, 'skipped_count' => 1], $result);
        $batch->refresh();
        $this->assertSame(['completed', 3, 1], [$batch->status, $batch->imported_count, $batch->skipped_count]);
        $this->assertNotNull($batch->completed_at);
        Storage::disk('local')->assertMissing($batch->temp_path);
        $this->assertNull($trait->findPendingImportBatch($request, $batch->id));

        $failing = $trait->startImportBatch($request, 'test/people', 'csv', 1, 1, 0, []);
        try {
            $trait->runImportCommit($failing, fn () => throw new \LogicException('boom'));
            $this->fail('The commit exception must be rethrown.');
        } catch (\LogicException $e) {
            $this->assertSame('boom', $e->getMessage());
        }
        $this->assertSame('failed', $failing->fresh()->status);
        Storage::disk('local')->assertMissing($failing->temp_path);

        $expired = $trait->startImportBatch($request, 'test/people', 'csv', 1, 1, 0, []);
        Storage::disk('local')->delete($expired->temp_path);
        try {
            $trait->runImportCommit($expired, fn () => ['imported_count' => 0, 'skipped_count' => 0]);
            $this->fail('An expired file must be refused.');
        } catch (RuntimeException $e) {
            $this->assertSame(410, $e->getCode());
        }
        $this->assertSame('validated', $expired->fresh()->status);
    }

    /**
     * @description The purge command deletes validated / failed batches older than 4 hours with
     *   their temp files and keeps fresh, completed and processing ones.
     * @input Batches: validated 5 h (file), failed 5 h (no file), validated 1 h, completed 5 h, processing 5 h.
     * @output 2 deleted, file gone, output "Deleted 2 uncollected import batches.", 3 left.
     */
    public function test_purge_stale_batches_command(): void
    {
        $make = function (string $status, int $hoursAgo, ?string $path = null): CoreImportBatch {
            $batch = CoreImportBatch::create(['resource' => 'test', 'format' => 'csv', 'status' => $status, 'temp_path' => $path]);
            $batch->forceFill(['created_at' => now()->subHours($hoursAgo)])->save();

            return $batch;
        };
        Storage::disk('local')->put('imports/old.csv', 'x');
        $make('validated', 5, 'imports/old.csv');
        $make('failed', 5, 'imports/missing.csv');
        $keep = [$make('validated', 1)->id, $make('completed', 5)->id, $make('processing', 5)->id];

        $this->artisan('imports:purge-stale')->expectsOutput('Deleted 2 uncollected import batches.')->assertSuccessful();

        Storage::disk('local')->assertMissing('imports/old.csv');
        $this->assertSame($keep, CoreImportBatch::orderBy('id')->pluck('id')->all());
    }
}
