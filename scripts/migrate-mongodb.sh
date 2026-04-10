#!/bin/bash
# MongoDB Migration: Atlas -> Local Windows Server
#
# Prerequisites:
#   - mongodump and mongorestore installed (MongoDB Database Tools)
#   - Network access to Atlas cluster
#   - Local MongoDB running
#
# Usage:
#   bash scripts/migrate-mongodb.sh <ATLAS_URI> <LOCAL_URI>
#   Example: bash scripts/migrate-mongodb.sh "mongodb+srv://user:pass@cluster.mongodb.net" "mongodb://localhost:27017"

set -e

ATLAS_URI="${1:?Usage: $0 <ATLAS_URI> <LOCAL_URI>}"
LOCAL_URI="${2:-mongodb://localhost:27017}"
DB_NAME="transporteperu"
DUMP_DIR="./mongo_dump_$(date +%Y%m%d_%H%M%S)"

echo "============================================"
echo "  MongoDB Migration: Atlas -> Local"
echo "============================================"
echo "Source: Atlas"
echo "Target: $LOCAL_URI"
echo "Database: $DB_NAME"
echo "Dump dir: $DUMP_DIR"
echo ""

# Step 1: Dump from Atlas
echo "=== Step 1: Dumping from Atlas ==="
mongodump --uri="$ATLAS_URI" --db="$DB_NAME" --out="$DUMP_DIR"
echo "Done."

# Step 2: Restore to Local
echo ""
echo "=== Step 2: Restoring to Local MongoDB ==="
mongorestore --uri="$LOCAL_URI" --db="$DB_NAME" "$DUMP_DIR/$DB_NAME" --drop
echo "Done."

# Step 3: Verify
echo ""
echo "=== Step 3: Verifying collection counts ==="

COLLECTIONS=(
  users companies vehicles trips trip_advances trip_expenses
  couplings document_types documents alerts blocks routes
  checklists checklist_templates checklist_runs
  fuel_vouchers fuel_loads tires tire_mounts tire_inspections
  tire_life_events tire_rotations alignment_records
  maintenance_plans work_orders downtime_records issues
  settlements inventory_items stock_moves suppliers
  purchase_orders audit_logs notifications vehicle_equipment
  guias_transportista facturas
)

echo ""
printf "%-30s %10s %10s %s\n" "COLLECTION" "ATLAS" "LOCAL" "STATUS"
printf "%-30s %10s %10s %s\n" "----------" "-----" "-----" "------"

ERRORS=0
for col in "${COLLECTIONS[@]}"; do
  atlas_count=$(mongosh "$ATLAS_URI/$DB_NAME" --quiet --eval "db.$col.countDocuments({})" 2>/dev/null || echo "?")
  local_count=$(mongosh "$LOCAL_URI/$DB_NAME" --quiet --eval "db.$col.countDocuments({})" 2>/dev/null || echo "?")

  if [ "$atlas_count" = "$local_count" ]; then
    status="OK"
  else
    status="MISMATCH!"
    ERRORS=$((ERRORS + 1))
  fi
  printf "%-30s %10s %10s %s\n" "$col" "$atlas_count" "$local_count" "$status"
done

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "=== Migration Complete - All collections match ==="
else
  echo "=== WARNING: $ERRORS collections have mismatches ==="
fi

echo ""
echo "Dump saved at: $DUMP_DIR (you can delete after verifying)"
