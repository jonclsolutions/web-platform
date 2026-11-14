<?php
/**
 * @file permissions.php
 * @path app/Apps/__APP__/Database/Seeders/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Permission keys of the application "__NAME__" (core_permissions): key,
 *   description (English fallback of the admin i18n `permission-descriptions`), module (= the id
 *   of the application). __APP__BaseDataSeeder adds the missing ones; the sysadmin role gets all.
 */

return [
    ['permission_key' => 'view-__app__', 'description' => '[recommended: always on] Show the __NAME__ application in the admin - without it the application cannot be opened', 'module' => '__app__'],
    ['permission_key' => '__app__-view-logs', 'description' => 'View the log history (audit trail) of __NAME__', 'module' => '__app__'],
];
