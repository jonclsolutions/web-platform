<?php
/**
 * @file WebLog.php
 * @path app/Apps/Web/Models/WebLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the web application (web_logs): inquiries, leads, orders, job applications,
 *   texts and content of the website.
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Apps\Web\Models;

use App\Models\Core\AuditLog;

final class WebLog extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = 'web_logs';
}
