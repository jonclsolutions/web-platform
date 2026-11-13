/**
 * @file sections.js
 * @path tests/unit_tests/api/lib/sections.js
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Which api source files (app/…) belong to which test section. The coverage of
 *   a section run (run_core.sh, run_web.sh, run_shop.sh, run_project_portal.sh, run_other.sh)
 *   is measured over exactly these files; run_integration.sh and run_all_api.sh measure all of
 *   them. The sections match the PHPUnit suites in api/phpunit.xml (core / other:
 *   tests/{Unit,Feature}/<Section>, applications: tests/Apps/<App>).
 * @dependencies
 * - none (plain data + one lookup function).
 *
 * @note A file belongs to the FIRST section whose list contains it (core, web, shop,
 *   projectportal); everything else is "other". Entries ending with "/" are folders, the rest are files.
 */

'use strict';

/** Section → path prefixes relative to api/. */
const SECTIONS = {
  // Core administration + authentication (login, 2FA, password reset, activation, users,
  // roles, permissions, security monitoring, e-mail access policy, external links, audit log).
  core: [
    'app/Http/Controllers/Api/Core/',
    'app/Http/Controllers/Api/Auth/',
    'app/Http/Controllers/Api/AuthController.php',
    'app/Http/Controllers/Api/AccountActivationController.php',
    'app/Http/Controllers/Api/UserController.php',
    'app/Http/Requests/Auth/',
    'app/Http/Requests/Core/',
    'app/Http/Requests/User/',
    'app/Http/Requests/PasswordChangeRequest.php',
    'app/Http/Resources/Core/',
    'app/Http/Resources/UserResource.php',
    'app/Http/Middleware/CheckPermission.php',
    'app/Mail/Auth/',
    'app/Models/Core/CoreEmailAccessRule.php',
    'app/Models/Core/CoreExternalLink.php',
    'app/Models/Core/CoreLog.php',
    'app/Models/Core/CorePermission.php',
    'app/Models/Core/CoreRole.php',
    'app/Models/Core/CoreSecurityEvent.php',
    'app/Models/Core/CoreSecuritySetting.php',
    'app/Models/User.php',
    'app/Models/AccountActivationToken.php',
    'app/Models/PasswordResetToken.php',
    'app/Models/RefreshToken.php',
    'app/Models/TwoFactorCode.php',
    'app/Console/Commands/PurgeSecurityEventsCommand.php',
    'app/Services/Security/',
    'app/Traits/LogsActivity.php'
  ],
  // Web application (public website and forms, leads, orders, job applications, web admin) +
  // the attachment helpers its forms test most.
  web: [
    'app/Apps/Web/',
    'app/Rules/AttachmentsTotalSize.php',
    'app/Traits/HandlesAttachments.php'
  ],
  // E-shop application (public shop, checkout, admin shop pages).
  shop: [
    'app/Apps/Shop/'
  ],
  // Project portal application (projects, client portal, its admin and log).
  projectportal: [
    'app/Apps/ProjectPortal/'
  ]
};

/** Section names in lookup order; "other" is the fallback. */
const SECTION_NAMES = ['core', 'web', 'shop', 'projectportal', 'other'];

/**
 * @description Section of one api source file.
 * @param {string} file Path relative to api/ (POSIX separators), e.g. 'app/Models/User.php'.
 * @returns {'core'|'web'|'shop'|'projectportal'|'other'} Section name.
 */
function sectionOf(file) {
  for (const name of ['core', 'web', 'shop', 'projectportal']) {
    if (SECTIONS[name].some(p => (p.endsWith('/') ? file.startsWith(p) : file === p))) return name;
  }
  return 'other';
}

module.exports = { SECTIONS, SECTION_NAMES, sectionOf };
