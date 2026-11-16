#!/usr/bin/env bash
# =============================================================================
# @file bootstrap.sh
# @path deploy/vps/bootstrap.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description ONE-TIME preparation of a fresh VPS (FORPSI VPS Linux, Ubuntu Server 24.04 LTS)
#   for the Docker deployment - run as root right after the server is handed over:
#     1. system updates, base tools, time zone, swap
#     2. Docker Engine + Compose plugin from the official Docker repository, log rotation
#     3. user `deploy` (no sudo, group docker) with the SSH keys of root - the account of the
#        deployments (GitHub Actions) and of the daily administration
#     4. /srv/app (compose.yaml, .env, backups) owned by `deploy`
#     5. SSH hardening: keys only, root without password - ONLY when a key login is set up,
#        otherwise skipped with a warning (no lockout)
#     6. firewall ufw (22, 80, 443), fail2ban (SSH), automatic security updates
#   Safe to run again: every step checks its state first.
# @usage On your computer (the public key must already be on the server - deploy/setup_hosting.md):
#     scp deploy/vps/bootstrap.sh root@<IP>:/root/
#     ssh root@<IP> 'bash /root/bootstrap.sh'
#   Options (environment): DEPLOY_USER=deploy  SWAP_SIZE=2G  TIMEZONE=Europe/Prague
#     AUTO_REBOOT=yes (reboot at 04:30 when a security update needs it; no = never)
# @security The `docker` group is root-equivalent on this host: only the deploy account is in it
#   and it logs in with keys only. Docker publishes ports past ufw - the stack publishes only 80
#   and 443 (deploy/compose.prod.yaml), the database never. No password or key is printed.
# =============================================================================
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
TIMEZONE="${TIMEZONE:-Europe/Prague}"
AUTO_REBOOT="${AUTO_REBOOT:-yes}"
APP_DIR=/srv/app
export DEBIAN_FRONTEND=noninteractive

WARNINGS=()
step() { printf '\n\e[34m==> %s\e[0m\n' "$*"; }
info() { printf '    - %s\n' "$*"; }
warn() { printf '\e[33m    ! %s\e[0m\n' "$*" >&2; WARNINGS+=("$*"); }
die()  { printf '\e[31mERROR: %s\e[0m\n' "$*" >&2; exit 1; }
trap 'die "failed at line $LINENO (command: $BASH_COMMAND)"' ERR

# -----------------------------------------------------------------------------
# @description Runs as root on Ubuntu (24.04 expected - another release only warns).
# -----------------------------------------------------------------------------
preflight() {
    step "Checks"
    [[ $EUID -eq 0 ]] || die "run as root (ssh root@<IP> 'bash /root/bootstrap.sh')"
    # shellcheck disable=SC1091
    . /etc/os-release
    [[ "${ID:-}" == "ubuntu" ]] || die "Ubuntu expected, found ${PRETTY_NAME:-unknown}"
    [[ "${VERSION_ID:-}" == "24.04" ]] || warn "tested on Ubuntu 24.04, this is ${PRETTY_NAME}"
    [[ "$DEPLOY_USER" =~ ^[a-z][a-z0-9_-]{0,30}$ ]] || die "DEPLOY_USER '$DEPLOY_USER' is not a valid user name"
    [[ "$AUTO_REBOOT" == "yes" || "$AUTO_REBOOT" == "no" ]] || die "AUTO_REBOOT must be yes or no"
    info "$PRETTY_NAME, deploy user '$DEPLOY_USER'"
}

# -----------------------------------------------------------------------------
# @description Updates the system, installs the base tools, sets the time zone.
# -----------------------------------------------------------------------------
system_base() {
    step "System updates and base tools"
    apt-get update -q
    apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
    apt-get -y -q install ca-certificates curl gnupg ufw fail2ban python3-systemd \
        unattended-upgrades apt-listchanges
    timedatectl set-timezone "$TIMEZONE"
    info "time zone $TIMEZONE"
}

# -----------------------------------------------------------------------------
# @description Swap file (the 4 GB of RAM have no reserve for a peak - a build of composer, a
# large import). Skipped when the server already has swap.
# -----------------------------------------------------------------------------
swap() {
    step "Swap"
    if [[ -n "$(swapon --show --noheadings)" ]]; then
        info "swap already active - kept"
        return
    fi
    fallocate -l "$SWAP_SIZE" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-swappiness.conf
    sysctl -q -p /etc/sysctl.d/90-swappiness.conf
    info "swap $SWAP_SIZE in /swapfile (swappiness 10)"
}

# -----------------------------------------------------------------------------
# @description Docker Engine + Compose plugin from the official repository of Docker (the
# Ubuntu package is older and has no compose plugin); log rotation of the containers.
# -----------------------------------------------------------------------------
docker_engine() {
    step "Docker"
    if ! command -v docker >/dev/null 2>&1; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        # shellcheck disable=SC1091
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -q
        apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        info "Docker already installed - kept"
    fi

    # Logs of the containers: at most 3 × 10 MB each (the disk has 40 GB).
    if [[ ! -f /etc/docker/daemon.json ]]; then
        mkdir -p /etc/docker
        cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
JSON
        systemctl restart docker
        info "log rotation 3 × 10 MB per container"
    else
        info "/etc/docker/daemon.json exists - kept"
    fi
    systemctl enable --now docker >/dev/null 2>&1
    info "$(docker --version), $(docker compose version)"
}

# -----------------------------------------------------------------------------
# @description The deploy account: no password, no sudo, group docker; the SSH keys of root
# (your personal key) are copied, the deploy key of GitHub is added later (deploy_workflow.md).
# -----------------------------------------------------------------------------
deploy_user() {
    step "User $DEPLOY_USER"
    if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
        adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
        info "user created (no password - SSH keys only)"
    else
        info "user exists - kept"
    fi
    usermod -aG docker "$DEPLOY_USER"

    local home ssh_dir
    home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
    ssh_dir="$home/.ssh"
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
    touch "$ssh_dir/authorized_keys"
    if [[ -s /root/.ssh/authorized_keys ]]; then
        # Add the keys of root that are not there yet (never removes a key).
        local key
        while IFS= read -r key; do
            [[ -z "$key" || "$key" == \#* ]] && continue
            grep -qxF "$key" "$ssh_dir/authorized_keys" || echo "$key" >> "$ssh_dir/authorized_keys"
        done < /root/.ssh/authorized_keys
        info "SSH keys of root copied to $DEPLOY_USER"
    fi
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ssh_dir/authorized_keys"
    chmod 600 "$ssh_dir/authorized_keys"
}

# -----------------------------------------------------------------------------
# @description /srv/app = the installation (compose.yaml, .env, deploy script, backups).
# -----------------------------------------------------------------------------
app_dir() {
    step "$APP_DIR"
    install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/backups"
    info "$APP_DIR (750) and $APP_DIR/backups (700) owned by $DEPLOY_USER"
}

# -----------------------------------------------------------------------------
# @description SSH: keys only, root only with a key. Applied only when root AND the deploy
# user have a key - a server reachable only by password is never locked.
# -----------------------------------------------------------------------------
ssh_hardening() {
    step "SSH hardening"
    local home
    home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
    if [[ ! -s /root/.ssh/authorized_keys || ! -s "$home/.ssh/authorized_keys" ]]; then
        warn "no SSH key in /root/.ssh/authorized_keys - password login LEFT ON. Copy your key (ssh-copy-id, deploy/setup_hosting.md) and run this script again."
        return
    fi
    # 10-… is read before 50-cloud-init.conf; the first value of a setting wins in sshd.
    cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'CONF'
# Written by deploy/vps/bootstrap.sh - SSH with keys only.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
CONF
    sshd -t || { rm -f /etc/ssh/sshd_config.d/10-hardening.conf; die "sshd rejected the configuration - removed, nothing changed"; }
    systemctl restart ssh
    info "password login off, root only with a key (your current session stays open)"
}

# -----------------------------------------------------------------------------
# @description Firewall: SSH, HTTP, HTTPS (+ HTTP/3) in; everything else in is closed.
# -----------------------------------------------------------------------------
firewall() {
    step "Firewall (ufw)"
    ufw default deny incoming >/dev/null
    ufw default allow outgoing >/dev/null
    ufw allow 22/tcp comment 'SSH' >/dev/null
    # ufw refuses an apostrophe in a comment.
    ufw allow 80/tcp comment 'HTTP - Lets Encrypt, redirect' >/dev/null
    ufw allow 443/tcp comment 'HTTPS' >/dev/null
    ufw allow 443/udp comment 'HTTP/3' >/dev/null
    ufw --force enable >/dev/null
    info "open: 22/tcp, 80/tcp, 443/tcp, 443/udp"
}

# -----------------------------------------------------------------------------
# @description fail2ban: 5 failed SSH logins in 10 minutes = 1 hour ban.
# -----------------------------------------------------------------------------
fail2ban_ssh() {
    step "fail2ban"
    cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
# Written by deploy/vps/bootstrap.sh
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
CONF
    systemctl enable fail2ban >/dev/null 2>&1
    systemctl restart fail2ban
    info "SSH jail on (5 failures / 10 min → 1 h ban)"
}

# -----------------------------------------------------------------------------
# @description Automatic security updates of the system (Docker images are updated by the
# releases); optional reboot at 04:30 when an update needs it - the containers start again
# by themselves (restart: unless-stopped).
# -----------------------------------------------------------------------------
auto_updates() {
    step "Automatic security updates"
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
    if [[ "$AUTO_REBOOT" == "yes" ]]; then
        cat > /etc/apt/apt.conf.d/52unattended-reboot <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
CONF
        info "on, reboot at 04:30 when needed"
    else
        rm -f /etc/apt/apt.conf.d/52unattended-reboot
        info "on, never reboots by itself (check /var/run/reboot-required)"
    fi
}

summary() {
    step "Done"
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        printf '\e[33mWarnings:\e[0m\n'
        printf '  - %s\n' "${WARNINGS[@]}"
    fi
    cat <<TXT

Next (deploy/setup_hosting.md):
  1. In a NEW terminal check the login:  ssh ${DEPLOY_USER}@<IP>   (keep this one open until it works)
  2. As ${DEPLOY_USER}: put compose.yaml and .env into ${APP_DIR} (chmod 600 .env)
  3. Deployment from GitHub: deploy/deploy_workflow.md
TXT
}

preflight
system_base
swap
docker_engine
deploy_user
app_dir
ssh_hardening
firewall
fail2ban_ssh
auto_updates
summary
