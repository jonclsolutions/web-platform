<?php

/**
 * @file DocumentCheck.php
 * @path app/Apps/JsCreator/Support/DocumentCheck.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation of a document sent by the editor of a template or a block:
 *   TemplateDocument (shape, ranges, fields; block instances only in a template) and the
 *   ownership of what it refers to - library images and own fonts of the account, blocks of the
 *   account in the same section outside the trash. Another account's id is reported exactly
 *   like an id that does not exist.
 * @usage `$checked = DocumentCheck::validate($request->document(), $userId, $section, true)`.
 * @dependencies TemplateDocument, CreatorAsset, CreatorFont, CreatorBlock.
 */

namespace App\Apps\JsCreator\Support;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use Illuminate\Validation\ValidationException;

final class DocumentCheck
{
    /**
     * @description Validates a document and the ownership of the images, fonts and blocks it uses.
     * @param mixed $document Document of the request.
     * @param int $userId Owner.
     * @param string $section Section of the template / block.
     * @param bool $allowBlocks Document of a template (true) or of a block (false).
     * @return TemplateDocument The checked document.
     * @throws ValidationException 422 with the paths of the errors (`document.…`).
     */
    public static function validate(mixed $document, int $userId, string $section, bool $allowBlocks): TemplateDocument
    {
        $checked = TemplateDocument::check($document, $allowBlocks);
        $errors = $checked->errors();
        if ($errors === []) {
            $assets = CreatorAsset::query()->ownedBy($userId)->whereIn('id', $checked->assetIds())->pluck('id')->all();
            foreach (array_diff($checked->assetIds(), $assets) as $missing) {
                $errors[$checked->pathOf('asset', $missing)] = 'The image is not in your library.';
            }
            $fonts = CreatorFont::query()->ownedBy($userId)->whereIn('id', $checked->fontIds())->pluck('id')->all();
            foreach (array_diff($checked->fontIds(), $fonts) as $missing) {
                $errors[$checked->pathOf('font', $missing)] = 'The font is not among your fonts.';
            }
            $blocks = CreatorBlock::query()->ownedBy($userId)->where('section', $section)->whereIn('id', $checked->blockIds())->pluck('id')->all();
            foreach (array_diff($checked->blockIds(), $blocks) as $missing) {
                $errors[$checked->pathOf('block', $missing)] = 'The block is not among your blocks (or it is in the trash).';
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $checked;
    }
}
