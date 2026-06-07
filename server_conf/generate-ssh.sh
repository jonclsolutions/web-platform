#!/bin/bash

# 1. Získání aktuální složky, kde byl skript spuštěn
TARGET_DIR="$PWD"
KEY_NAME="id_ed25519_server" # Název souboru klíče (můžeš si změnit)
KEY_PATH="${TARGET_DIR}/${KEY_NAME}"

echo "🚀 Generuji SSH klíč na Fedoře 42..."
echo "📍 Cílová složka: ${TARGET_DIR}"

# 2. Pokud soubory již existují, smažeme je, abychom vynutili přepis
# (ssh-keygen se u ed25519 i přes flagy občas ptá na přepis, smazání je 100% jistota)
if [ -f "$KEY_PATH" ]; then
    echo "⚠️  Klíč již existuje. Odstraňuji starý klíč pro vynucení přepisu..."
    rm -f "$KEY_PATH" "${KEY_PATH}.pub"
fi

# 3. Generování moderního a bezpečného Ed25519 klíče bez hesla (-N "")
# -f specifikuje přesnou cestu a název
# -q ztiší zbytečný výstup
ssh-keygen -t ed25519 -N "" -f "$KEY_PATH" -q -C "deploy-key-$(date +%F)"

echo "✅ SSH klíč byl úspěšně vygenerován!"
echo "🔑 Privátní klíč: ${KEY_PATH}"
echo "📜 Veřejný klíč:   ${KEY_PATH}.pub"
echo ""
echo "💡 Obsah veřejného klíče (zkopíruj na server do ~/.ssh/authorized_keys):"
cat "${KEY_PATH}.pub"