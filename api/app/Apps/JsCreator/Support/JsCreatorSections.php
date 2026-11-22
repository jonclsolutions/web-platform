<?php
/**
 * @file JsCreatorSections.php
 * @path app/Apps/JsCreator/Support/JsCreatorSections.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sections of JS Creator - kinds of output with their own templates and permissions
 *   (`js-creator-<section>-view|create|update|delete`). The parts shared by every section
 *   (folders, library, fonts, trash) need the action in ANY section, so their routes ask any().
 * @usage `->middleware('permission:' . JsCreatorSections::any('create'))`; outputs of every section
 *   in one list: `JsCreatorSections::allowed($user, 'view')`.
 * @note A new section (videos, gifs) = one entry in SECTIONS + its permissions in
 *   Database/Seeders/data/permissions.php; the shared parts follow without a change. The same
 *   list is in the frontend (apps/js-creator/admin/shared/js-creator-sections.ts).
 */

namespace App\Apps\JsCreator\Support;

use App\Models\User;

final class JsCreatorSections
{
    /** @description Ids of the sections (also the first URL segment of their pages). */
    public const SECTIONS = ['images'];

    /** @description Actions of a section permission. */
    public const ACTIONS = ['view', 'create', 'update', 'delete'];

    /** @description Role with every permission (the same rule as the `permission` middleware). */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @description Permission of one action in one section.
     * @param string $section Section id (SECTIONS).
     * @param string $action Action (ACTIONS).
     * @return string E.g. `js-creator-images-view`.
     */
    public static function permission(string $section, string $action): string
    {
        return "js-creator-{$section}-{$action}";
    }

    /**
     * @description Permission expression "the action in any section" for the `permission`
     *   middleware (`a|b` = any of them).
     * @param string $action Action (ACTIONS).
     * @return string E.g. `js-creator-images-create` (later `…|js-creator-videos-create`).
     */
    public static function any(string $action): string
    {
        return implode('|', array_map(fn (string $section) => self::permission($section, $action), self::SECTIONS));
    }

    /**
     * @description Sections in which an account may do an action - outputs of all sections are in
     *   one list, each output needs the permission of its own section.
     * @param User $user Signed-in account.
     * @param string $action Action (ACTIONS).
     * @return array<int, string> Section ids (every section for the sysadmin role).
     */
    public static function allowed(User $user, string $action): array
    {
        if ($user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists()) {
            return self::SECTIONS;
        }
        $held = (array) ($user->permissions ?? []);

        return array_values(array_filter(self::SECTIONS, fn (string $section) => in_array(self::permission($section, $action), $held, true)));
    }
}
