#!/bin/bash

# 1. Get the current directory where the script was executed
TARGET_DIR="$PWD"
KEY_NAME="id_ed25519_server" # Filename of the key (can be modified)
KEY_PATH="${TARGET_DIR}/${KEY_NAME}"

echo "Generating SSH key"
echo "Target directory: ${TARGET_DIR}"

# 2. If the files already exist, remove them to force an overwrite
# (ssh-keygen for ed25519 sometimes prompts for overwrite despite flags; deletion ensures it)
if [ -f "$KEY_PATH" ]; then
    echo "Key already exists. Removing the old key to force an overwrite..."
    rm -f "$KEY_PATH" "${KEY_PATH}.pub"
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