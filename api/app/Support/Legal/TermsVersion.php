<?php

/**
 * @file TermsVersion.php
 * @path app/Support/Legal/TermsVersion.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Version of the terms and conditions (legal document `tos`) a buyer agrees to:
 * the time of their last change and a fingerprint of their text - stored with an e-shop order
 * together with the time of the consent (audit U-04), so it can be proved which wording the
 * buyer accepted (Act No. 89/2012 Coll. § 1751; Directive 2011/83/EU art. 6 and 8).
 * @note The text of the order's language, or Czech when that language has none. `version` is the
 * last change (ISO 8601, UTC); `hash` the SHA-256 of the headings and texts in their order - an
 * edit of the terms changes both. Without a terms document both are null.
 * @dependencies DocumentType / DocumentSection (legal documents of the administration).
 */

namespace App\Support\Legal;

use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;

final class TermsVersion
{
    /** @description Slug of the terms and conditions among the legal documents. */
    public const SLUG = 'tos';

    /** @description Language used when the order's language has no terms text. */
    private const FALLBACK_LANG = 'cz';

    /**
     * @description Version and fingerprint of the terms in a language.
     * @param string $lang Language of the order (lower case).
     * @return array{version: ?string, hash: ?string}
     */
    public static function current(string $lang): array
    {
        $typeId = DocumentType::where('slug', self::SLUG)->value('id');
        if ($typeId === null) {
            return ['version' => null, 'hash' => null];
        }

        $sections = self::sections($typeId, $lang);
        if ($sections->isEmpty() && $lang !== self::FALLBACK_LANG) {
            $sections = self::sections($typeId, self::FALLBACK_LANG);
        }
        if ($sections->isEmpty()) {
            return ['version' => null, 'hash' => null];
        }

        $text = json_encode($sections->map(fn ($s) => [$s->heading, $s->content])->all(), JSON_UNESCAPED_UNICODE);
        $changed = $sections->max('updated_at') ?? $sections->max('created_at');

        return [
            'version' => $changed?->clone()->utc()->format('Y-m-d\TH:i:s\Z'),
            'hash'    => hash('sha256', (string) $text),
        ];
    }

    /**
     * @description Sections of the terms in one language, in their order.
     * @param int $typeId Id of the terms document.
     * @param string $lang Language.
     * @return \Illuminate\Support\Collection<int, DocumentSection>
     */
    private static function sections(int $typeId, string $lang)
    {
        return DocumentSection::where('document_type_id', $typeId)->where('lang', $lang)
            ->orderBy('position')->orderBy('id')->get(['heading', 'content', 'created_at', 'updated_at']);
    }
}
