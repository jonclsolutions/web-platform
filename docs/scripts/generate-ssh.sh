#!/bin/bash
# =============================================================================
# @file generate-ssh.sh
# @path docs/scripts/generate-ssh.sh
# @project RPSW Web
# @author RPSW
# @description Generates the Ed25519 deploy key pair.
# @usage bash docs/scripts/generate-ssh.sh [target-dir]   (default: ~/.ssh)
# @bugfix-note (2026-10-24) Open finding #51: the key was generated into the CURRENT directory
#   (= docs/scripts in the repo) and the private key got committed. The default target is
#   ~/.ssh now, the script refuses a directory inside a git work tree and no longer deletes an
#   existing key.
# =============================================================================

# 1. Target directory (outside of any repository)
TARGET_DIR="${1:-$HOME/.ssh}"
mkdir -p "$TARGET_DIR" && chmod 700 "$TARGET_DIR"
if git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Refusing to write a private key into a git work tree: ${TARGET_DIR}" >&2
    exit 1
fi
KEY_NAME="id_ed25519_server" # Filename of the key (can be modified)
KEY_PATH="${TARGET_DIR}/${KEY_NAME}"

echo "Generating SSH key"
echo "Target directory: ${TARGET_DIR}"

# 2. Never overwrite an existing key silently (it may be the one the server trusts)
if [ -e "$KEY_PATH" ] || [ -e "${KEY_PATH}.pub" ]; then
    echo "Key ${KEY_PATH} already exists - remove it yourself first if you really want a new one." >&2
    exit 1
fi

# 3. Generate a modern and secure Ed25519 key without a passphrase (-N "")
# -f specifies the exact path and filename
# -q silences unnecessary output
ssh-keygen -t ed25519 -N "" -f "$KEY_PATH" -q -C "deploy-key-$(date +%F)"

echo "SSH key successfully generated!"
echo "Private key: ${KEY_PATH}"
echo "Public key:   ${KEY_PATH}.pub"
echo ""
echo "Public key content (copy to the server's ~/.ssh/authorized_keys file):"
cat "${KEY_PATH}.pub"