-- Anti-double-booking hard guarantee.
--
-- btree_gist lets a GiST index mix the equality column (host_id, text) with the
-- range column. The exclusion constraint makes it structurally impossible for a
-- single host to have two non-cancelled bookings whose [start_utc, end_utc)
-- ranges overlap, even under full write concurrency. This is the source of truth;
-- the Redis lock in the API is only an optimization for clean error messages.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "host_id" WITH =,
    tstzrange("start_utc", "end_utc", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELLED');
