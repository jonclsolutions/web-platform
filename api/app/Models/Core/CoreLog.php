<?php
/**
 * @file CoreLog.php
 * @path app/Models/Core/CoreLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description System-wide audit log (core_logs): authentication, accounts, roles and permissions, legal
 *   documents, settings of the core.
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Models\Core;

final class CoreLog extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = 'core_logs';
}
