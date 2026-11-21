<?php

/**
 * @file WebContentMissing.php
 * @path app/Apps/Web/Services/WebContentMissing.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Content of the website stored in the database whose text is missing in an active
 * language - per tab of the admin page Texty webu (FAQ, open positions, references, knowledge
 * base). Feeds the orange attention numbers of WebNotificationSource and of the page tabs.
 * @note Counted are records the visitors can see (FAQ always; positions, references and
 * knowledge-base blocks while active, with their sub-records). A record is missing a text when
 * one of its texts is written in at least one language but empty in an active language - an
 * optional text nobody wrote counts nothing. Inactive languages are not counted.
 * @dependencies TranslationController::activeLanguageCodes(), the Web content models.
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebFaqCategory;
use App\Apps\Web\Models\WebFaqItem;
use App\Apps\Web\Models\WebJob;
use App\Apps\Web\Models\WebJobSection;
use App\Apps\Web\Models\WebKbItem;
use App\Apps\Web\Models\WebKbSection;
use App\Apps\Web\Models\WebReference;
use App\Apps\Web\Models\WebReferenceFeature;
use App\Apps\Web\Models\WebReferenceStack;
use App\Http\Controllers\Api\TranslationController;
use Illuminate\Database\Eloquent\Builder;

final class WebContentMissing
{
    /** @description Translation module of the website (its languages). */
    private const MODULE = 'web';

    /**
     * @description Records missing a text in an active language, per tab of the content.
     * @return array{faq: int, jobs: int, references: int, knowledge_base: int}
     */
    public static function counts(): array
    {
        $languages = array_values(array_unique(array_map('strtolower', TranslationController::activeLanguageCodes(self::MODULE))));
        $activeJobs = WebJob::where('is_active', true)->pluck('id');
        $activeReferences = WebReference::where('is_active', true)->pluck('id');
        $activeSections = WebKbSection::where('is_active', true)->pluck('id');

        return [
            'faq' => self::count(WebFaqCategory::query(), ['name_i18n'], $languages)
                + self::count(WebFaqItem::query(), ['question_i18n', 'answer_i18n'], $languages),
            'jobs' => self::count(WebJob::where('is_active', true), ['title_i18n', 'summary_i18n', 'type_i18n', 'location_i18n'], $languages)
                + self::count(WebJobSection::whereIn('job_id', $activeJobs), ['heading_i18n', 'body_i18n'], $languages),
            'references' => self::count(WebReference::where('is_active', true), ['category_i18n', 'name_i18n', 'size_i18n', 'role_i18n', 'description_i18n', 'result_i18n'], $languages)
                + self::count(WebReferenceFeature::whereIn('reference_id', $activeReferences), ['text_i18n'], $languages)
                + self::count(WebReferenceStack::whereIn('reference_id', $activeReferences), ['label_i18n', 'value_i18n'], $languages),
            'knowledge_base' => self::count(WebKbSection::where('is_active', true), ['heading_i18n', 'text_i18n'], $languages)
                + self::count(WebKbItem::whereIn('section_id', $activeSections), ['title_i18n', 'text_i18n'], $languages),
        ];
    }

    /**
     * @description Records of the query missing a text in one of the languages.
     * @param Builder $query Records the visitors can see.
     * @param array<int, string> $fields Text columns (`{ lang: text }`).
     * @param array<int, string> $languages Active language codes (lower case).
     * @return int
     */
    private static function count(Builder $query, array $fields, array $languages): int
    {
        if ($languages === []) {
            return 0;
        }

        return $query->get(['id', ...$fields])
            ->filter(fn ($record) => self::missesText($record, $fields, $languages))
            ->count();
    }

    /**
     * @description Whether a text written in some language is empty in one of the active ones.
     * @param object $record Record with the text columns cast to arrays.
     * @param array<int, string> $fields Text columns.
     * @param array<int, string> $languages Active language codes (lower case).
     * @return bool
     */
    private static function missesText(object $record, array $fields, array $languages): bool
    {
        foreach ($fields as $field) {
            $texts = array_change_key_case(is_array($record->{$field}) ? $record->{$field} : [], CASE_LOWER);
            $written = array_filter($texts, fn ($text) => is_string($text) && trim($text) !== '');
            if ($written === []) {
                continue;
            }
            foreach ($languages as $language) {
                if (!isset($written[$language])) {
                    return true;
                }
            }
        }

        return false;
    }
}
