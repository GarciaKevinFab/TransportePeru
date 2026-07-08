"""
CI post-seed fixup for TransportePeru integration tests.

Why this exists
---------------
The protected ``POST /api/seed`` endpoint creates the demo dataset (company,
drivers, vehicles, routes, tires, one trip, document types...) but assigns the
admin user a RANDOM password (``secrets.token_urlsafe``) with
``force_password_change=True``. The integration tests under ``backend/tests/``
all authenticate as ``admin@transperu.com`` / ``admin123``, so after seeding we
override the admin credential to that fixed, deterministic value.

It also guarantees at least two trips exist:
``test_settlements_checklist.py::TestChecklist`` asserts ``len(trips) > 1`` and
uses ``trips[1]``, but the seed only creates a single trip. We clone the seeded
trip so that test class can run instead of erroring on its fixture.

Usage
-----
Run AFTER ``POST /api/seed`` and BEFORE ``pytest``. Reads ``MONGO_URL`` and
``DB_NAME`` from the environment, exactly like the FastAPI server does.

    python backend/tests/ci_postseed.py
"""
import os
import sys
import uuid

import bcrypt
from pymongo import MongoClient

ADMIN_EMAIL = "admin@transperu.com"
# Overridable so the same script can force any test credential if needed.
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "admin123")


def main() -> int:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = MongoClient(mongo_url)
    db = client[db_name]

    # 1) Force a deterministic admin password (seed uses a random one).
    pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    res = db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$set": {"password_hash": pw_hash, "force_password_change": False}},
    )
    if res.matched_count != 1:
        print(
            f"ERROR: admin user {ADMIN_EMAIL} not found. Did POST /api/seed run "
            f"successfully with a valid X-Install-Token?",
            file=sys.stderr,
        )
        return 1
    print(f"OK: admin password for {ADMIN_EMAIL} set to fixed test credential")

    # 2) Ensure at least 2 trips (TestChecklist needs trips[1]).
    trip_count = db.trips.count_documents({})
    if trip_count < 2:
        base = db.trips.find_one({}, {"_id": 0})
        if not base:
            print("ERROR: no trips found after seed; cannot clone", file=sys.stderr)
            return 1
        clone = dict(base)
        clone["id"] = str(uuid.uuid4())
        db.trips.insert_one(clone)
        print("OK: cloned seed trip -> 2 trips (for TestChecklist)")
    else:
        print(f"OK: {trip_count} trips already present")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
