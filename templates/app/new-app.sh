#!/usr/bin/env bash
#
# @file new-app.sh
# @path templates/app/new-app.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Creates a new application from the template (templates/app): the API folder
#   app/Apps/<App> (manifest, routes, audit log with its migration and controller, permissions,
#   manual page, tests) and the frontend folder erp/src/app/apps/<id> (manifest, admin routes, the
#   log page, admin texts cz / en), registers it (api/config/apps.php, api/phpunit.xml test suite,
#   erp apps.registry.ts and AppId, unit test runners) - a working, removable application with
#   one admin page (its audit log) to build on.
# @dependencies bash, python3; run from anywhere inside the repository.
# @usage
#   templates/app/new-app.sh blog "Blog"            (id in kebab case, display name)
#   templates/app/new-app.sh my-crm "Moje CRM"
# @note Placeholders of the template: __APP__ (StudlyCase), __app__ (the id), __app_snake__
#   (snake case - tables, keys), __APP_CONST__ (UPPER_SNAKE - TypeScript constants), __NAME__,
#   __YEAR__, __DATE__ (migration date). After creating: `php artisan migrate`, `php artisan
#   db:seed --class=BaseDataSeeder`, `npm run build` - see templates/app/README.md.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="$REPO/templates/app"
ID="${1:-}"; NAME="${2:-}"

if [[ ! "$ID" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] || [ -z "$NAME" ]; then
  echo "usage: $0 <id in kebab case, e.g. my-crm> \"<display name>\"" >&2
  exit 2
fi
STUDLY="$(echo "$ID" | awk -F- '{ for (i = 1; i <= NF; i++) printf "%s", toupper(substr($i, 1, 1)) substr($i, 2) }')"
SNAKE="${ID//-/_}"
CONST="$(echo "$SNAKE" | tr '[:lower:]' '[:upper:]')"

for existing in "$REPO/api/app/Apps/$STUDLY" "$REPO/erp/src/app/apps/$ID"; do
  [ -e "$existing" ] && { echo "Already exists: $existing" >&2; exit 1; }
done
grep -q "'$ID'" "$REPO/erp/src/app/apps/app-manifest.ts" && { echo "The id '$ID' is already used." >&2; exit 1; }

python3 - "$REPO" "$TEMPLATE" "$ID" "$STUDLY" "$SNAKE" "$CONST" "$NAME" <<'PY'
import datetime, os, re, sys
repo, template, app_id, studly, snake, const, name = sys.argv[1:8]
today = datetime.date.today()
subs = [('__APP_CONST__', const), ('__app_snake__', snake), ('__APP__', studly), ('__app__', app_id),
        ('__NAME__', name), ('__YEAR__', str(today.year)), ('__DATE__', today.strftime('%Y_%m_%d'))]

def fill(text):
    for key, value in subs:
        text = text.replace(key, value)
    return text

# 1. Files of the template (api/, erp/) into the repository.
created = []
for part in ('api', 'erp'):
    for root, _, files in os.walk(os.path.join(template, part)):
        for fn in files:
            src = os.path.join(root, fn)
            dst = os.path.join(repo, fill(os.path.relpath(src, template)))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(src, encoding='utf8') as f:
                content = fill(f.read())
            with open(dst, 'w', encoding='utf8') as f:
                f.write(content)
            created.append(os.path.relpath(dst, repo))

def insert(path, anchor, text, before=True):
    full = os.path.join(repo, path)
    content = open(full, encoding='utf8').read()
    match = re.search(anchor, content, re.S)
    if not match:
        sys.exit(f'Anchor {anchor!r} not found in {path}')
    pos = match.start() if before else match.end()
    open(full, 'w', encoding='utf8').write(content[:pos] + text + content[pos:])
    created.append(path + ' (registered)')

# 2. Registries.
insert('api/config/apps.php', r"\n    \],\n\];", f"\n        App\\Apps\\{studly}\\{studly}App::class,")
insert('api/phpunit.xml', r'        <testsuite name="Other">',
       f'        <testsuite name="{studly}">\n            <directory>tests/Apps/{studly}</directory>\n        </testsuite>\n')
insert('erp/src/app/apps/apps.registry.ts', r"\n\nexport type \{ AppId, AppManifest \}",
       f"\nimport {{ {const}_APP }} from './{app_id}/{app_id}.app';")
insert('erp/src/app/apps/apps.registry.ts', r"\n\];\n\n/\*\* Ids of the installed applications", f"\n  {const}_APP,")
insert('erp/src/app/apps/app-manifest.ts', r";\n\n/\*\* Manifest of one application", f" | '{app_id}'")

# 3. Unit test runners (erp admin, api suite) - copies of the project portal ones.
for kind, src_name, dst_name, old, new in [
    ('erp', 'run_project_portal_admin.sh', f'run_{snake}_admin.sh', ('project-portal', 'project portal', 'Project portal', 'run_project_portal_admin.sh'), (app_id, name, name, f'run_{snake}_admin.sh')),
    ('api', 'run_project_portal.sh', f'run_{snake}.sh', ('ProjectPortal', 'run_project_portal.sh'), (studly, f'run_{snake}.sh')),
]:
    src = os.path.join(repo, 'tests', 'unit_tests', kind, src_name)
    dst = os.path.join(repo, 'tests', 'unit_tests', kind, dst_name)
    text = open(src, encoding='utf8').read().replace('@created 2026', f'@created {today.year}')
    for a, b in zip(old, new):
        text = text.replace(a, b)
    open(dst, 'w', encoding='utf8').write(text)
    os.chmod(dst, 0o755)
    created.append(os.path.relpath(dst, repo))

print('\n'.join(created))
PY

cat <<EOF

Application '$ID' ($NAME) created.
Next steps:
  1. cd api && php artisan migrate && php artisan db:seed --class=BaseDataSeeder
     (the table ${SNAKE}_logs and the permissions view-$ID, $ID-view-logs - the sysadmin gets them)
  2. Give the permissions to the roles that should see the application (admin → Roles).
  3. Build the frontend (cd erp && npm run build) - the application is in the switcher of the admin.
  4. Check it: tests/unit_tests/api/run_${SNAKE}.sh, tests/unit_tests/erp/run_${SNAKE}_admin.sh,
     tests/module_removal/check.sh $ID
EOF
