<?php

/**
 * @file PlainTextContentTest.php
 * @path api/tests/Integration/PlainTextContentTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts the website writes are stored as plain text: the content of a legal document
 *   section and the descriptions of a product are saved without HTML, and the migration
 *   2026_11_28_000000_plain_text_content turns the HTML of the stored translations and rows into
 *   plain text (files without HTML untouched, invalid JSON left as it is).
 * @dependencies DocumentSection, DocumentType, ShopProduct, the migration file, temporary storage.
 */

namespace Tests\Integration;

use App\Apps\Shop\Models\ShopProduct;
use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class PlainTextContentTest extends TestCase
{
    /** @var string Temporary storage folder. */
    private string $storage;

    /**
     * @description Points storage_path() to an empty temporary folder.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/jsw-plain-' . uniqid();
        File::makeDirectory($this->storage . '/app/public/translations/web', 0755, true);
        $this->app->useStoragePath($this->storage);
    }

    /**
     * @description Removes the temporary storage folder.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory($this->storage);
        parent::tearDown();
    }

    /**
     * @description Saving a legal section and a product keeps only plain text.
     * @input section content '<p>A</p><p>B<br>C</p><script>x</script>'; product description
     *   '<b>Hrnek</b><br>keramika', short '<i>krátce</i>'
     * @output "A\n\nB\nCx"; "Hrnek\nkeramika"; 'krátce'
     */
    public function test_models_store_plain_text(): void
    {
        $type = DocumentType::create(['slug' => 'gdpr', 'title' => 'GDPR']);
        $section = DocumentSection::create(['document_type_id' => $type->id, 'position' => 0, 'heading' => 'Úvod', 'content' => '<p>A</p><p>B<br>C</p><script>x</script>', 'lang' => 'cz']);
        $this->assertSame("A\n\nB\nCx", $section->fresh()->content);

        $product = ShopProduct::create(['name' => 'Hrnek', 'slug' => 'hrnek', 'stock_quantity' => 1, 'description' => '<b>Hrnek</b><br>keramika', 'short_description' => '<i>krátce</i>']);
        $this->assertSame(["Hrnek\nkeramika", 'krátce'], [$product->fresh()->description, $product->fresh()->short_description]);
    }

    /**
     * @description The migration: translation files with HTML are rewritten as plain text, files
     *   without HTML and invalid JSON stay byte for byte; rows of the legal sections and the
     *   products with HTML (written past the models) become plain text.
     * @input web/cz.json {hero.heading 'A<br>B', text '<p>X</p><p>Y</p>'}; web/en.json plain
     *   (own formatting); web/de.json invalid; a section and a product updated with HTML in SQL
     * @output cz.json {heading "A\nB", text "X\n\nY"}; en.json, de.json unchanged; rows plain
     */
    public function test_migration_turns_stored_html_into_plain_text(): void
    {
        $dir = $this->storage . '/app/public/translations/web';
        File::put("$dir/cz.json", json_encode(['hero' => ['heading' => 'A<br>B'], 'text' => '<p>X</p><p>Y</p>']));
        File::put("$dir/en.json", "{\"a\":  \"plain\"}");
        File::put("$dir/de.json", '{not json');
        $type = DocumentType::create(['slug' => 'tos', 'title' => 'ToS']);
        $section = DocumentSection::create(['document_type_id' => $type->id, 'position' => 0, 'heading' => 'H', 'content' => 'x', 'lang' => 'cz']);
        $product = ShopProduct::create(['name' => 'P', 'slug' => 'p', 'stock_quantity' => 1, 'description' => 'x']);
        DB::table('document_sections')->where('id', $section->id)->update(['content' => 'Řádek<br/>další']);
        DB::table('shop_products')->where('id', $product->id)->update(['description' => '<p>Jedna</p><p>Dvě</p>']);

        (require database_path('migrations/2026_11_28_000000_plain_text_content.php'))->up();

        $this->assertSame(['hero' => ['heading' => "A\nB"], 'text' => "X\n\nY"], json_decode(File::get("$dir/cz.json"), true));
        $this->assertSame("{\"a\":  \"plain\"}", File::get("$dir/en.json"));
        $this->assertSame('{not json', File::get("$dir/de.json"));
        $this->assertSame("Řádek\ndalší", DB::table('document_sections')->where('id', $section->id)->value('content'));
        $this->assertSame("Jedna\n\nDvě", DB::table('shop_products')->where('id', $product->id)->value('description'));
    }
}
