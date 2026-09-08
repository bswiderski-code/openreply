# Zernio integration verification

Verified on 2026-09-08 using an isolated OpenReply installation with PostgreSQL 16, Redis, the real background worker, a public HTTPS callback, and a temporary key for a team-owned Zernio account. No direct Meta app credentials were configured for this installation.

## Completed checks

- Browser: saved the key, selected an existing profile, registered the actual Zernio webhook, and imported a team-owned Instagram account. Settings never returned the saved key.
- Live API: profile, recent posts, inbox conversations, overview analytics, and health returned successful responses through OpenReply.
- Event delivery: a signed nonmatching test comment passed through the HTTP route, PostgreSQL, Redis, and the worker. Replaying it retained one queue job. Invalid signatures returned 401; events for other accounts were discarded without persistence. The synthetic comment intentionally triggered no outbound message.
- Access control: unauthenticated settings access returned 401, cross-origin mutation and an account outside the selected profile returned 403, and removing credentials with an imported account returned 400.
- Concurrency: two overlapping transactions against real PostgreSQL confirmed that a profile change waits for account import and observes the committed account before deciding whether it is allowed.
- Website: checked 320, 390, 768, and 1440 pixel widths, keyboard access, FAQ controls, and sponsor link parameters. On the live Zernio website, OpenReply attribution cookies survived navigation from the tracked landing URL to signup. No new signup or purchase was created.
- Automated checks: 231 tests passed, including provider contracts, management boundaries, signed event normalization, uncertain delivery, and postback replay after queue eviction. ESLint, TypeScript, and the production build passed.

## Live check still requiring a human

A real Instagram comment followed by receipt of the private DM has **not yet been verified**. Imported-account onboarding was exercised; a fresh Instagram OAuth authorization was not completed. Mocked provider contract tests are not evidence of live outbound delivery.

To complete the comment-to-DM check:

1. Follow [Zernio setup](zernio.md), with both web and worker processes running.
2. Create an active campaign for a team-owned post with a unique exact keyword and a harmless test message. Avoid another automation matching the same keyword.
3. From a different Instagram account, comment the keyword on that post.
4. Confirm the normalized webhook, the corresponding worker job and sent DM Log, and actual receipt of the DM in Instagram. If the campaign includes a button, tap it and confirm its follow-up; replay the same event and verify no second message is sent.
5. Disable the test campaign, disconnect the imported test account, remove this installation's webhook through Settings, and revoke the temporary key. Preserve unrelated Zernio subscriptions and accounts.
