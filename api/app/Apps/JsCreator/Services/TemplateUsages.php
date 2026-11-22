<?php

/**
 * @file TemplateUsages.php
 * @path app/Apps/JsCreator/Services/TemplateUsages.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Usages of library images, own fonts and blocks (js_creator_usages):
 *   - sync() keeps the rows of a template or a block equal to its document (after every save /
 *     copy); a template also records the blocks of its instances;
 *   - usedBy() lists the templates and blocks using an image / font / block (trash included) -
 *     the library and the blocks refuse to delete what is used (InUseException) and show where.
 * @dependencies CreatorUsage, CreatorTemplate, CreatorBlock.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use Illuminate\Support\Collection;

final class TemplateUsages
{
    /**
     * @description Replaces the usages of a template or a block.
     * @param CreatorTemplate|CreatorBlock $owner Template or block.
     * @param int[] $assetIds Library images of its document.
     * @param int[] $fontIds Own fonts of its document.
     * @param int[] $blockIds Blocks of its instances (templates only).
     * @return void
     */
    public static function sync(CreatorTemplate|CreatorBlock $owner, array $assetIds, array $fontIds, array $blockIds = []): void
    {
        $owner->usages()->delete();
        $rows = [
            ...array_map(fn (int $id) => [CreatorUsage::ASSET, $id], array_values(array_unique($assetIds))),
            ...array_map(fn (int $id) => [CreatorUsage::FONT, $id], array_values(array_unique($fontIds))),
            ...array_map(fn (int $id) => [CreatorUsage::BLOCK, $id], array_values(array_unique($blockIds))),
        ];
        if ($rows === []) {
            return;
        }
        CreatorUsage::query()->insert(array_map(fn (array $row) => [
            'user_id'     => $owner->user_id,
            'owner_type'  => $owner::USAGE_OWNER,
            'owner_id'    => $owner->id,
            'target_type' => $row[0],
            'target_id'   => $row[1],
        ], $rows));
    }

    /**
     * @description Copies the usages of a template / block to its copy.
     * @param CreatorTemplate|CreatorBlock $source Original.
     * @param CreatorTemplate|CreatorBlock $copy Copy (same kind).
     * @return void
     */
    public static function copy(CreatorTemplate|CreatorBlock $source, CreatorTemplate|CreatorBlock $copy): void
    {
        $usages = $source->usages()->get();
        $ids = fn (string $type) => $usages->where('target_type', $type)->pluck('target_id')->map(fn ($id) => (int) $id)->all();
        self::sync($copy, $ids(CreatorUsage::ASSET), $ids(CreatorUsage::FONT), $ids(CreatorUsage::BLOCK));
    }

    /**
     * @description Templates and blocks using targets of one kind (trash included).
     * @param string $targetType CreatorUsage::ASSET | FONT | BLOCK.
     * @param int[] $ids Ids of the targets.
     * @return array<int, list<array{id: int, kind: string, name: string, section: string, trashed: bool}>> Target id → users.
     */
    public static function usedBy(string $targetType, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        /** @var Collection<int, CreatorUsage> $usages */
        $usages = CreatorUsage::query()->with(['template', 'block'])->where('target_type', $targetType)->whereIn('target_id', $ids)
            ->orderBy('owner_type', 'desc')->orderBy('owner_id')->get();
        $map = [];
        foreach ($usages as $usage) {
            $owner = match ($usage->owner_type) {
                CreatorTemplate::USAGE_OWNER => $usage->template,
                CreatorBlock::USAGE_OWNER    => $usage->block,
                default                      => null,
            };
            if ($owner !== null) {
                $map[$usage->target_id][] = [
                    'id'      => $owner->id,
                    'kind'    => $usage->owner_type,
                    'name'    => $owner->name,
                    'section' => $owner->section,
                    'trashed' => $owner->trashed(),
                ];
            }
        }

        return $map;
    }

    /**
     * @description Refuses to delete an image / font / block that a template or block uses.
     * @param string $targetType CreatorUsage::ASSET | FONT | BLOCK.
     * @param int $id Target.
     * @return void
     * @throws InUseException
     */
    public static function ensureUnused(string $targetType, int $id): void
    {
        $users = self::usedBy($targetType, [$id])[$id] ?? [];
        if ($users !== []) {
            throw new InUseException($users);
        }
    }

    /**
     * @description Ids of the templates using a block (trash included).
     * @param int $blockId Block.
     * @return int[]
     */
    public static function templatesOfBlock(int $blockId): array
    {
        return CreatorUsage::query()->where('owner_type', CreatorTemplate::USAGE_OWNER)->where('target_type', CreatorUsage::BLOCK)
            ->where('target_id', $blockId)->pluck('owner_id')->map(fn ($id) => (int) $id)->all();
    }
}
