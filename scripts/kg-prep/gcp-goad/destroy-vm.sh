#!/usr/bin/env bash
# Nuke the VM AND its boot disk. Use after W2/paper is in.
# Snapshots survive if you took one via snapshot-disk.sh first.
set -euo pipefail
: "${PROJECT_ID:?source .env first}"
: "${ZONE:?source .env first}"
: "${INSTANCE_NAME:?source .env first}"
: "${NETWORK_TAG:?source .env first}"

read -p ">> This deletes $INSTANCE_NAME AND its 250 GB disk. Continue? [y/N] " yn
[ "$yn" = "y" ] || { echo "aborted"; exit 1; }

gcloud compute instances delete "$INSTANCE_NAME" \
    --project="$PROJECT_ID" --zone="$ZONE" --quiet

gcloud compute firewall-rules delete "${NETWORK_TAG}-ssh-${USER}" \
    --project="$PROJECT_ID" --quiet 2>/dev/null || true

echo ">> Destroyed. Final cost: check console.cloud.google.com/billing"
