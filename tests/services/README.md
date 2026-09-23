# Service tests

These mock Prisma. They verify the **decisions** a service makes — which role is
refused, where the ownership predicate goes, what is written inside the
transaction and what is not written at all — and they do it without a database,
which is why they run in milliseconds.

What they deliberately do **not** prove:

- **Constraints exist.** The double-apply test hand-rolls a `P2002` rejection.
  The unique index is real (`@@unique([candidateProfileId, jobId])`, present in
  the init migration), but nothing here would notice if it were dropped.
- **Transactions roll back.** The mocked `$transaction` runs the callback and
  keeps whatever it wrote, so "nothing was written" is asserted by
  `not.toHaveBeenCalled()` rather than by a rollback.
- **Anything concurrent.** Row-level races are unreachable by construction.

They were called `tests/integration/` and were not, which overstated what a green
run meant. Closing those three gaps needs a throwaway Postgres; until then the
name says what they are.
