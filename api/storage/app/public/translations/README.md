<!--
  @file README.md
  @path api/storage/app/public/translations/README.md
  @project JS web-platform
  @author JS
  @created 2026
  @description Developer guide to the runtime texts of the public website and the e-shop: where
  they live, the primary language, how a release brings new texts to a client without overwriting
  the client's own edits (translations:sync) and what that means for adding, changing, renaming
  and removing keys.
  @note Only *.json files of this folder are synchronised to the servers - this README never
  reaches a server.
-->

# Texts of the public website and the e-shop

The texts visitors see on the public website and in the e-shop (buttons, headings, checkout
messages …) are not compiled into the frontend. They are JSON files loaded at runtime and edited
by the client in the admin (**Web → Texty webu**, **E-shop → Texty e-shopu**).

```
translations/
├── languages.json      languages of every module (code, name, active, built-in, icon)
├── web/cz.json         texts of the public website - primary language
└── shop/cz.json        texts of the e-shop - primary language
```

Admin texts (`erp/src/assets/i18n/admin`, `erp/src/app/apps/*/admin/i18n`) are a different
thing: they are part of the frontend build and change only with a release.

## Two copies of the same files

| | Local development | Server of a client (production) |
|---|---|---|
| Where | this folder of the repository | storage volume of the server |
| Who edits | you (file or the local admin editor - it writes straight into these files, `git diff` shows it) | the client in the admin |
| Role | **default texts** of every installation | the texts the visitors see |

The production image keeps this folder as the *seed* (`/opt/seed/translations`,
`deploy/docker/api.Dockerfile`). At the start of every release the `app` container runs
`php artisan translations:sync` (`deploy/docker/api-entrypoint.sh`), which brings the seed into
the volume.

## Primary language

Every module has one **primary language: Czech (`cz`)**. It is built in (cannot be deleted in
the admin), its file is the one in this folder and it is the reference of every other language:

- the editor lists the keys of `cz.json` for every language; a key that is missing or empty in
  another language is shown in orange as missing (counter "Chybí");
- other languages (e.g. `de.json`, `sk.json`, `en.json`) are created by the client in the admin
  and live only on the server - they are not in the repository.

## What a release does (translations:sync)

`api/app/Console/Commands/SyncTranslationsCommand.php`, merge rules in
`api/app/Support/I18n/TranslationSeedMerger.php`.

**Primary language (`cz.json`)** - a three-way merge of the server texts, the new seed and the
seed applied by the previous release (kept on the server in
`storage/app/private/translation-seed/`, never public):

| Key | Result on the server |
|---|---|
| new in the release | added with your default text |
| changed in the release, never edited by the client | updated to your new text |
| edited by the client in the admin | **the client's text stays** (also when you change it later) |
| removed in the release, never edited by the client | removed |
| removed in the release, edited by the client | stays |

"Edited by the client" = the value on the server differs from the seed of the previous release.
A client text that is identical to the default counts as not edited and follows future releases.

**Other languages of the client (`de.json`, …)**

- their translations are never changed;
- keys that the primary language no longer has are removed (the application does not use them);
- **new keys are not added** - the editor already shows them as missing (orange) because it
  compares with Czech; the public page shows its fallback / "Cannot load text" until the client
  fills them. An empty value would be worse: the page would show an empty button.

**Other files** (`languages.json`) are copied only when the server has none (new installation);
the languages are the client's.

**First sync on a server** (no stored seed yet - an installation from before this mechanism):
only missing keys are added, nothing is updated or removed (an edit cannot be told from an old
text). From the next release on, all the rules above apply.

A file on the server that is not valid JSON is left as it is (warning in the log); a broken seed
file fails the command, but the container still starts with the texts it has.

## Working with keys

- **Add a text:** add the key to `web/cz.json` or `shop/cz.json` (by hand or in the local
  editor), use it in the template with a fallback (`t?.checkout?.alerts?.email_limit ?? …`),
  commit. The release adds it on every server; clients see it as missing in their other
  languages.
- **Change a default text:** change it in `cz.json`. Clients who never edited it get the new
  text; a client's own wording is kept.
- **Rename a key** = remove the old one + add a new one. The new key gets your default text; a
  client's edit of the old key is **not** moved over (it stays as an unused key if edited). Avoid
  renaming keys clients are likely to have edited, or tell them.
- **Remove a key:** delete it from `cz.json` (and from the templates). It disappears from every
  server unless the client edited it, and from the client's other languages.
- Keep `cz.json` a JSON object of groups and strings (lists are allowed and compared as a whole).
  Do not move a text into a group of the same name or the other way round without need - the
  structure of the release wins and the client's text at that place is dropped.

## Do not

- **Do not upload a JSON file into a client's admin** ("Nahrát JSON") to deliver new texts - it
  replaces the whole language, including the client's edits. The release does it safely.
- Do not put anything but texts here: every `*.json` of this folder is shipped to all servers
  and is public (`/storage/translations/...`).

## Checking it

- On a server after a release:
  `cd /srv/app && docker compose logs app | grep translations`
  (e.g. `translations shop/cz.json: 3 added, 0 updated, 0 removed, 1 kept as edited in the admin`,
  or `translations: up to date`).
- Preview without changes:
  `cd /srv/app && docker compose exec app php artisan translations:sync --dry-run`
- Tests: `api/tests/Unit/Core/TranslationSyncTest.php` (merge rules, first sync, client
  languages, broken files, the repository texts merge cleanly).
- Operations manual: `deploy/deploy_workflow.md`, chapter 11 (Texty webu a e-shopu).
