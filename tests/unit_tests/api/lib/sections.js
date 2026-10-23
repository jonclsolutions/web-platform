/**
 * @file sections.js
 * @path tests/unit_tests/api/lib/sections.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Which api source files (app/…) belong to which test section. The coverage of
 *   a section run (run_core.sh, run_web.sh, run_shop.sh, run_other.sh) is measured over
 *   exactly these files; run_all_api.sh measures all of them. The sections match the
 *   PHPUnit suites in api/phpunit.xml (tests/{Unit,Feature}/<Section>).
 * @dependencies
 * - none (plain data + one lookup function).
 *
 * @note A file belongs to the FIRST section whose list contains it (core, web, shop);
 *   everything else is "other". Entries ending with "/" are folders, the rest are files.
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
  // Web section (public web forms, projects portal, admin web pages).
  web: [
    'app/Http/Controllers/Api/Web/',
    'app/Http/Requests/Web/',
    'app/Http/Resources/Web/',
    'app/Models/Web/',
    'app/Mail/Web/',
    'app/Http/Middleware/CheckWebActive.php',
    'app/Http/Middleware/CheckProjectSession.php',
    'app/Support/Mail/RawRequestEmailTemplate.php',
    'app/Rules/AttachmentsTotalSize.php',
    'app/Traits/HandlesAttachments.php'
  ],
  // E-shop section (public shop, checkout, admin shop pages).
  shop: [
    'app/Http/Controllers/Api/Shop/',
    'app/Http/Requests/Shop/',
    'app/Http/Resources/Shop/',
    'app/Models/Shop/',
    'app/Http/Middleware/CheckShopActive.php'
  ]
};

/** Section names in lookup order; "other" is the fallback. */
const SECTION_NAMES = ['core', 'web', 'shop', 'other'];

/**
 * @description Section of one api source file.
 * @param {string} file Path relative to api/ (POSIX separators), e.g. 'app/Models/User.php'.
 * @returns {'core'|'web'|'shop'|'other'} Section name.
 */
function sectionOf(file) {
  for (const name of ['core', 'web', 'shop']) {
    if (SECTIONS[name].some(p => (p.endsWith('/') ? file.startsWith(p) : file === p))) return name;
  }
  return 'other';
}

module.exports = { SECTIONS, SECTION_NAMES, sectionOf };
