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

Why Postgres and not Mongo
--------------------------
Both tables this script touches already crossed over in the incremental
Mongo -> Postgres migration: ``users`` in cut 004 and ``trips`` in cut 007 (see
``db/tablas_en_postgres.txt``, the authoritative list). Writing them to Mongo
would update rows the backend no longer reads, so the fixed password would
never take effect and the login in every test fixture would fail.

It connects as the ``postgres`` superuser on purpose. The tables have
``force row level security`` and the backend's own role (``app_backend``) can
only see one company at a time; a superuser bypasses RLS, which is what this
script needs since it runs outside any request and has no tenant context.

Usage
-----
Run AFTER ``POST /api/seed`` and BEFORE ``pytest``. Reads the admin connection
string from ``POSTGRES_ADMIN_URL`` (falling back to ``DATABASE_URL``).

    python backend/tests/ci_postseed.py
"""
import asyncio
import os
import sys

import asyncpg
import bcrypt

ADMIN_EMAIL = "admin@transperu.com"
# Overridable so the same script can force any test credential if needed.
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "admin123")


async def run() -> int:
    dsn = os.environ.get("POSTGRES_ADMIN_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        print(
            "ERROR: neither POSTGRES_ADMIN_URL nor DATABASE_URL is set. This "
            "script writes to Postgres because users and trips already migrated.",
            file=sys.stderr,
        )
        return 1

    conn = await asyncpg.connect(dsn)
    try:
        # 1) Force a deterministic admin password (seed uses a random one).
        pw_hash = bcrypt.hashpw(
            ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        updated = await conn.fetchval(
            "update users set password_hash = $1, force_password_change = false "
            "where email = $2 returning id",
            pw_hash,
            ADMIN_EMAIL,
        )
        if updated is None:
            print(
                f"ERROR: admin user {ADMIN_EMAIL} not found. Did POST /api/seed run "
                f"successfully with a valid X-Install-Token?",
                file=sys.stderr,
            )
            return 1
        print(f"OK: admin password for {ADMIN_EMAIL} set to fixed test credential")

        # 2) Ensure at least 2 trips (TestChecklist needs trips[1]).
        trip_count = await conn.fetchval("select count(*) from trips")
        if trip_count >= 2:
            print(f"OK: {trip_count} trips already present")
            return 0
        if trip_count == 0:
            print("ERROR: no trips found after seed; cannot clone", file=sys.stderr)
            return 1

        # The clone goes through a temp table copied with SELECT *, so adding a
        # column to trips later does not silently leave it out of the copy —
        # which is exactly what listing the columns here would do.
        async with conn.transaction():
            await conn.execute(
                "create temp table trip_clone on commit drop as "
                "select * from trips limit 1"
            )
            await conn.execute(
                "update trip_clone set id = gen_random_uuid(), "
                "trip_number = coalesce(trip_number, '') || '-CI2'"
            )
            await conn.execute("insert into trips select * from trip_clone")
        print("OK: cloned seed trip -> 2 trips (for TestChecklist)")
        return 0
    finally:
        await conn.close()


def main() -> int:
    return asyncio.run(run())


if __name__ == "__main__":
    raise SystemExit(main())
