# Automatické nasazení – GitHub Actions → VPS

Návod krok za krokem: jak nastavit repozitář a server, aby **push tagu `v…` sám otestoval,
sestavil a nasadil** novou verzi – se zálohou, migracemi, kontrolou a automatickým návratem
při chybě. Navazuje na **[setup_hosting.md](setup_hosting.md)** (doména, e-maily, VPS,
`bootstrap.sh`, `/srv/app/.env`).

> **Kroky 3–9 udělá automaticky `deploy/vps/provision.sh <IP> <doména>`** (setup_hosting.md,
> „Rychlá cesta“) – GitHub CLI nastaví prostředí `production`, deploy klíč i první vydání.
> Kapitoly níže jsou ruční postup a vysvětlení.

Obsah:

1. [Jak to funguje](#1-jak-to-funguje)
2. [Předpoklady](#2-předpoklady)
3. [Deploy klíč pro GitHub](#3-deploy-klíč-pro-github)
4. [deploy.sh na serveru](#4-deploysh-na-serveru)
5. [Otisk serveru (known_hosts)](#5-otisk-serveru-known_hosts)
6. [Prostředí `production` na GitHubu](#6-prostředí-production-na-githubu)
7. [První vydání](#7-první-vydání)
8. [První sysadmin](#8-první-sysadmin)
9. [Zálohy](#9-zálohy)
10. [Přenos stávajícího webu](#10-přenos-stávajícího-webu)
11. [Běžné vydání](#11-běžné-vydání)
12. [Rollback, stav, obnova](#12-rollback-stav-obnova)
13. [Nový klient (kopie platformy)](#13-nový-klient-kopie-platformy)
14. [Bezpečnost – shrnutí](#14-bezpečnost--shrnutí)
15. [Když něco nejde](#15-když-něco-nejde)

---

## 1. Jak to funguje

```
 ty:  ./dev.sh release v2026.11.2   (changelog → commit → tag → push)
                      │
 GitHub Actions (.github/workflows/release.yml)
   0. Changelog – tag má své poznámky v changelogu (jinak stop)
   1. Tests   – všechny unit testy (ci.yml: Karma + PHPUnit)
   2. Images  – ghcr.io/<owner>/<repo>-api:v2026.11.1  (PHP-FPM + Laravel + deploy bundle)
                ghcr.io/<owner>/<repo>-web:v2026.11.1  (Angular + Caddy)
   3. Deploy  – SSH na VPS deploy klíčem (smí spustit JEN deploy.sh)
   4. Notes   – GitHub Release se stejnými poznámkami
                      │
 VPS /srv/app/deploy.sh release v2026.11.1
   kontrola .env → stažení image → záloha (DB + storage/app) → stop API
   → migrate + seed → start → smoke test → hotovo
   chyba kdekoli po stopu → předchozí verze + databáze ze zálohy zpět
```

| Co | Kde | Kdo to vidí |
|---|---|---|
| kód, workflowy | repozitář GitHub | tým |
| image vydání | ghcr.io (soukromé balíčky repozitáře) | repozitář |
| **deploy klíč** (soukromý) | GitHub → Environment `production` → secret | nikdo (jen běh workflow) |
| IP a otisk serveru | GitHub → Environment `production` → variables | tým |
| **nastavení klienta** (hesla, APP_KEY) | jen `/srv/app/.env` na VPS + Bitwarden | ty |
| tvůj osobní SSH klíč | jen tvůj počítač | ty |

Výpadek API při vydání: desítky sekund (stránky běží dál, volání API vrací 502).

---

## 2. Předpoklady

- Hotové kroky 1–11 z [setup_hosting.md](setup_hosting.md): `bootstrap.sh`, `ssh klient-vps`
  funguje jako `deploy`, `/srv/app/compose.yaml` a `/srv/app/.env` (600) vyplněné.
- V `/srv/app/.env`:
  - `IMAGE_PREFIX=ghcr.io/<owner>/<repo>` – **malými písmeny**, přesně podle repozitáře
    (pro `jonclsolutions/web-platform` → `ghcr.io/jonclsolutions/web-platform`),
  - `RELEASE=` prázdné (vyplní první vydání).
- Repozitář: Settings → Actions → General → *Allow all actions* (nebo aspoň actions od GitHubu,
  `docker/*` a `shivammathur/setup-php`).
- Náklady: Actions u soukromého repozitáře čerpají minuty plánu (jedno vydání ≈ 15–25 min);
  ukládání image na ghcr.io je [zatím zdarma](https://docs.github.com/en/billing/concepts/product-billing/github-packages).

---

## 3. Deploy klíč pro GitHub

Samostatný klíč **jen pro GitHub** (jeden na klienta). Na serveru je svázaný s příkazem
`deploy.sh ci` – i kdyby unikl, umí jen nasadit / vrátit vydání, žádný shell.

1. Na svém počítači (bez passphrase – používá ho stroj):
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-<klient>" -f ./gh-deploy-<klient>
   ```
2. Veřejný klíč na server s omezením (`restrict` = žádný terminál ani přesměrování portů,
   `command=` = vždy jen `deploy.sh ci`):
   - Linux / macOS:
     ```bash
     printf 'restrict,command="/srv/app/deploy.sh ci" %s\n' "$(cat gh-deploy-<klient>.pub)" \
       | ssh klient-vps 'cat >> ~/.ssh/authorized_keys'
     ```
   - Windows PowerShell:
     ```powershell
     "restrict,command=`"/srv/app/deploy.sh ci`" " + (Get-Content gh-deploy-<klient>.pub) | ssh klient-vps 'cat >> ~/.ssh/authorized_keys'
     ```
3. Soukromý klíč `gh-deploy-<klient>` vložíš v kroku 6 do GitHubu a pak ho **smažeš**
   (`rm gh-deploy-<klient>`). Ztracený klíč se nenahrazuje – vygeneruje se nový a starý řádek
   se z `~/.ssh/authorized_keys` smaže.

✔ Ověření: `ssh klient-vps 'grep -c github-actions ~/.ssh/authorized_keys'` → `1`.

---

## 4. deploy.sh na serveru

Skript vydání, záloh a rollbacku. Poprvé ho nahraješ ručně; každé další vydání si ho (spolu
s `compose.yaml`) nainstaluje ze svého image samo.

```bash
scp deploy/vps/deploy.sh klient-vps:/srv/app/deploy.sh
ssh klient-vps 'chmod 750 /srv/app/deploy.sh && /srv/app/deploy.sh check'
```

`check` projde `/srv/app/.env` a vypíše **všechny** chyby najednou (debug zapnutý, http adresy,
chybný `APP_KEY`, testovací Turnstile klíče, mailer `log`, `root` jako uživatel DB, čitelný
`.env` …). Oprav a spusť znovu, dokud neskončí `OK`.

---

## 5. Otisk serveru (known_hosts)

GitHub musí server poznat, jinak by se mohl připojit k podvrženému.

1. Na svém počítači:
   ```bash
   ssh-keyscan -t ed25519 <IP> 2>/dev/null          # řádek pro GitHub (krok 6)
   ssh-keyscan -t ed25519 <IP> 2>/dev/null | ssh-keygen -lf -
   ```
2. Porovnej otisk (`SHA256:…`) se serverem – přes **konzoli FORPSI (Zotavovací konzole)**
   nebo tvou už ověřenou SSH relaci:
   ```bash
   ssh klient-vps 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub'
   ```
   Musí se shodovat. Celý řádek z bodu 1 (`<IP> ssh-ed25519 AAAA…`) je hodnota
   `DEPLOY_KNOWN_HOSTS`.

---

## 6. Prostředí `production` na GitHubu

Repozitář → **Settings → Environments → New environment** → název `production`.

1. **Deployment branches and tags** → *Selected branches and tags* → přidej:
   - tag `v*` (vydání z tagu),
   - branch `main` (ruční spuštění Run workflow).
2. Volitelně **Required reviewers** = ty → každé nasazení čeká na tvoje schválení v Actions.
3. **Environment variables**:

   | Název | Hodnota |
   |---|---|
   | `DEPLOY_HOST` | IP VPS (např. `185.33.145.230`) |
   | `DEPLOY_KNOWN_HOSTS` | řádek z kroku 5 |
   | `DEPLOY_USER` | (nepovinné) `deploy` |

4. **Environment secrets**:

   | Název | Hodnota |
   |---|---|
   | `DEPLOY_SSH_KEY` | celý obsah souboru `gh-deploy-<klient>` včetně řádků `-----BEGIN…` / `-----END…` |

5. Smaž lokální soukromý klíč: `rm gh-deploy-<klient>`.

> Token pro stažení image se nikam neukládá – workflow posílá serveru při každém nasazení
> krátkodobý `GITHUB_TOKEN` (platí jen během běhu, jen čtení balíčků).

---

## 7. První vydání

1. Na `main` je vše, co chceš nasadit (testy prošly v CI, `git status` čisté, pushnuté).
2. Vydání (changelog → commit → tag → push; u nové instalace bez záznamů v changelogu
   s poznámkou):
   ```bash
   ./dev.sh release v2026.11.1 --note "First release of <doména>"
   ```
3. GitHub → **Actions → Release** – sleduj *Tests* → *Images* → *Deploy* (schválení, pokud jsi
   nastavil reviewers).
4. První vydání: prázdná databáze → migrace vytvoří celé schéma, seed základní data,
   výchozí překlady webu / shopu se nakopírují do úložiště (`translations:sync`, viz kapitola 11).

✔ Ověření:
```bash
ssh klient-vps '/srv/app/deploy.sh status'
```
`running: v2026.11.1`, kontejnery `proxy app queue scheduler db` *Up (healthy)*.
Konec logu v Actions: `Release v2026.11.1 is live`.

Smoke test zkouší aplikaci uvnitř serveru, takže první vydání projde i **před přepnutím DNS**.
Na chybějící certifikát jen upozorní – Caddy ho získá sám, jakmile doména ukazuje na VPS
([setup_hosting.md, krok 12](setup_hosting.md#12-dns-webu--doména-na-vps)). Až web běží na
doméně, zaregistruj sitemap v Google Search Console
([setup_hosting.md, krok 13](setup_hosting.md#13-vyhledávače--sitemap-do-google-search-console)).

> Balíčky na ghcr.io: repozitář → *Packages* → `<repo>-api`, `<repo>-web` – musí zůstat
> **Private**.

---

## 8. První sysadmin

Interaktivně (heslo píšeš jen do terminálu, nikam se neukládá):

```bash
ssh -t klient-vps '/srv/app/deploy.sh create-sysadmin'
```

E-mail, jméno, heslo 2× (8–64 znaků, písmeno, číslice, symbol – ideálně vygenerované
v Bitwardenu). E-mail se sám přidá do výjimek
e-mailové politiky. Pak se přihlas na `https://<domena>/auth/login` – **2FA kód přijde e-mailem**,
tím je ověřené i SMTP `noreply@`. Při `--if-none` se nic nestane, když sysadmin už existuje.

---

## 9. Zálohy

Před každým vydáním se zálohuje automaticky. Noční zálohu zapni jednou:

```bash
ssh klient-vps '/srv/app/deploy.sh install-cron && /srv/app/deploy.sh backup manual'
```

- Každý den ve 02:40 → `/srv/app/backups/<datum>-nightly/`: `db.sql.gz` (konzistentní dump),
  `storage.tar.gz` (`storage/app`: nahrané soubory, překlady), `RELEASE`, `SHA256SUMS`.
- Uchovává se `BACKUP_KEEP_DAYS` dní (výchozí 14) – zálohy obsahují osobní údaje, déle ne.
- Log: `/srv/app/logs/backup.log`.

**Kopie mimo VPS** (doporučeno – záloha jen na stejném serveru nechrání před jeho ztrátou):

1. Na VPS jako `deploy`:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "backup-<klient>" -f ~/.ssh/id_ed25519_backup
   cat ~/.ssh/id_ed25519_backup.pub
   ```
2. Na záložním serveru (uživatel např. `backup`, složka `/srv/backups/<klient>`) do
   `~/.ssh/authorized_keys` – omezeno jen na zápis do té složky:
   ```
   restrict,command="rrsync -wo /srv/backups/<klient>" ssh-ed25519 AAAA… backup-<klient>
   ```
3. Na VPS jednou potvrď otisk záložního serveru: `ssh -i ~/.ssh/id_ed25519_backup backup@<IP zálohy>`
   (odpoví chybou `rrsync` – to je v pořádku).
4. Do `/srv/app/.env`: `BACKUP_REMOTE=backup@<IP zálohy>:` (cesta je daná `rrsync`), pak
   `/srv/app/deploy.sh backup manual` → `copied to the backup server`.
5. Na záložním serveru si nastav vlastní mazání starých záloh (např. 30 dní).

✔ Jednou měsíčně vyzkoušej obnovu (krok 12) na testovacím stroji – neověřená záloha není záloha.

---

## 10. Přenos stávajícího webu

Ze současného webhostingu (FTP balíček) na VPS. Data se přenesou beze ztráty, uživatelé zůstanou
přihlášeni jen tehdy, když zůstane stejný **`APP_KEY`**.

1. **Před prvním vydáním** zkopíruj `APP_KEY` ze současné produkce (`deploy/production.env`
   nebo `laravel/.env` na hostingu) do `/srv/app/.env`. (Až po vydání? Uprav `.env`
   a spusť `ssh klient-vps 'cd /srv/app && docker compose up -d'`.)
2. Den předem sniž TTL DNS záznamů `@` a `www` na 300 s.
3. Proveď první vydání (krok 7) – web na VPS běží, DNS ještě ukazuje na hosting.
4. **Zmraz starý web** (krátké okno, např. večer): v adminu vypni veřejné formuláře / zapni
   údržbu, ať po exportu nevznikají nová data.
5. **Databáze**: phpMyAdmin hostingu → Export → *Vlastní* → formát SQL, **vypnout**
   „CREATE DATABASE / USE“, komprese **gzip** → ulož jako `db.sql.gz`.
6. **Soubory**: přes FTP(S) stáhni celou složku `laravel/storage/app/` (podsložky `public`
   i `private`) a zabal ji:
   ```bash
   tar czf storage.tar.gz -C <stažená složka storage> app
   ```
7. Nahraj a importuj:
   ```bash
   ssh klient-vps 'mkdir -m 700 -p ~/import'
   scp db.sql.gz storage.tar.gz klient-vps:~/import/
   ssh -t klient-vps '/srv/app/deploy.sh import ~/import'
   ```
   Import: potvrzení doménou → záloha `pre-import` → databáze nahrazena → `storage/app`
   doplněno → migrace + seed aktuální verze → start → smoke test.
8. **Přepni DNS** (setup_hosting.md, krok 12). Do pár minut Caddy vydá certifikát; ověř web,
   e-shop, admin, přihlášení s 2FA, odeslání formuláře, staré nahrané soubory. Pak
   **zaregistruj sitemap v Google Search Console** (setup_hosting.md, krok 13).
9. **Smaž kopie dat** (osobní údaje): `ssh klient-vps 'rm -rf ~/import'` a lokální `db.sql.gz`,
   `storage.tar.gz`, stažená složka. Lokální `deploy/production.env` smaž, až jsou hodnoty
   v Bitwardenu.
10. Starý hosting nech ~1 týden jako zálohu, pak ho zruš (FTP balíček už z repozitáře nejde
    sestavit).

---

## 11. Běžné vydání

**Changelog – píše se průběžně, ne při vydání.** Každá změna, která zajímá administrátora,
přidá **ve stejném commitu** záznam do `"unreleased"` v `api/resources/changelog/changelog.json`
(anglicky, krátce, pro uživatele adminu – ne commit message):

```json
{ "type": "fixed", "area": "web", "part": "public", "text": "Inquiry form: sending works when the name contains an apostrophe.", "ref": "#57" }
```

| Pole | Hodnoty |
|---|---|
| `type` | `security`, `added`, `changed`, `fixed`, `removed` |
| `area` | `core` nebo id aplikace (`web`, `shop`, `project-portal`, …) |
| `part` | `admin` (administrace) nebo `public` (co vidí návštěvníci) |
| `ref` | nepovinné číslo tiketu (`#57`) – nahlášená chyba → GitHub issue → oprava → záznam |

Admin to ukáže v **Core → Verze** (běžící verze je dole v levém menu; po aktualizaci se objeví
upozornění jen v části, kterou vydání změnilo – oprava jádra neruší v e-shopu). Veřejné části
aplikací changelog neukazují, pokud ho aplikace v manifestu API nezapne (`publicChangelog()`).

**Vydání:**

1. Změny na `main`, CI zelené, ruční regrese (`tests/regression_tests/`), vše pushnuté.
2. Tag `vRRRR.MM.N` (např. `v2026.12.1`, `v2026.12.2` …):
   ```bash
   ./dev.sh release v2026.12.1
   ```
   Přesune `"unreleased"` pod tag (prázdný odmítne), ukáže poznámky, po potvrzení commitne,
   otaguje a pushne. Tag bez poznámek (např. vytvořený na webu GitHubu) workflow odmítne.
3. Actions → Release → (schválit) → `Release v2026.12.1 is live`; po úspěchu vznikne GitHub
   Release se stejnými poznámkami.
4. Krátká kontrola webu; `/api/version` vrací nový tag; v adminu Core → Verze.

Když vydání selže (migrace, start, smoke test), skript **sám vrátí předchozí verzi a databázi
ze zálohy těsně před vydáním** – log v Actions i na serveru (`/srv/app/logs/deploy.log`) říká proč.

**Aktualizace závislostí (Dependabot).** Každé pondělí otevře Dependabot pull requesty na
GitHub Actions, balíčky composer / npm (bez hlavních verzí) a nové digesty Docker image
(`deploy/docker/*.Dockerfile`, MariaDB v `deploy/compose.prod.yaml` – připnuté jako
`tag@sha256:…`). Nic se neslučuje ani nenasazuje samo: PR projde CI, po kontrole ho sloučíš a do
produkce se dostane s dalším vydáním. Nová verze PHP / Node.js / MariaDB (např. 8.6, 26, 11.x)
je plánovaná změna – v Dockerfilu se přepíše celý odkaz (tag i digest, digest zjistí
`docker buildx imagetools inspect php:8.6-fpm-trixie`) spolu s `dev/.env.example`.

Lokálně po sloučení PR: `git pull`, pak `./dev.sh composer install` (změnil se `api/composer.lock`)
a `./dev.sh npm ci` (změnil se `erp/package-lock.json`) a `./dev.sh test`.

**Texty webu a e-shopu (překlady).** V repozitáři jsou výchozí texty
(`api/resources/translations/{web,shop}/cz.json` – součást kódu, mění se jen commitem), každá
instalace má vlastní texty upravované v adminu (`api/storage/app/public/translations`, mimo git –
lokálně i na serveru). Při startu každého vydání je kontejner `app` sloučí (`php artisan
translations:sync`, výpis v `docker compose logs app`); lokálně totéž udělá `./dev.sh up` a
`init-workspace.sh` před migracemi:

| Klíč | Co se stane |
|---|---|
| nový ve vydání | doplní se |
| změněný ve vydání, v adminu needitovaný | aktualizuje se |
| upravený v adminu | zůstane text z adminu |
| odebraný ve vydání, v adminu needitovaný | odebere se (upravený zůstane) |
| jazyk přidaný v adminu (např. `de.json`) | překlady zůstanou; klíče, které čeština už nemá, se odeberou; nové klíče se nedoplňují – editor je ukáže jako chybějící, dokud je klient nepřeloží |
| `languages.json` (jazyky z adminu) | beze změny |

Server si pamatuje výchozí texty minulého vydání (`storage/app/private/translation-seed`), podle
toho pozná úpravu v adminu. První vydání s touto funkcí je ještě nemá – jen doplní chybějící
klíče. Ručně nahrávat JSON po vydání už není potřeba; náhled bez změn:
`cd /srv/app && docker compose exec app php artisan translations:sync --dry-run`.
Podrobně pro vývojáře (přidání / přejmenování / smazání klíče): `api/resources/translations/README.md`.

---

## 12. Rollback, stav, obnova

**Z GitHubu**: Actions → Release → **Run workflow** (branch `main`):

| action | co udělá |
|---|---|
| `deploy` + tag | nasadí existující tag znovu (bez testů a buildu – image už jsou na ghcr.io) |
| `rollback` | předchozí úspěšná verze (jen kód; databáze zůstává) |
| `rollback-with-db` | předchozí verze **a** databáze ze zálohy před aktuálním vydáním (změny dat od vydání se ztratí) |
| `status` | stav serveru do logu |

**Na serveru** (`ssh klient-vps`):

```bash
/srv/app/deploy.sh status                    # verze, kontejnery, zálohy, disk
/srv/app/deploy.sh rollback [--with-db]
/srv/app/deploy.sh backup manual
/srv/app/deploy.sh restore-db <složka v backups/>   # potvrzení doménou, před tím záloha pre-restore
/srv/app/deploy.sh import <složka>           # db.sql[.gz] + storage.tar.gz
/srv/app/deploy.sh check
cd /srv/app && docker compose logs -f --tail=100 app   # logy (proxy, app, queue, scheduler, db)
```

Rollback potřebuje image předchozí verze na serveru – skript drží poslední 3 vydání.

---

## 13. Nový klient (kopie platformy)

Jeden klient = jeden repozitář = jeden VPS. Repozitář klienta je **samostatná kopie**
`web-platform`, ne fork GitHubu: soukromý repozitář nejde na plánu GitHub Free forknout do
organizace a soukromý fork by GitHub smazal spolu s originálem.

1. GitHub → organizace → **New repository** → název klienta (např. `klient-xyz`), **Private**,
   prázdný (bez README, .gitignore, licence).
2. Lokálně – kopie platformy, `web-platform` jako `upstream` jen pro čtení:
   ```bash
   git clone git@github.com:jonclsolutions/web-platform.git klient-xyz
   cd klient-xyz
   git remote rename origin upstream
   git remote set-url --push upstream NO-PUSH       # do platformy se z klienta nikdy nepushuje
   git remote add origin git@github.com:jonclsolutions/klient-xyz.git
   git push -u origin main
   ./init-workspace.sh                              # lokální vývoj (při souběhu s platformou jiné porty v dev/.env)
   ```
   Hned po pushi běží v novém repozitáři **CI** (Actions → CI) – na projektu se dá pracovat
   okamžitě; nasazení přijde, až má klient server.
3. [setup_hosting.md](setup_hosting.md) pro klienta (doména, e-maily, VPS, `.env` s
   `IMAGE_PREFIX=ghcr.io/jonclsolutions/<repo klienta>` malými písmeny).
4. Kroky 3–9 tohoto návodu v repozitáři klienta (vlastní deploy klíč, vlastní `production`).
5. Opravy z platformy: `git fetch upstream && git cherry-pick <commit>` (jednotlivé opravy) nebo
   `git merge upstream/main` (vše) → testy → tag v repozitáři klienta → nasadí se jen u něj.

---

## 14. Bezpečnost – shrnutí

- **Deploy klíč** umí jen `deploy.sh ci` (`release <tag>`, `rollback`, `status`) – žádný shell,
  žádné přesměrování; server ověřený přes `DEPLOY_KNOWN_HOSTS`.
- **Registry token** = krátkodobý `GITHUB_TOKEN` (jen čtení balíčků), na server jde přes stdin
  do dočasné konfigurace Dockeru, po běhu smazané.
- **Tajné hodnoty klienta** jen v `/srv/app/.env` (600) a Bitwardenu – nikdy v GitHubu ani v image
  (jeden image pro všechny klienty).
- **Actions** připnuté na konkrétní commit (SHA), **základní Docker image a MariaDB** na digest,
  minimální oprávnění každého jobu, jedno nasazení naráz. Kód v API image patří rootovi
  (PHP zapisuje jen do `storage/` a `bootstrap/cache`).
- **Zálohy** 600 / 700, retence 14 dní, kopie mimo VPS jen přes `rrsync` do jedné složky (GDPR:
  osobní údaje se nedrží déle, než je potřeba).
- Databáze nemá port ven; firewall pustí jen 22, 80, 443; SSH jen klíčem (bootstrap.sh).

---

## 15. Když něco nejde

| Problém | Řešení |
|---|---|
| Actions: `Permission denied (publickey)` | `DEPLOY_SSH_KEY` neúplný (chybí řádky BEGIN/END) nebo řádek v `authorized_keys` chybí / je zalomený – krok 3 |
| Actions: `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` nesedí (reinstalace VPS = nový otisk) – krok 5 |
| `command not allowed for the deploy key` | workflow posílá jiný příkaz – jen `release <tag>`, `rollback`, `status` |
| `cannot pull …` / `denied` | `IMAGE_PREFIX` v `.env` není přesně `ghcr.io/<owner>/<repo>` malými písmeny; balíček není propojený s repozitářem (Packages → Package settings → Manage Actions access) |
| `error(s) in /srv/app/.env` | oprav vypsané hodnoty, `/srv/app/deploy.sh check` |
| Vydání spadlo na changelogu / testech / buildu (na server nic nešlo) | oprav, commitni a pushni; tag ještě nikdy nenasazený přesuň na opravený commit: `git tag -d vX && git push origin :refs/tags/vX && git tag -a vX -m "Release vX" && git push origin vX` (sekce changelogu zůstává) |
| Vydání selhalo a vrátilo se | log v Actions; `cd /srv/app && docker compose logs --tail=200 app`; oprav, nový tag |
| `the first release … failed` | první vydání nemá kam se vrátit – zůstane běžet pro diagnózu; oprav a spusť znovu (Run workflow → deploy) |
| `no valid certificate yet` | DNS ještě neukazuje na VPS / CAA nepovoluje letsencrypt.org – setup_hosting.md krok 12, `docker compose logs proxy` |
| E-maily nechodí (2FA) | `docker compose logs queue`; heslo `noreply@`, `MAIL_PORT=465`, `MAIL_SCHEME=smtps` |
| Plný disk | `deploy.sh status`; `docker system df`; staré zálohy (`BACKUP_KEEP_DAYS`), `docker image prune` |
| `copy to BACKUP_REMOTE failed` | otisk záložního serveru nepotvrzený (krok 9.3), klíč / `rrsync` řádek na záložním serveru |
| Zaseklý zámek `another deployment step is still running` | běží jiné vydání / záloha; jinak `ls -l /srv/app/.deploy.lock` a počkej (max. 15 min) |
