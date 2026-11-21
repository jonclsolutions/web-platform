<?php
/**
 * @file permissions.php
 * @path app/Apps/JsCreator/Database/Seeders/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Permission keys of the application "JS Creator" (core_permissions): key,
 *   description (English fallback of the admin i18n `permission-descriptions`), module (= the id
 *   of the application). JsCreatorBaseDataSeeder adds the missing ones; the sysadmin role gets all.
 * @note Every account works only in its own workspace - the permissions decide what it may do
 *   there, never whose data it sees (not even the sysadmin sees another workspace). One set of
 *   `js-creator-<section>-*` keys per section (JsCreatorSections).
 */

return [
    ['permission_key' => 'view-js-creator', 'description' => '[recommended: always on] Show the JS Creator application in the admin - without it the application cannot be opened', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-images-view', 'description' => 'Section Images: view the own templates and image outputs, folders and the library, download files', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-images-create', 'description' => 'Section Images: create templates and folders, generate outputs, upload images and fonts to the library', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-images-update', 'description' => 'Section Images: edit templates, rename and move outputs, folders and files of the library', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-images-delete', 'description' => 'Section Images: delete to the trash, restore, delete for good and empty the trash', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-settings-view', 'description' => 'View the settings of JS Creator: default quota and the overview of accounts (counts, used space, quota - never their content)', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-settings-update', 'description' => 'Change the default and the individual quotas of JS Creator', 'module' => 'js-creator'],
    ['permission_key' => 'js-creator-view-logs', 'description' => 'View the log history (audit trail) of JS Creator', 'module' => 'js-creator'],
];
