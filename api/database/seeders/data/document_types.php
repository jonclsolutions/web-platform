<?php
/**
 * @file document_types.php
 * @path api/database/seeders/data/document_types.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Types of the legal documents (document_types) - the public GDPR / TOS / cookies pages
 *   load their sections by these slugs.
 *   Generated from the database dump of 2026-10-29; edit by hand from now on.
 */

return [
    ['slug' => 'gdpr', 'title' => 'GDPR'],
    ['slug' => 'tos', 'title' => 'TOS'],
    ['slug' => 'cookies', 'title' => 'Cookies'],
];
