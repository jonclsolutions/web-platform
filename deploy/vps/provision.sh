#!/usr/bin/env bash
# =============================================================================
# @file provision.sh
# @path deploy/vps/provision.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Prepares a NEW installation from your computer in one run - everything that
#   setup_hosting.md (steps 8-10) and deploy_workflow.md (steps 3-9) describe by hand:
#     1. host key of the server (fingerprint shown for a check), your SSH key for root
#     2. alias in ~/.ssh/config
#     3. bootstrap.sh on the server (Docker, user deploy, SSH keys only, firewall, updates)
#        and a reboot when the system asks for one
#     4. /srv/app: compose.yaml, deploy.sh and .env - the secrets of the database and APP_KEY
#        are generated, the e-mail password and the Turnstile keys are asked for (hidden input);
#        then deploy.sh check
#     5. deploy key of GitHub (forced command deploy.sh ci on the server) and the environment
#        `production` of the repository (variables DEPLOY_HOST / DEPLOY_KNOWN_HOSTS, secret
#        DEPLOY_SSH_KEY, rules tag v* + branch main) through the GitHub CLI
#     6. check of the DNS (A / AAAA / CAA) - the records themselves are set at FORPSI by hand
#     7. first release (tag), the first sysadmin, nightly backups
#   Every step checks its state first: run it again after a stop or a fix, done steps are skipped.
# @usage From the root of the repository of the installation:
#     deploy/vps/provision.sh <IP> <domain> [options]
#     deploy/vps/provision.sh 185.33.145.230 jonclsolutions.com
#   Options:
#     --alias <name>        SSH alias of the server (default: <first part of the domain>-vps)
#     --key <file>          your personal SSH key (default: ~/.ssh/id_ed25519_server)
#     --repo <owner/repo>   GitHub repository (default: from the remote origin)
#     --no-github           skip the GitHub part (the values to enter by hand are printed)
#     --new-env             write /srv/app/.env again (a running installation keeps APP_KEY
#                           only when you enter it - see the prompt)
#     --rotate-deploy-key   replace the deploy key of GitHub
# @dependencies bash 4+, ssh, scp, ssh-keygen, ssh-keyscan, ssh-copy-id, openssl, git;
#   gh (GitHub CLI, logged in: gh auth login) for step 5; dig for step 6 (optional).
# @security Nothing secret is written to your disk or printed: the generated passwords and the
#   ones you type go straight through SSH into /srv/app/.env (mode 600); the deploy key exists only
#   in a temporary folder until it is stored in GitHub, then it is deleted. The root password is
#   typed only into ssh-copy-id, once.
# =============================================================================
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="$ROOT_DIR/deploy/production.docker.env.example"
TMP_DIR=""

step() { printf '\n\e[34m==> %s\e[0m\n' "$*"; }
info() { printf '    - %s\n' "$*"; }
warn() { printf '\e[33m    ! %s\e[0m\n' "$*" >&2; }
die()  { printf '\e[31mERROR: %s\e[0m\n' "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# @description Yes / no question on the terminal.
# @param $1 Question. @param $2 Default (y or n).
# @return 0 = yes.
# -----------------------------------------------------------------------------
ask_yes() {
    local answer hint="[y/N]"
    [[ "${2:-n}" == "y" ]] && hint="[Y/n]"
    read -r -p "    ? $1 $hint " answer </dev/tty
    answer="${answer:-${2:-n}}"
    [[ "$answer" =~ ^[YyAa] ]]
}

# -----------------------------------------------------------------------------
# @description Asks for a value (visible) with an optional default.
# @param $1 Prompt. @param $2 Default. @param $3 Name of the variable to set.
# -----------------------------------------------------------------------------
ask_value() {
    local answer
    read -r -p "    ? $1${2:+ [$2]}: " answer </dev/tty
    printf -v "$3" '%s' "${answer:-$2}"
}

# -----------------------------------------------------------------------------
# @description Asks for a secret twice (hidden), never printed.
# @param $1 Prompt. @param $2 Name of the variable to set.
# -----------------------------------------------------------------------------
ask_secret() {
    local first second
    while true; do
        read -r -s -p "    ? $1: " first </dev/tty; echo
        read -r -s -p "    ? $1 (again): " second </dev/tty; echo
        if [[ -z "$first" ]]; then warn "empty - try again"; continue; fi
        if [[ "$first" != "$second" ]]; then warn "the two entries differ - try again"; continue; fi
        if [[ "$first" == *"'"* ]]; then warn "an apostrophe (') cannot be stored in .env - change the password"; continue; fi
        printf -v "$2" '%s' "$first"
        return 0
    done
}

# -----------------------------------------------------------------------------
# @description A value for .env: plain when it has only safe characters, otherwise in single
# quotes (taken literally by Docker Compose and Laravel). Values with ' are refused earlier.
# @param $1 Value.
# -----------------------------------------------------------------------------
env_quote() {
    if [[ "$1" =~ ^[A-Za-z0-9@._:/+=,-]*$ ]]; then
        printf '%s' "$1"
    else
        printf "'%s'" "$1"
    fi
}

# -----------------------------------------------------------------------------
# @description Writes the template with the given values to stdout. The values come from the
# environment (PV_<KEY>), never from the command line (no secret in the process list).
# @param $1 Template file. @param $2.. Keys to replace (each with PV_<KEY> exported).
# -----------------------------------------------------------------------------
render_env() {
    local template="$1"
    shift
    PV_KEYS="$*" awk '
        BEGIN { n = split(ENVIRON["PV_KEYS"], keys, " "); for (i = 1; i <= n; i++) want[keys[i]] = 1 }
        {
            if (match($0, /^[A-Z_][A-Z0-9_]*=/)) {
                key = substr($0, 1, RLENGTH - 1)
                if (key in want) { print key "=" ENVIRON["PV_" key]; next }
            }
            print
        }' "$template"
}

# -----------------------------------------------------------------------------
# @description ssh / scp as root (your key) and as deploy (the alias).
# -----------------------------------------------------------------------------
root_ssh() { ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "root@$IP" "$@"; }
dep_ssh()  { ssh -o BatchMode=yes -o ConnectTimeout=10 "$ALIAS" "$@"; }

parse_args() {
    IP="${1:-}"; DOMAIN="${2:-}"
    [[ -n "$IP" && -n "$DOMAIN" ]] || { sed -n '/^# @usage/,/^# @dependencies/p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
    shift 2
    ALIAS="${DOMAIN%%.*}-vps"
    KEY="$HOME/.ssh/id_ed25519_server"
    REPO=""; GITHUB=1; NEW_ENV=0; ROTATE_KEY=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --alias) ALIAS="$2"; shift 2 ;;
            --key) KEY="$2"; shift 2 ;;
            --repo) REPO="$2"; shift 2 ;;
            --no-github) GITHUB=0; shift ;;
            --new-env) NEW_ENV=1; shift ;;
            --rotate-deploy-key) ROTATE_KEY=1; shift ;;
            *) die "unknown option $1" ;;
        esac
    done
    [[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "IP '$IP' is not an IPv4 address"
    [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || die "domain '$DOMAIN' must be lower case, without www and without https://"
    [[ "$DOMAIN" != www.* ]] || die "the domain without www"
    [[ "$ALIAS" =~ ^[A-Za-z0-9._-]+$ ]] || die "alias '$ALIAS' is not valid"
    if [[ -z "$REPO" ]]; then
        REPO="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')"
    fi
    [[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || die "GitHub repository not found - use --repo <owner/repo>"
    IMAGE_PREFIX="ghcr.io/${REPO,,}"
}

preflight() {
    step "Checks"
    (( BASH_VERSINFO[0] >= 4 )) || die "bash 4+ needed (macOS: brew install bash)"
    local c
    for c in ssh scp ssh-keygen ssh-keyscan ssh-copy-id openssl git awk; do
        command -v "$c" >/dev/null || die "$c is missing"
    done
    [[ -f "$TEMPLATE" && -f "$ROOT_DIR/deploy/vps/bootstrap.sh" ]] || die "run it from the repository of the installation"
    if [[ $GITHUB -eq 1 ]]; then
        command -v gh >/dev/null || die "GitHub CLI is missing (https://cli.github.com) - or use --no-github"
        gh auth status >/dev/null 2>&1 || die "GitHub CLI is not logged in: gh auth login"
        gh repo view "$REPO" >/dev/null 2>&1 || die "repository $REPO is not reachable with your GitHub login"
    fi
    if [[ ! -f "$KEY" ]]; then
        warn "your SSH key $KEY does not exist"
        ask_yes "create it now (with a passphrase)?" y || die "SSH key needed"
        ssh-keygen -t ed25519 -f "$KEY" -C "$(whoami)-servers-$(date +%Y)"
    fi
    info "server $IP, domain $DOMAIN, alias $ALIAS, repository $REPO, images $IMAGE_PREFIX"
}

# -----------------------------------------------------------------------------
# @description Host key: shows the fingerprint once and stores it in ~/.ssh/known_hosts.
# -----------------------------------------------------------------------------
host_key() {
    step "Host key of the server"
    HOST_LINE="$(ssh-keyscan -t ed25519 "$IP" 2>/dev/null | grep -v '^#' | head -n1)"
    [[ -n "$HOST_LINE" ]] || die "the server does not answer on port 22 - is it running? (FORPSI → VPS → Stav serveru)"
    local fp
    fp="$(printf '%s\n' "$HOST_LINE" | ssh-keygen -lf - | awk '{ print $2 }')"
    if ssh-keygen -F "$IP" >/dev/null 2>&1; then
        info "known: $fp"
        return
    fi
    info "fingerprint: $fp"
    info "(compare in the FORPSI recovery console if you want to be sure: ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub)"
    ask_yes "is this the server you ordered?" y || die "stopped - nothing changed"
    printf '%s\n' "$HOST_LINE" >> "$HOME/.ssh/known_hosts"
    info "stored in ~/.ssh/known_hosts - write the fingerprint into Bitwarden next to the server"
}

root_key() {
    step "Your SSH key for root"
    if root_ssh true 2>/dev/null; then
        info "root accepts your key"
        return
    fi
    info "type the ROOT PASSWORD of the VPS once (from Bitwarden) - it is not stored"
    ssh-copy-id -i "$KEY.pub" "root@$IP"
    root_ssh true || die "root still does not accept the key"
    info "done"
}

ssh_alias() {
    step "Alias $ALIAS in ~/.ssh/config"
    touch "$HOME/.ssh/config"; chmod 600 "$HOME/.ssh/config"
    if grep -qE "^Host[[:space:]]+$ALIAS([[:space:]]|$)" "$HOME/.ssh/config"; then
        info "exists - kept"
        return
    fi
    printf '\nHost %s\n    HostName %s\n    User deploy\n    IdentityFile %s\n    IdentitiesOnly yes\n' \
        "$ALIAS" "$IP" "$KEY" >> "$HOME/.ssh/config"
    info "added: ssh $ALIAS"
}

# -----------------------------------------------------------------------------
# @description bootstrap.sh as root (skipped when the server is ready), reboot when needed.
# -----------------------------------------------------------------------------
bootstrap() {
    step "Server (bootstrap.sh)"
    local ran=0
    if dep_ssh 'docker info >/dev/null 2>&1 && test -d /srv/app' 2>/dev/null && root_ssh 'ufw status | grep -q "Status: active"'; then
        info "prepared already - skipped"
    else
        info "takes 3-10 minutes (system updates, Docker, user deploy, firewall)"
        scp -q -i "$KEY" -o IdentitiesOnly=yes "$ROOT_DIR/deploy/vps/bootstrap.sh" "root@$IP:/root/bootstrap.sh"
        root_ssh 'bash /root/bootstrap.sh' || die "bootstrap.sh failed - see its output above"
        ran=1
    fi
    # A running installation is never rebooted from here (the automatic updates restart it at
    # 04:30); only right after its first preparation.
    if [[ $ran -eq 0 ]] && root_ssh 'test -f /var/run/reboot-required'; then
        info "a restart is pending - the server does it itself at 04:30"
    elif [[ $ran -eq 1 ]] && root_ssh 'test -f /var/run/reboot-required'; then
        info "the system asks for a restart (new kernel) - rebooting"
        root_ssh reboot || true
        sleep 15
        local i
        for i in $(seq 1 40); do
            dep_ssh true 2>/dev/null && break
            sleep 5
            [[ $i -eq 40 ]] && die "the server did not come back after the reboot - check the FORPSI administration"
        done
        info "back: kernel $(dep_ssh uname -r)"
    fi
    dep_ssh 'docker run --rm hello-world >/dev/null' || die "user deploy cannot run Docker"
    info "user deploy logs in with your key and runs Docker"
    # The effective configuration of sshd (not a login attempt - that would count for fail2ban).
    local sshd_conf
    sshd_conf="$(root_ssh 'sshd -T 2>/dev/null' || true)"
    if grep -qx 'passwordauthentication no' <<<"$sshd_conf" && grep -qx 'kbdinteractiveauthentication no' <<<"$sshd_conf"; then
        info "password login is off"
    else
        warn "password login seems to be still on - run bootstrap.sh again and read its warnings"
    fi
}

# -----------------------------------------------------------------------------
# @description /srv/app: compose.yaml and deploy.sh always (the release replaces them later),
# .env once - generated secrets + the values asked for, sent straight over SSH.
# -----------------------------------------------------------------------------
app_files() {
    step "/srv/app"
    # A running release keeps the compose.yaml and deploy.sh of its own image.
    if dep_ssh 'grep -q "^RELEASE=v" /srv/app/.env 2>/dev/null'; then
        info "a release runs - compose.yaml and deploy.sh of the release kept"
    else
        scp -q "$ROOT_DIR/deploy/compose.prod.yaml" "$ALIAS:/srv/app/compose.yaml"
        scp -q "$ROOT_DIR/deploy/vps/deploy.sh" "$ALIAS:/srv/app/deploy.sh"
        dep_ssh 'chmod 750 /srv/app/deploy.sh'
        info "compose.yaml, deploy.sh"
    fi

    if dep_ssh 'grep -qE "^APP_KEY=base64:" /srv/app/.env 2>/dev/null' && [[ $NEW_ENV -eq 0 ]]; then
        info ".env exists - kept (--new-env writes it again)"
    else
        write_env
    fi
    dep_ssh '/srv/app/deploy.sh check' || die "fix the values (ssh $ALIAS, nano /srv/app/.env) and run provision.sh again"
}

write_env() {
    info "values of the installation (secrets are hidden and never printed or stored on this computer)"
    local app_name mail_user reply_to acme mail_password site_key secret_key app_key=""
    ask_value "name of the application (e-mails, titles)" "$DOMAIN" app_name
    ask_value "sender mailbox (FORPSI)" "noreply@$DOMAIN" mail_user
    ask_value "Reply-To address" "info@$DOMAIN" reply_to
    ask_value "address for Let's Encrypt notices" "sysadmin@$DOMAIN" acme
    ask_secret "password of $mail_user" mail_password
    while true; do
        ask_value "Turnstile SITE key (Cloudflare → Turnstile → widget of $DOMAIN)" "" site_key
        [[ "$site_key" =~ ^0x[A-Za-z0-9_-]{16,}$ ]] && break
        warn "expected 0x… (a production key, not a test key)"
    done
    while true; do
        ask_secret "Turnstile SECRET key" secret_key
        [[ "$secret_key" =~ ^0x[A-Za-z0-9_-]{16,}$ ]] && break
        warn "expected 0x…"
    done
    if ask_yes "move an existing installation here (keep its APP_KEY)?" n; then
        while true; do
            ask_secret "APP_KEY of the existing installation (base64:…)" app_key
            [[ "$app_key" =~ ^base64:[A-Za-z0-9+/]{43}=$ ]] && break
            warn "expected base64: + 44 characters"
        done
    else
        app_key="base64:$(openssl rand -base64 32)"
    fi

    export PV_IMAGE_PREFIX PV_RELEASE PV_SITE_DOMAIN PV_ACME_EMAIL PV_DB_ROOT_PASSWORD PV_APP_NAME \
        PV_APP_KEY PV_APP_URL PV_FRONTEND_URL PV_DB_PASSWORD PV_MAIL_USERNAME PV_MAIL_PASSWORD \
        PV_MAIL_FROM_ADDRESS PV_MAIL_REPLY_TO_ADDRESS PV_TURNSTILE_SITE_KEY PV_TURNSTILE_SECRET_KEY
    PV_IMAGE_PREFIX="$IMAGE_PREFIX"
    PV_RELEASE=""
    PV_SITE_DOMAIN="$DOMAIN"
    PV_ACME_EMAIL="$(env_quote "$acme")"
    PV_DB_ROOT_PASSWORD="$(openssl rand -hex 24)"
    PV_APP_NAME="$(env_quote "$app_name")"
    PV_APP_KEY="$app_key"
    PV_APP_URL="https://$DOMAIN"
    PV_FRONTEND_URL="https://$DOMAIN"
    PV_DB_PASSWORD="$(openssl rand -hex 24)"
    PV_MAIL_USERNAME="$(env_quote "$mail_user")"
    PV_MAIL_PASSWORD="$(env_quote "$mail_password")"
    PV_MAIL_FROM_ADDRESS="$(env_quote "$mail_user")"
    PV_MAIL_REPLY_TO_ADDRESS="$(env_quote "$reply_to")"
    PV_TURNSTILE_SITE_KEY="$site_key"
    PV_TURNSTILE_SECRET_KEY="$secret_key"
    render_env "$TEMPLATE" IMAGE_PREFIX RELEASE SITE_DOMAIN ACME_EMAIL DB_ROOT_PASSWORD APP_NAME APP_KEY \
        APP_URL FRONTEND_URL DB_PASSWORD MAIL_USERNAME MAIL_PASSWORD MAIL_FROM_ADDRESS \
        MAIL_REPLY_TO_ADDRESS TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY \
        | dep_ssh 'umask 077 && cat > /srv/app/.env.new && mv /srv/app/.env.new /srv/app/.env && chmod 600 /srv/app/.env'
    unset PV_DB_ROOT_PASSWORD PV_APP_KEY PV_DB_PASSWORD PV_MAIL_PASSWORD PV_TURNSTILE_SECRET_KEY
    info ".env written (mode 600)"
    warn "copy it into Bitwarden now (secure note \"$DOMAIN - .env\"): ssh $ALIAS cat /srv/app/.env"
}

# -----------------------------------------------------------------------------
# @description Deploy key of GitHub: forced command on the server + environment production.
# -----------------------------------------------------------------------------
deploy_key() {
    step "Deploy key of GitHub"
    local has_key=0 has_secret=0
    dep_ssh 'grep -q "deploy.sh ci" ~/.ssh/authorized_keys' 2>/dev/null && has_key=1
    if [[ $GITHUB -eq 1 ]] && gh secret list --env production --repo "$REPO" 2>/dev/null | grep '^DEPLOY_SSH_KEY' >/dev/null; then
        has_secret=1
    fi
    if [[ $has_key -eq 1 && ( $has_secret -eq 1 || $GITHUB -eq 0 ) && $ROTATE_KEY -eq 0 ]]; then
        info "set up already - kept (--rotate-deploy-key replaces it)"
    else
        TMP_DIR="$(mktemp -d)"
        trap 'rm -rf "$TMP_DIR"' EXIT
        ssh-keygen -q -t ed25519 -N "" -C "github-actions-${DOMAIN%%.*}" -f "$TMP_DIR/deploy_key"
        # The old deploy key goes away, the new one may run only deploy.sh ci.
        printf 'restrict,command="/srv/app/deploy.sh ci" %s\n' "$(cat "$TMP_DIR/deploy_key.pub")" \
            | dep_ssh 'sed -i "/deploy.sh ci/d" ~/.ssh/authorized_keys && cat >> ~/.ssh/authorized_keys'
        info "public key on the server (forced command deploy.sh ci)"
        if [[ $GITHUB -eq 1 ]]; then
            github_environment
            gh secret set DEPLOY_SSH_KEY --env production --repo "$REPO" < "$TMP_DIR/deploy_key" >/dev/null
            info "secret DEPLOY_SSH_KEY stored in GitHub"
        else
            cp "$TMP_DIR/deploy_key" "./gh-deploy-${DOMAIN%%.*}"
            chmod 600 "./gh-deploy-${DOMAIN%%.*}"
            warn "put the content of ./gh-deploy-${DOMAIN%%.*} into the secret DEPLOY_SSH_KEY (deploy_workflow.md, step 6), then DELETE the file"
        fi
        rm -rf "$TMP_DIR"
    fi
    if [[ $GITHUB -eq 1 ]]; then
        github_environment
    else
        warn "variables of the environment production: DEPLOY_HOST=$IP, DEPLOY_KNOWN_HOSTS=$HOST_LINE"
    fi
}

github_environment() {
    [[ -n "${GH_ENV_DONE:-}" ]] && return 0
    # Created only when missing - an update would drop protection rules set by hand (reviewers).
    if ! gh api "repos/$REPO/environments/production" >/dev/null 2>&1; then
        gh api --method PUT "repos/$REPO/environments/production" --input - >/dev/null <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
        info "environment production created (optional: Settings → Environments → production → Required reviewers)"
    fi
    local existing
    existing="$(gh api "repos/$REPO/environments/production/deployment-branch-policies" --jq '.branch_policies[] | "\(.type):\(.name)"' 2>/dev/null || true)"
    grep -qx 'tag:v\*' <<<"$existing" || gh api --method POST "repos/$REPO/environments/production/deployment-branch-policies" -f name='v*' -f type=tag >/dev/null
    grep -qx 'branch:main' <<<"$existing" || gh api --method POST "repos/$REPO/environments/production/deployment-branch-policies" -f name=main -f type=branch >/dev/null
    gh variable set DEPLOY_HOST --env production --repo "$REPO" --body "$IP" >/dev/null
    gh variable set DEPLOY_KNOWN_HOSTS --env production --repo "$REPO" --body "$HOST_LINE" >/dev/null
    info "environment production: rules tag v* + branch main, DEPLOY_HOST, DEPLOY_KNOWN_HOSTS"
    GH_ENV_DONE=1
}

# -----------------------------------------------------------------------------
# @description Checks the DNS records; prints what to set at FORPSI when they differ.
# -----------------------------------------------------------------------------
dns_check() {
    step "DNS of $DOMAIN"
    local ipv6 a aaaa caa
    ipv6="$(dep_ssh "ip -6 addr show scope global | awk '/inet6/ { sub(/\\/.*/, \"\", \$2); print \$2; exit }'" 2>/dev/null || true)"
    if ! command -v dig >/dev/null; then
        warn "dig is missing - check the records by hand (setup_hosting.md, step 12)"
        return
    fi
    a="$(dig +short A "$DOMAIN" | tail -n1)"
    aaaa="$(dig +short AAAA "$DOMAIN" | tail -n1)"
    caa="$(dig +short CAA "$DOMAIN" | tr '\n' ' ')"
    if [[ "$a" == "$IP" ]]; then info "A $a"; else warn "A record is '${a:-none}' - set A @ → $IP (FORPSI → Editace DNS záznamů → Upravit)"; fi
    if [[ -n "$ipv6" ]]; then
        if [[ "$aaaa" == "$ipv6" ]]; then info "AAAA $aaaa"; else warn "AAAA record is '${aaaa:-none}' - add AAAA @ → $ipv6"; fi
    fi
    if [[ "$caa" == *letsencrypt.org* ]]; then info "CAA $caa"; else warn "no CAA record - add CAA @: Flags 0, Tag issue, Hodnota letsencrypt.org"; fi
    info "the release works before the DNS is ready; the HTTPS certificate follows once A points here"
}

# -----------------------------------------------------------------------------
# @description First release: offers a tag on the current main and waits until it runs.
# -----------------------------------------------------------------------------
first_release() {
    step "First release"
    local running
    running="$(dep_ssh "sed -n 's/^RELEASE=//p' /srv/app/.env" | tail -n1)"
    if [[ -n "$running" ]]; then
        info "running: $running - kept"
        return
    fi
    if [[ $GITHUB -eq 0 ]]; then
        warn "push a tag v… (deploy_workflow.md, step 7), then run provision.sh again"
        return 1
    fi
    git -C "$ROOT_DIR" fetch -q origin || die "git fetch failed"
    if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" || "$(git -C "$ROOT_DIR" rev-parse HEAD)" != "$(git -C "$ROOT_DIR" rev-parse origin/main)" ]]; then
        warn "the working tree is not the pushed main (uncommitted or unpushed changes) - commit and push, then run provision.sh again"
        return 1
    fi
    local tag n=1
    while git -C "$ROOT_DIR" rev-parse -q --verify "refs/tags/v$(date +%Y.%m).$n" >/dev/null || git -C "$ROOT_DIR" ls-remote --exit-code --tags origin "v$(date +%Y.%m).$n" >/dev/null 2>&1; do
        n=$((n + 1))
    done
    tag="v$(date +%Y.%m).$n"
    ask_yes "release $tag (changelog → commit → tag → push) and deploy it now?" y || { warn "skipped - release later (deploy/release.sh) and run provision.sh again"; return 1; }
    "$ROOT_DIR/deploy/release.sh" "$tag" --note "First release of $DOMAIN" --yes || die "the release $tag was not created (see above)"
    info "tag pushed - GitHub Actions: tests → images → deploy (first run 15-25 min)"
    info "follow it on GitHub (Actions → Release) or: gh run watch --repo $REPO"
    local i state
    for i in $(seq 1 120); do
        sleep 20
        running="$(dep_ssh "sed -n 's/^RELEASE=//p' /srv/app/.env" 2>/dev/null | tail -n1 || true)"
        state="$(dep_ssh "awk -v t=$tag '\$2 == t { s = \$3 } END { print s }' /srv/app/releases.log 2>/dev/null" 2>/dev/null || true)"
        if [[ "$state" == "ok" ]]; then info "$tag is live"; return 0; fi
        if [[ "$state" == "failed" ]]; then die "$tag failed on the server - see the log of the Deploy job and send it"; fi
        (( i % 6 == 0 )) && info "waiting… ($((i / 3)) min)"
    done
    die "no result after 40 minutes - check GitHub Actions"
}

finish() {
    step "First sysadmin and backups"
    if dep_ssh 'crontab -l 2>/dev/null | grep -q web-platform-backup'; then
        info "nightly backups on - kept"
    else
        ssh -t "$ALIAS" '/srv/app/deploy.sh create-sysadmin' </dev/tty
        dep_ssh '/srv/app/deploy.sh install-cron && /srv/app/deploy.sh backup manual'
    fi
    step "Done"
    cat <<TXT
    https://$DOMAIN            (admin: https://$DOMAIN/auth/login)
    ssh $ALIAS '/srv/app/deploy.sh status'
    Next releases: write the changes into api/resources/changelog/changelog.json, then ./dev.sh release vYYYY.MM.N
    Into Bitwarden: .env (ssh $ALIAS cat /srv/app/.env), sysadmin password, fingerprint of the server.
    Backups off the server: deploy_workflow.md, step 9.
TXT
}

main() {
    parse_args "$@"
    preflight
    host_key
    root_key
    ssh_alias
    bootstrap
    app_files
    deploy_key
    dns_check
    first_release || exit 0
    finish
}

# Sourced by the tests: only the functions.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
