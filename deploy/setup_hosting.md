# Hosting na FORPSI – doména, e-maily, VPS

Návod krok za krokem pro **jednu instalaci** (jeden klient = jedna doména + jeden VPS + pošta
k doméně). Každý krok říká **co udělat**, **co se stane** a **jak to ověřit**.

> Po tomto návodu je server připravený (Docker, uživatel `deploy`, firewall, `/srv/app/.env`).
> Automatické nasazování z GitHubu nastavuje navazující **`deploy/deploy_workflow.md`**.

## Rychlá cesta: `provision.sh`

Ručně se dělá jen to, co skript udělat nemůže: **kroky 1–7** (účet, doména, e-maily, DNS pošty,
objednávka VPS), **widget Turnstile** (krok 11), **záznamy DNS webu** (krok 12) a po spuštění
webu **sitemap v Google Search Console** (krok 13). Všechno ostatní – kroky 8–10 tohoto návodu
i kroky 3–9 `deploy_workflow.md` – udělá jeden příkaz z tvého počítače (z kořene repozitáře
instalace):

```bash
gh auth login                                      # jednou: GitHub CLI (https://cli.github.com)
deploy/vps/provision.sh <IP> <doména>              # např. 185.33.145.230 jonclsolutions.com
```

Skript se zeptá jen na: potvrzení otisku serveru, **heslo roota** (jednou, do `ssh-copy-id`),
**heslo `noreply@`** a **Turnstile klíče** (skrytě), případně `APP_KEY` přenášené instalace.
Hesla databáze a `APP_KEY` vygeneruje sám; nic tajného se neukládá na tvůj disk ani nevypisuje.
Pak: bootstrap + restart, `/srv/app` + `deploy.sh check`, deploy klíč a prostředí `production`
na GitHubu, kontrola DNS, tag prvního vydání, první sysadmin, noční zálohy. Spuštěný znovu
přeskočí hotové kroky (bezpečné i na běžící instalaci; nic nerestartuje). Možnosti:
`--alias`, `--key`, `--repo`, `--no-github`, `--new-env`, `--rotate-deploy-key`
(`deploy/vps/provision.sh` bez argumentů je vypíše).

Kapitoly níže popisují tytéž kroky ručně – při chybě skriptu podle nich zjistíš, co se děje.

Obsah:

1. [Co mít připravené](#1-co-mít-připravené)
2. [Účet FORPSI](#2-účet-forpsi)
3. [Doména](#3-doména)
4. [E-mail k doméně](#4-e-mail-k-doméně)
5. [Schránky noreply@, info@, sysadmin@](#5-schránky-noreply-info-sysadmin)
6. [DNS pošty: SPF, DKIM, DMARC](#6-dns-pošty-spf-dkim-dmarc)
7. [VPS](#7-vps)
8. [SSH klíč](#8-ssh-klíč)
9. [Příprava serveru – bootstrap.sh](#9-příprava-serveru--bootstrapsh)
10. [Nastavení instalace – /srv/app/.env](#10-nastavení-instalace--srvappenv)
11. [Cloudflare Turnstile](#11-cloudflare-turnstile)
12. [DNS webu – doména na VPS](#12-dns-webu--doména-na-vps)
13. [Vyhledávače – sitemap do Google Search Console](#13-vyhledávače--sitemap-do-google-search-console)
14. [Kontrolní seznam](#14-kontrolní-seznam)
15. [Když něco nejde](#15-když-něco-nejde)

---

## 1. Co mít připravené

- **Bitwarden** (nebo jiný správce hesel) – do něj patří **každé** heslo a klíč z tohoto návodu.
  Hesla se nikdy neposílají e-mailem, do chatu, do GitHubu ani do tiketu.
- Fakturační údaje firmy klienta (název, IČO, DIČ, adresa) – doména i služby se objednávají
  na firmu (odpočet DPH u plátce, právně čisté vlastnictví domény).
- Počítač s terminálem: Linux / macOS, nebo Windows 10/11 (PowerShell má `ssh` a `scp`).
- Repozitář platformy (soubory `deploy/vps/bootstrap.sh`, `deploy/compose.prod.yaml`,
  `deploy/production.docker.env.example`).

Cena (bez DPH, orientačně): doména .cz ≈ 199 Kč / rok (.com 295 Kč), E-mail k doméně 144 Kč / rok,
VPS Linux 2-4 135 Kč / měsíc → **≈ 1 970 Kč / rok** za instalaci.

---

## 2. Účet FORPSI

1. Založ účet na [forpsi.com](https://www.forpsi.com) (nebo použij účet klienta, pokud ho má).
2. **Zapni dvoufázové přihlášení** (Můj účet → Zabezpečení).
3. Vyplň fakturační údaje firmy (IČO, DIČ).

✔ Ověření: přihlášení vyžaduje druhý faktor, faktury jdou na firmu.

---

## 3. Doména

1. Domény → zadej název → objednat.
2. **Držitel = firma klienta**: kontakt typu *Organizace* (název firmy, IČO, adresa), e-mail
   kontaktu je skutečná schránka klienta.
3. DNS servery nech FORPSI (výchozí) – DNS se spravuje v administraci FORPSI.
4. Zaplať. U gTLD (.com, .eu …) přijde **ověřovací e-mail ICANN** – potvrď do **15 dnů**,
   jinak se doména pozastaví.
5. Zapni **DNSSEC** (detail domény), pokud ještě není.

✔ Ověření: detail domény → stav *Aktivní*, ICANN *ověřeno*, DNSSEC *zapnuto*;
`whois <domena>` ukazuje FORPSI jako registrátora.

---

## 4. E-mail k doméně

1. Detail domény → **E-mail k doméně** (5 schránek po 1 GB) → objednat a zaplatit.
2. Po aktivaci přijde přístup účtu **postmaster@<domena>** – heslo hned ulož do Bitwardenu.
3. FORPSI sám nastaví záznamy **MX** a **SPF** v DNS domény.

✔ Ověření: přihlášení na [webmail.forpsi.com](https://webmail.forpsi.com) jako `postmaster@<domena>`
funguje (první minuty po aktivaci se může hlásit chyba – počkej, než se služba nastaví).

> Víc než 5 schránek: dokoupit schránky, nebo Hosting Easy jen na poštu – co vyjde levněji.
> Admin účty aplikace schránky na doméně **nepotřebují** (můžou mít libovolný e-mail).

---

## 5. Schránky noreply@, info@, sysadmin@

Na webmail.forpsi.com jako **postmaster** → správa schránek → *Nový účet*:

| Schránka | K čemu | Nastavení |
|---|---|---|
| `noreply@` | odesílá e-maily aplikace (2FA, potvrzení, portál) | **vypnout** „změna hesla uživatelem“ a „reset hesla po prvním přihlášení“ – heslo zná jen `.env` serveru |
| `info@` | odpovědi zákazníků (Reply-To e-mailů aplikace), kontakt webu | běžná schránka klienta |
| `sysadmin@` | Let's Encrypt, bezpečnostní upozornění, první sysadmin účet aplikace | tvoje / správcovská |

1. Pro každou schránku vygeneruj v Bitwardenu heslo (**jen písmena a číslice, 20+ znaků** –
   bez `$`, uvozovek a mezer, ať ho jde vložit do `.env` bez úprav) a ulož ho.
2. Pošli z `noreply@` zkušební e-mail na svůj Gmail / Seznam a odpověz na něj z `info@`.

✔ Ověření: zkušební e-mail dorazil **do doručené pošty** (ne do spamu), odpověď také.

SMTP pro aplikaci (jde do `.env`, krok 10): `smtp.forpsi.com`, port **465** (SSL), přihlášení
celou adresou `noreply@<domena>`. Limity FORPSI: 1 000 e-mailů / hod., 20 000 / den;
**10 chybných přihlášení za hodinu zablokuje IP serveru** – heslo nejdřív ověř ve webmailu.

---

## 6. DNS pošty: SPF, DKIM, DMARC

Bez nich končí e-maily aplikace ve spamu.

1. **SPF** – FORPSI nastavil sám; zkontroluj TXT záznam domény:
   `v=spf1 a mx include:_spf.forpsi.com -all`
2. **DKIM** – v administraci FORPSI u pošty domény **zapnout DKIM**. FORPSI přidá TXT záznam
   `<selektor>._domainkey` (např. `f2026._domainkey`).
3. **DMARC** – v editaci DNS přidej TXT záznam:
   - název `_dmarc`
   - hodnota `v=DMARC1; p=none; rua=mailto:sysadmin@<domena>`
   - po 2–4 týdnech bez problémů změň `p=none` na `p=quarantine`.

✔ Ověření (po 15–60 min):
```bash
dig +short TXT <domena>                 # SPF
dig +short TXT _dmarc.<domena>          # DMARC
dig +short TXT f2026._domainkey.<domena> # DKIM (podle selektoru FORPSI)
```
a zkušební e-mail z `noreply@` na [mail-tester.com](https://www.mail-tester.com) → skóre 9/10 a víc,
SPF / DKIM / DMARC *pass*.

---

## 7. VPS

1. VPS & serverová řešení → **VPS Linux 2-4** (2 vCPU, 4 GB RAM, 40 GB).
2. Operační systém **Ubuntu Server 24.04 LTS**, předinstalovaná aplikace **žádná**
   (žádný Plesk / LAMP – vše běží v Dockeru).
3. **Heslo roota**: 14–20 znaků, **bez `$`** (FORPSI ho odmítne), vygenerovat v Bitwardenu,
   uložit tam. Nikam jinam ho nepiš – po kroku 9 se root heslem stejně přihlásit nepůjde.
4. Pokud formulář nabízí **SSH klíč**, vlož **veřejný** klíč z kroku 8 (`….pub`) – krok 8.3 pak odpadá.
5. Zúčtovací období: měsíční / čtvrtletní / roční podle ceny; zapni automatickou platbu,
   ať VPS nevyprší.
6. Počkej na e-mail od FORPSI s **IP adresou** (IPv4, případně IPv6) – zapiš ji do Bitwardenu
   k záznamu klienta.

✔ Ověření: administrace FORPSI → VPS *běží*, IP adresa známá; `ping <IP>` odpovídá.

---

## 8. SSH klíč

Klíč je tvůj **osobní** přístup na servery (jeden pro všechny klienty). GitHub dostane později
**vlastní** deploy klíč (deploy_workflow.md) – osobní klíč nikdy neopouští tvůj počítač.

1. Vytvoř klíč (jednou, pokud ho ještě nemáš) a nastav mu heslo (passphrase):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_server -C "js-servers-2026"
   ```
   Vzniknou dva soubory: `id_ed25519_server` (**soukromý** – nikomu, nikam) a
   `id_ed25519_server.pub` (veřejný – ten se dává na servery).
2. Zástupce serveru v `~/.ssh/config` (Windows: `C:\Users\<ty>\.ssh\config`):
   ```
   Host klient-vps
       HostName <IP>
       User deploy
       IdentityFile ~/.ssh/id_ed25519_server
       IdentitiesOnly yes
   ```
3. Nahraj veřejný klíč rootovi (zeptá se jednou na heslo roota – píšeš ho jen do terminálu):
   - Linux / macOS:
     ```bash
     ssh-copy-id -i ~/.ssh/id_ed25519_server.pub root@<IP>
     ```
   - Windows PowerShell:
     ```powershell
     type $env:USERPROFILE\.ssh\id_ed25519_server.pub | ssh root@<IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
     ```

✔ Ověření: `ssh -i ~/.ssh/id_ed25519_server root@<IP>` se přihlásí **bez hesla roota**
(jen passphrase klíče).

> Při **prvním** připojení se SSH zeptá `Are you sure you want to continue connecting` a ukáže
> otisk serveru (`ED25519 key fingerprint is SHA256:…`). Odpověz celým slovem `yes` a otisk si
> zapiš k serveru do Bitwardenu – porovnáš s ním otisk pro GitHub (deploy_workflow.md, krok 5).
> Uvítací obrazovka ukáže i **IPv6 adresu** serveru (`IPv6 address for …`) – potřebuješ ji
> v kroku 12.

---

## 9. Příprava serveru – bootstrap.sh

Jednorázově, jako root. Skript: aktualizace systému, časová zóna, swap, **Docker** z oficiálního
repozitáře, uživatel **`deploy`** (bez sudo, ve skupině docker, s tvým klíčem), adresář
**`/srv/app`**, **SSH jen klíčem** (root bez hesla), firewall **ufw** (22, 80, 443),
**fail2ban**, **automatické bezpečnostní aktualizace** (restart ve 04:30, když je potřeba).

```bash
scp -i ~/.ssh/id_ed25519_server deploy/vps/bootstrap.sh root@<IP>:/root/
ssh -i ~/.ssh/id_ed25519_server root@<IP> 'bash /root/bootstrap.sh'
```

- Trvá 3–10 minut. Konec vypíše **Done** a případná varování.
- Skript lze spustit znovu (každý krok nejdřív zjistí stav).
- Pokud na serveru ještě není klíč roota, SSH **nechá heslo zapnuté** a vypíše varování – doplň
  klíč (krok 8.3) a spusť skript znovu. Zablokovat se tím nedá.
- Hlášku `New release '26.04…' available / Run 'do-release-upgrade'` **ignoruj** – server zůstává
  na 24.04 LTS (podpora do 2029); upgrade na novou verzi systému se nespouští.

Po prvním běhu **restartuj server** (aktualizace přinesly nové jádro – uvítací obrazovka hlásí
`System restart required`):
```bash
ssh -i ~/.ssh/id_ed25519_server root@<IP> reboot
```

✔ Ověření po 1–2 minutách – v **novém** terminálu:
```bash
ssh klient-vps 'uname -r'                         # přihlášení jako deploy klíčem, nové jádro
ssh klient-vps 'docker run --rm hello-world'      # deploy smí používat Docker („Hello from Docker!“)
ssh -o PubkeyAuthentication=no root@<IP>          # musí skončit: Permission denied (publickey)
ssh -i ~/.ssh/id_ed25519_server root@<IP> ufw status   # 22, 80, 443 ALLOW
```

---

## 10. Nastavení instalace – /srv/app/.env

Jeden soubor s nastavením klienta (doména, databáze, SMTP, Turnstile). Je **jen na serveru**
a v Bitwardenu.

> **Ostré hodnoty se zapisují jen na serveru** (`nano /srv/app/.env`) – nikdy do šablony
> `deploy/production.docker.env.example` v repozitáři a nikdy se neposílají (ani screenshot
> `.env`). Uniklé heslo / secret se hned mění: heslo schránky ve webmailu FORPSI (postmaster),
> Turnstile v Cloudflare → widget → *Rotate Secret Key*.

1. Nahraj šablony a skript nasazení (z kořene repozitáře):
   ```bash
   scp deploy/compose.prod.yaml klient-vps:/srv/app/compose.yaml
   scp deploy/production.docker.env.example klient-vps:/srv/app/.env
   scp deploy/vps/deploy.sh klient-vps:/srv/app/deploy.sh
   ssh klient-vps 'chmod 600 /srv/app/.env && chmod 750 /srv/app/deploy.sh && ls -la /srv/app'
   ```
   (`ls -la` – `.env` začíná tečkou, obyčejné `ls -l` ho nezobrazí.)
2. Vygeneruj tajné hodnoty **na serveru** (nikam se neposílají). Nejdřív se přihlas, příkazy
   vlož až po promptu `deploy@…:~$`:
   ```bash
   ssh klient-vps
   ```
   ```bash
   echo "APP_KEY=base64:$(openssl rand -base64 32)"
   echo "DB_PASSWORD=$(openssl rand -hex 24)"
   echo "DB_ROOT_PASSWORD=$(openssl rand -hex 24)"
   ```
3. `nano /srv/app/.env` a vyplň. V nano: vložení ze schránky **Ctrl+Shift+V** (v terminálu,
   na macOS Cmd+V), kopírování výstupu v terminálu **Ctrl+Shift+C**, hledání Ctrl+W, smazání
   řádku Ctrl+K, uložení Ctrl+O + Enter, konec Ctrl+X.
   Hesla jen z písmen a číslic; obsahuje-li hodnota `$`, `!`, `&`, mezeru nebo `#`, dej ji do
   jednoduchých uvozovek (`MAIL_PASSWORD='…'`).

   | Hodnota | Co tam patří |
   |---|---|
   | `IMAGE_PREFIX` | `ghcr.io/<organizace>/<repozitář klienta>` (deploy_workflow.md) |
   | `SITE_DOMAIN` | doména **bez** www, např. `jonclsolutions.com` |
   | `ACME_EMAIL` | `sysadmin@<domena>` |
   | `APP_URL`, `FRONTEND_URL` | `https://<domena>` (obě stejné) |
   | `APP_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | z bodu 2 |
   | `DB_DATABASE`, `DB_USERNAME` | nech `app` / `app` (nikdy `root`) |
   | `MAIL_USERNAME`, `MAIL_FROM_ADDRESS` | `noreply@<domena>` |
   | `MAIL_PASSWORD` | heslo `noreply@` (krok 5) |
   | `MAIL_REPLY_TO_ADDRESS` | `info@<domena>` |
   | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | krok 11 |
   | `RELEASE` | nech prázdné – vyplní nasazení |

4. Celý obsah `.env` ulož do Bitwardenu jako zabezpečenou poznámku „<klient> – .env“.

✔ Ověření: `/srv/app/deploy.sh check` → `OK` (vypíše všechny problémy najednou, hesla
neukazuje). Prázdné zůstávají jen `RELEASE`, `TRUSTED_PROXIES`, `CORS_ALLOWED_ORIGINS`,
`BACKUP_REMOTE`.

> **`APP_KEY` se po prvním spuštění už nikdy nemění** – jiný klíč odhlásí všechny a zašifrovaná
> data přestanou být čitelná.

---

## 11. Cloudflare Turnstile

Captcha přihlášení a veřejných formulářů.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → **Add widget**.
2. Název = klient, **Hostname** = `<domena>` (a `www.<domena>`), režim **Managed**.
3. Zkopíruj **Site Key** (veřejný) a **Secret Key** (tajný) do `/srv/app/.env`
   (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`); Secret Key i do Bitwardenu.

Site key se do aplikace nevkládá při buildu – kontejner `proxy` ho při startu předá prohlížeči
(`/runtime-config.js`), takže jeden image slouží všem klientům.

✔ Ověření (po nasazení): na `/auth/login` se zobrazí widget Turnstile bez chyby v konzoli.

---

## 12. DNS webu – doména na VPS

Udělej, až je aplikace na VPS připravená ke spuštění (deploy_workflow.md) – u nové domény bez
webu klidně hned. Certifikát **Let's Encrypt vydá Caddy sám** při prvním startu, jakmile doména
ukazuje na VPS (porty 80 a 443 jsou otevřené z kroku 9). SSL se u FORPSI **nekupuje**.

V administraci FORPSI → doména → **Editace DNS záznamů** (Hostname prázdný = doména sama):

1. Přenášíš-li běžící web: den předem sniž **TTL** záznamů `@` a `www` na 300 s.
2. Záznam **A** `@` (řádek `<domena> … A 81.2.196.19` – parkovací IP FORPSI) → **Upravit** →
   hodnota **IPv4 VPS**, TTL 300.
3. Záznam **AAAA** `@` (Typ AAAA, Hostname prázdný) → **IPv6 VPS** z kroku 8 (např.
   `2001:15e8:110:2de6::1`); nemá-li VPS IPv6, žádný AAAA (ani starý).
4. **www**: pokud existuje `*` (wildcard) CNAME na doménu, stačí; jinak CNAME `www` → `<domena>.`
5. **CAA** `@`: Typ CAA, Hostname prázdný, **Flags `0`**, **Tag `issue`**, **Hodnota jen
   `letsencrypt.org`** (formulář má flags a tag zvlášť – do hodnoty ne `0 issue`). V seznamu
   pak musí být `0 issue "letsencrypt.org"`.
6. **MX, SPF, DKIM, DMARC, autoconfig, autodiscover, SRV nech beze změny** – pošta běží dál
   u FORPSI. SPF s `a` pak povoluje i IP VPS – nevadí, aplikace posílá přes SMTP FORPSI.
7. Tlačítka nahoře (**nastavit na stránku / na webserver FORPSI / na mailserver FORPSI**)
   **nemačkej** – přepsala by záznamy zpět na služby FORPSI.

✔ Ověření:
```bash
dig +short A <domena>        # IP VPS
dig +short AAAA <domena>     # IPv6 VPS nebo nic
dig +short www.<domena>      # vede na doménu / IP VPS
dig +short CAA <domena>      # 0 issue "letsencrypt.org"
```
Po spuštění stacku: `https://<domena>` má platný certifikát (zámek v prohlížeči),
`http://` a `https://www.` přesměrují na `https://<domena>`:
```bash
curl -s https://<domena>/api/version          # {"version":"v…"} = nasazená verze, platný certifikát
curl -sI https://www.<domena> | head -3        # 301, location: https://<domena>/
curl -sI http://<domena> | head -3             # 308 → https://
```

---

## 13. Vyhledávače – sitemap do Google Search Console

Udělej, až web běží na doméně s certifikátem (krok 12). **Nezapomeň** – bez toho Google web
najde jen pomalu a nevidíš, co z něj zaindexoval.

Web si **sitemap generuje sám**: `https://<domena>/sitemap.xml` (všechny veřejné stránky webu
a e-shopu ve všech aktivních jazycích) a odkazuje na ni z `/robots.txt`. Na web se nic
nepřidává (žádný skript, žádné cookies) – GDPR beze změny.

1. **search.google.com/search-console** → přihlas se Google účtem **firmy klienta** (ne
   osobním) → **Přidat službu** → typ **Doména** → `<domena>` (pokryje https, www i všechny
   jazyky).
2. Google ukáže TXT záznam `google-site-verification=…` → FORPSI → Editace DNS záznamů →
   nový **TXT**, Hostname prázdný, hodnota celý řetězec → v Search Console **Ověřit** (DNS se
   projeví za 5–60 min). Záznam pak **nemaž**, ověření by propadlo.
3. Search Console → **Sitemapy** → `sitemap.xml` → **Odeslat**. Stav má být *Úspěch*
   a počet adres odpovídá stránkám × jazykům.
4. Volitelně **Bing Webmaster Tools** (bing.com/webmasters) → *Import ze Search Console* –
   pokryje Bing a DuckDuckGo. Seznam.cz sitemap najde sám přes `robots.txt`.

✔ Ověření:
```bash
curl -s https://<domena>/robots.txt | tail -1    # Sitemap: https://<domena>/sitemap.xml
curl -s https://<domena>/sitemap.xml | head -6   # <loc>https://<domena>/cs</loc> …
curl -sI https://<domena>/ | grep -iE '^(location|vary)'   # location: /<jazyk>, vary: Accept-Language
```
Adresy v sitemap musí začínat skutečnou doménou – jinak oprav `FRONTEND_URL` v
`/srv/app/.env` (krok 10) a `docker compose up -d`.

Přístup do Search Console (účet) zapiš do Bitwardenu ke klientovi.

---

## 14. Kontrolní seznam

**FORPSI**
- [ ] účet s dvoufázovým přihlášením, fakturace na firmu
- [ ] doména – držitel firma klienta, ICANN ověřeno, DNSSEC
- [ ] E-mail k doméně, `postmaster@` v Bitwardenu
- [ ] `noreply@` (bez změny / resetu hesla), `info@`, `sysadmin@` – hesla v Bitwardenu
- [ ] SPF, DKIM, DMARC; mail-tester 9/10+
- [ ] VPS 2-4, Ubuntu 24.04, aplikace „žádná“, heslo roota v Bitwardenu, IP zapsaná

**Server**
- [ ] klíč rootovi (`ssh-copy-id`), `bootstrap.sh` bez varování
- [ ] `ssh deploy@<IP>` klíčem funguje, root heslem ne
- [ ] `/srv/app/compose.yaml`, `/srv/app/.env` (600) vyplněný, kopie `.env` v Bitwardenu
- [ ] Turnstile widget, klíče v `.env`

**DNS webu** (podle kroku 12)
- [ ] A / AAAA → VPS, www, CAA

**Vyhledávače** (podle kroku 13, až web běží)
- [ ] Search Console: doména ověřená TXT záznamem, `sitemap.xml` odeslaná, stav *Úspěch*

**Dál**: `deploy/deploy_workflow.md` – GitHub Actions, první nasazení, zálohy.

Do Bitwardenu k záznamu klienta: přihlášení FORPSI, IP VPS, heslo roota, `postmaster@`,
`noreply@`, `info@`, `sysadmin@`, `.env`, Turnstile secret, účet Search Console.

---

## 15. Když něco nejde

| Problém | Řešení |
|---|---|
| `ssh` píše *Permission denied (publickey)* jako deploy | klíč není u deploy: přihlas se jako root klíčem a spusť `bootstrap.sh` znovu (zkopíruje klíče roota) |
| Zablokoval jsem se (žádné SSH) | administrace FORPSI → VPS → **konzole (VNC)** → přihlášení rootem heslem z Bitwardenu → oprav `/root/.ssh/authorized_keys` |
| fail2ban zablokoval moji IP | počkej hodinu, nebo v konzoli FORPSI: `fail2ban-client set sshd unbanip <tvoje IP>` |
| E-maily aplikace nechodí | heslo `noreply@` ve webmailu; `MAIL_PORT=465`, `MAIL_SCHEME=smtps`; po 10 chybných přihlášeních je IP serveru na čas blokovaná – oprav heslo a počkej |
| E-maily končí ve spamu | DKIM zapnutý? DMARC záznam? mail-tester ukáže, co chybí |
| Certifikát se nevydá | `dig +short A <domena>` = IP VPS? CAA povoluje letsencrypt.org? porty 80/443 v `ufw status`? log: `docker compose logs proxy` |
| FORPSI odmítá heslo roota | 14–20 znaků, bez `$` |
| `bootstrap.sh`: `ERROR: Invalid syntax` u ufw | starší verze skriptu (apostrof v poznámce pravidla) – aktuální z repozitáře nahraj a spusť znovu |
| Do nano nejde vložit text | Ctrl+Shift+V (Ctrl+V v nano jen posune stránku) nebo pravé tlačítko → Vložit |
| Webmail postmastera hlásí chybu hned po objednání | služba se ještě nastavuje – zkus za 15–30 min |
| Search Console: sitemap „Nelze načíst“ / ověření selže | `curl` z kroku 13 vrací sitemap? TXT záznam je u domény (`dig +short TXT <domena>`)? DNS se ještě šíří – zkus za hodinu |
