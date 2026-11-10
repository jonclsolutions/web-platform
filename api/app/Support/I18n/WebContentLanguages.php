<?php

/**
 * @file WebContentLanguages.php
 * @path app/Support/I18n/WebContentLanguages.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Languages of the content of the public website stored in the database (FAQ, open
 * positions - `*_i18n` JSON columns): the languages a text may be saved in (the languages of the
 * web module, languages.json) and the removal of every text of a deleted language, so no text of a
 * language that no longer exists stays on the server.
 * @note Called by TranslationController when a web language is deleted / left out of the list;
 * WebFaqController / WebJobController keep only the codes() when saving (an admin page opened
 * before a language was deleted cannot store it again).
 * @dependencies TranslationController::languageCodes(), WebFaqCategory, WebFaqItem, WebJob,
 *   WebJobSection.
 */

namespace App\Support\I18n;

use App\Http\Controllers\Api\TranslationController;
use App\Models\Web\WebFaqCategory;
use App\Models\Web\WebFaqItem;
use App\Models\Web\WebJob;
use App\Models\Web\WebJobSection;
use Illuminate\Support\Facades\DB;

final class WebContentLanguages
{
    /** @description Model => its text columns per language. */
    private const COLUMNS = [
        WebFaqCategory::class => ['name_i18n'],
        WebFaqItem::class     => ['question_i18n', 'answer_i18n'],
        WebJob::class         => ['title_i18n', 'summary_i18n', 'type_i18n', 'location_i18n'],
        WebJobSection::class  => ['heading_i18n', 'body_i18n'],
    ];

    /**
     * @description Language codes the web content may be stored in.
     * @return string[]
     */
    public static function codes(): array
    {
        return TranslationController::languageCodes('web');
    }

    /**
     * @description Removes the texts of a language from all web content.
     * @param string $code Language code of the deleted language.
     * @return int Number of changed rows.
     */
    public static function forget(string $code): int
    {
        $code = strtolower($code);
        $changed = 0;

        DB::transaction(function () use ($code, &$changed) {
            foreach (self::COLUMNS as $model => $columns) {
                foreach ($model::query()->get() as $row) {
                    $dirty = false;
                    foreach ($columns as $column) {
                        $texts = $row->{$column} ?? [];
                        if (is_array($texts) && array_key_exists($code, $texts)) {
                            unset($texts[$code]);
                            $row->{$column} = $texts;
                            $dirty = true;
                        }
                    }
                    if ($dirty) {
                        $row->save();
                        $changed++;
                    }
                }
            }
        });

        return $changed;
    }
}
