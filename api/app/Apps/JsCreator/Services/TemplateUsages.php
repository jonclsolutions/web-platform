<?php
/**
 * @file TemplateUsages.php
 * @path app/Apps/JsCreator/Services/TemplateUsages.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Usages of library images and own fonts by templates (js_creator_usages):
 *   - sync() keeps the rows of a template equal to its document (after every save / copy);
 *   - usedBy() lists the templates using a file (trash included) for the library, which refuses
 *     to delete a used file (InUseException) and shows where it is used.
 * @dependencies CreatorUsage, CreatorTemplate.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use Illuminate\Support\Collection;

final class TemplateUsages
{
    /**
     * @description Replaces the usages of a template.
     * @param CreatorTemplate $template Template.
     * @param int[] $assetIds Library images of its document.
     * @param int[] $fontIds Own fonts of its document.
     * @return void
     */
    public static function sync(CreatorTemplate $template, array $assetIds, array $fontIds): void
    {
        $template->usages()->delete();
        $rows = [
            ...array_map(fn (int $id) => [CreatorUsage::ASSET, $id], array_values(array_unique($assetIds))),
            ...array_map(fn (int $id) => [CreatorUsage::FONT, $id], array_values(array_unique($fontIds))),
        ];
        if ($rows === []) {
            return;
        }
        CreatorUsage::query()->insert(array_map(fn (array $row) => [
            'user_id'     => $template->user_id,
            'owner_type'  => CreatorTemplate::USAGE_OWNER,
            'owner_id'    => $template->id,
            'target_type' => $row[0],
            'target_id'   => $row[1],
        ], $rows));
    }

    /**
     * @description Templates using files of one kind (trash included).
     * @param string $targetType CreatorUsage::ASSET | CreatorUsage::FONT.
     * @param int[] $ids Ids of the files.
     * @return array<int, list<array{id: int, name: string, section: string, trashed: bool}>> File id → templates.
     */
    public static function usedBy(string $targetType, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        /** @var Collection<int, CreatorUsage> $usages */
        $usages = CreatorUsage::query()->with('template')->where('target_type', $targetType)->whereIn('target_id', $ids)
            ->where('owner_type', CreatorTemplate::USAGE_OWNER)->get();

        $map = [];
        foreach ($usages as $usage) {
            $template = $usage->template;
            if ($template !== null) {
                $map[$usage->target_id][] = [
                    'id'      => $template->id,
                    'name'    => $template->name,
                    'section' => $template->section,
                    'trashed' => $template->trashed(),
                ];
            }
        }

        return $map;
    }

    /**
     * @description Refuses to delete a file a template uses.
     * @param string $targetType CreatorUsage::ASSET | CreatorUsage::FONT.
     * @param int $id File.
     * @return void
     * @throws InUseException
     */
    public static function ensureUnused(string $targetType, int $id): void
    {
        $templates = self::usedBy($targetType, [$id])[$id] ?? [];
        if ($templates !== []) {
            throw new InUseException($templates);
        }
    }
}
