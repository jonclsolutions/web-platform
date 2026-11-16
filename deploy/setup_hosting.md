# Hosting na FORPSI – doména, e-maily, VPS

Návod krok za krokem pro **jednu instalaci** (jeden klient = jedna doména + jeden VPS + pošta
k doméně). Každý krok říká **co udělat**, **co se stane** a **jak to ověřit**.

> Po tomto návodu je server připravený (Docker, uživatel `deploy`, firewall, `/srv/app/.env`).
> Automatické nasazování z GitHubu nastavuje navazující **`deploy/deploy_workflow.md`**.

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
13. [Kontrolní seznam](#13-kontrolní-seznam)
14. [Když něco nejde](#14-když-něco-nejde)

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

✔ Ověření – v **novém** terminálu (původní nech otevřený, dokud vše nefunguje):
```bash
ssh klient-vps                                    # přihlášení jako deploy klíčem
docker run --rm hello-world                       # deploy smí používat Docker
ssh -o PubkeyAuthentication=no root@<IP>          # musí skončit: Permission denied (publickey)
ssh -i ~/.ssh/id_ed25519_server root@<IP> ufw status   # 22, 80, 443 ALLOW
```

---

## 10. Nastavení instalace – /srv/app/.env

Jeden soubor s nastavením klienta (doména, databáze, SMTP, Turnstile). Je **jen na serveru**
a v Bitwardenu.

1. Nahraj šablony (z kořene repozitáře):
   ```bash
   scp deploy/compose.prod.yaml klient-vps:/srv/app/compose.yaml
   scp deploy/production.docker.env.example klient-vps:/srv/app/.env
   ssh klient-vps 'chmod 600 /srv/app/.env'
   ```
2. Vygeneruj tajné hodnoty **na serveru** (nikam se neposílají):
   ```bash
   ssh klient-vps
   echo "APP_KEY=base64:$(openssl rand -base64 32)"
   echo "DB_PASSWORD=$(openssl rand -hex 24)"
   echo "DB_ROOT_PASSWORD=$(openssl rand -hex 24)"
   ```
3. `nano /srv/app/.env` a vyplň:

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

✔ Ověření: `ls -l /srv/app/.env` → `-rw------- deploy deploy`;
`grep -c '=$' /srv/app/.env` – prázdné zůstávají jen `RELEASE`, `TRUSTED_PROXIES`,
`CORS_ALLOWED_ORIGINS` (a Turnstile, dokud není krok 11).

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

V administraci FORPSI → doména → **Editace DNS záznamů**:

1. Den předem sniž **TTL** záznamů `@` a `www` na 300 s (rychlejší přepnutí).
2. Záznam **A** `@` (doména bez www): místo parkovací IP FORPSI (např. `81.2.196.19`) → **IPv4 VPS**.
3. Záznam **AAAA** `@` → **IPv6 VPS** (pokud ji VPS má; jinak žádný AAAA, ani starý).
4. **www**: pokud existuje `*` (wildcard) CNAME na doménu, stačí; jinak CNAME `www` → `<domena>.`
5. **CAA** `@`: `0 issue "letsencrypt.org"` (certifikáty smí vydat jen Let's Encrypt).
6. **MX, SPF, DKIM, DMARC nech beze změny** – pošta běží dál u FORPSI.

✔ Ověření:
```bash
dig +short A <domena>        # IP VPS
dig +short AAAA <domena>     # IPv6 VPS nebo nic
dig +short www.<domena>      # vede na doménu / IP VPS
dig +short CAA <domena>      # 0 issue "letsencrypt.org"
```
Po spuštění stacku: `https://<domena>` má platný certifikát (zámek v prohlížeči),
`http://` a `https://www.` přesměrují na `https://<domena>`.

---

## 13. Kontrolní seznam

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

**Dál**: `deploy/deploy_workflow.md` – GitHub Actions, první nasazení, zálohy.

Do Bitwardenu k záznamu klienta: přihlášení FORPSI, IP VPS, heslo roota, `postmaster@`,
`noreply@`, `info@`, `sysadmin@`, `.env`, Turnstile secret.

---

## 14. Když něco nejde

| Problém | Řešení |
|---|---|
| `ssh` píše *Permission denied (publickey)* jako deploy | klíč není u deploy: přihlas se jako root klíčem a spusť `bootstrap.sh` znovu (zkopíruje klíče roota) |
| Zablokoval jsem se (žádné SSH) | administrace FORPSI → VPS → **konzole (VNC)** → přihlášení rootem heslem z Bitwardenu → oprav `/root/.ssh/authorized_keys` |
| fail2ban zablokoval moji IP | počkej hodinu, nebo v konzoli FORPSI: `fail2ban-client set sshd unbanip <tvoje IP>` |
| E-maily aplikace nechodí | heslo `noreply@` ve webmailu; `MAIL_PORT=465`, `MAIL_SCHEME=smtps`; po 10 chybných přihlášeních je IP serveru na čas blokovaná – oprav heslo a počkej |
| E-maily končí ve spamu | DKIM zapnutý? DMARC záznam? mail-tester ukáže, co chybí |
| Certifikát se nevydá | `dig +short A <domena>` = IP VPS? CAA povoluje letsencrypt.org? porty 80/443 v `ufw status`? log: `docker compose logs proxy` |
| FORPSI odmítá heslo roota | 14–20 znaků, bez `$` |
| Webmail postmastera hlásí chybu hned po objednání | služba se ještě nastavuje – zkus za 15–30 min |
