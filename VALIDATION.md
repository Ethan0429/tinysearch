# Validation

## Version 0.1.11

64 automated tests cover feed synchronization, Chrome/Firefox packaging, optional
website permission grants and denial, alarm polling with DGG closed, persistent
notification deduplication, old-answer suppression, restricted pages, preference
revocation, safe summary rendering, copy controls, queueing and hover-aware
automatic dismissal. Firefox add-on lint reports zero errors, warnings and
notices. The actual notification renderer and popup are available in the local
browser preview. The renderer was visually checked in the browser; these checks
do not substitute for a full installed-extension test in both browsers.


## Version 0.1.5

42 tests pass, including shared safe Markdown rendering (nested emphasis, headings, lists, tables, quotes, code, safe links and inert HTML/images), Lucide SVGs, popup changelog and summary boundary checks. Firefox add-on lint reports zero errors, warnings and notices. Both browser packages include local third-party code and license notices; permissions are unchanged. Browser checks cover the popup, inline summary, copy button and full answer history.
