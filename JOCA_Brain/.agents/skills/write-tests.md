---
name: write-tests
description: "Writes tests from an issue's acceptance criteria, deliberately without looking at the implementation. Runs in a session separate from the one that implemented the code. MUST be invoked when the user says: write tests, tests for the issue, tests from the criteria, /write-tests, tests in a separate session. SHOULD also invoke when: cover the issue with tests, acceptance tests, Pest from the issue, Vitest from the issue, flutter test from the issue."
triggers: write tests, tests for the issue, tests from the criteria, write-tests, tests in a separate session, cover the issue with tests, acceptance tests, Pest from the issue, Vitest from the issue, flutter test from the issue
argument-hint: "[issue-number]"
chain: tester-code, tester-api
---
# Writing tests — from the requirement, never from the code

Write tests that verify the **requirement**, not the implementation.

## The central rule

**Do not read the implementation code before writing the tests.**

If you do, you write tests that pass against the code that exists — not tests that verify what was
asked for. They always pass and they prove nothing. It is the most dangerous failure mode of this
process, because it gives no signal: CI goes green, coverage rises, and the safety net is an illusion.

Ideally this skill runs in a session that implemented nothing. If you are in the same session that
implemented, **say so to the user** and suggest opening a new session — do not pretend the isolation exists.

## Steps

1. **Read the issue.** If `$ARGUMENTS` carries a number, use it; otherwise ask which one it is.

```bash
gh issue view <number>
```

Extract the acceptance criteria. If the issue has no verifiable criteria, **stop** — there is
nothing to write from. Send it back to `new-issue`.

2. **Read the project context** — `CLAUDE.md`/`AGENTS.md` and `docs/ARCHITECTURE.md`. On Laravel, if
Boost is available, use its tools to read the schema and the models: you need the **data
structure**, not the logic of the classes.

3. **Read only the public signatures** — routes, controller method names, component props, model
names. Enough to write valid calls, **not** the internal logic.

4. **Write the tests.** For each acceptance criterion:
   - the nominal case
   - at least one edge case (empty, null, zero, maximum, no permission)
   - the error case, where applicable

Always prefer the test that exercises the **behavior from the outside** (HTTP, screen, rendered screen) over
the unit test of internal classes — they verify what the criterion describes, and they survive refactors.

### By stack

| Stack | Runner | Preferred level | Command |
|---|---|---|---|
| Laravel · Livewire | Pest 5 | Feature (HTTP, real routes) · `Livewire::test()` | `./vendor/bin/pest --filter=<name>` |
| Next.js | Vitest + Testing Library | Route handler + component render | `npm test -- --run -t <name>` |
| Flutter | `flutter_test` | Widget test (`testWidgets`) | `flutter test --plain-name <name>` |

**Laravel:**

```php
it('does not let a user see projects belonging to someone else', function () {
    $other = User::factory()->has(Project::factory())->create();

    $this->actingAs(User::factory()->create())
        ->get("/projects/{$other->projects->first()->id}")
        ->assertForbidden();
});
```

**Next.js:**

```ts
it('does not let a user see projects belonging to someone else', async () => {
  const res = await GET(authenticatedRequestAs(otherUser), { params: { id: someoneElsesProject.id } })
  expect(res.status).toBe(403)
})
```

**Flutter:**

```dart
testWidgets('shows the empty state when there are no projects', (tester) async {
  await tester.pumpWidget(withProjects([]));
  expect(find.text('You have no projects yet'), findsOneWidget);
  expect(find.byType(CreateProjectButton), findsOneWidget);
});
```

5. **Run them** and interpret the failures:

- Fails because the feature does not exist → expected, if you are writing first
- Fails because the implementation does not meet the criterion → **you found a real bug**
- **Everything passes first time → be suspicious.** Change an assertion deliberately and confirm it goes red.
  A test that never fails is testing nothing.

6. **Report** which criteria ended up covered, which could not be covered and why.

## Do not

- Do not adjust the test to make it pass. If the test is right and it fails, the problem is in the code.
- Do not test internal details (private methods, class structure, internal widget state)
  — it makes the tests fragile to any refactor.
- Do not chase a coverage percentage. Chase coverage of the **criteria**.
- **Do not count coverage from the total.** To verify that N criteria are covered, check **all N**
  one by one; an average or a count hides what failed.

## Next step (chain)

- Suite written and passing → `tester-code` to review the diff against the criteria.
- New endpoints appeared → `tester-api`.
- A failing criterion revealed a bug in the implementation → **do not fix it here**: open a bug issue
  (`new-issue`) or hand it back to whoever implemented it. This skill writes tests, it does not fix code.
