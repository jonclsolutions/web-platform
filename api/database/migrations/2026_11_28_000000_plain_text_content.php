<?php
/**
 * @file 2026_11_28_000000_plain_text_content.php
 * @path api/database/migrations/2026_11_28_000000_plain_text_content.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The texts of the translations are plain text from now on (the website writes them
 *   as text, never as HTML). Turns the HTML of the stored translations of every module and
 *   language (storage/app/public/translations/<module>/<lang>.json - also texts edited in the
 *   admin and uploaded languages) into plain text: `<br>` → new line, paragraphs → empty line
 *   between them, other tags removed (PlainText). A file without HTML is not rewritten. The
 *   same for the content of the legal documents (document_sections.content) and the descriptions
 *   of the e-shop products - the website writes them as text now too.
 * @note Rows are read in chunks and only rows with "<" in the text are updated.
 * @note down() changes nothing - the HTML cannot be told from the text afterwards, and the
 *   website no longer reads it.
 * @note A file that is not valid JSON is left as it is (translations:sync reports it).
 * @dependencies PlainText
 */

use App\Support\I18n\PlainText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Rewrites every stored translation file whose texts contain HTML.
     * @return void
     */
    public function up(): void
    {
        foreach (File::glob(storage_path('app/public/translations/*/*.json')) as $path) {
            $data = json_decode(File::get($path), true);
            if (!is_array($data)) {
                continue;
            }
            $plain = PlainText::tree($data);
            if ($plain !== $data) {
                File::put($path, json_encode($plain, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }

        $this->plainColumns('document_sections', ['content']);
        $this->plainColumns('shop_products', ['description', 'description_en', 'short_description', 'short_description_en']);
    }

    /**
     * @description Turns the HTML of text columns of a table into plain text.
     * @param string $table Table (skipped when it does not exist - an application not installed).
     * @param array<int, string> $columns Text columns (the existing ones are used).
     * @return void
     */
    private function plainColumns(string $table, array $columns): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }
        $columns = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn($table, $column)));
        if ($columns === []) {
            return;
        }
        DB::table($table)
            ->where(function ($query) use ($columns) {
                foreach ($columns as $column) {
                    $query->orWhere($column, 'like', '%<%');
                }
            })
            ->chunkById(200, function ($rows) use ($table, $columns) {
                foreach ($rows as $row) {
                    $changes = [];
                    foreach ($columns as $column) {
                        if (is_string($row->{$column}) && ($plain = PlainText::fromHtml($row->{$column})) !== $row->{$column}) {
                            $changes[$column] = $plain;
                        }
                    }
                    if ($changes) {
                        DB::table($table)->where('id', $row->id)->update($changes);
                    }
                }
            });
    }

    /**
     * @description Nothing to undo (see the note of the file).
     * @return void
     */
    public function down(): void
    {
    }
};
