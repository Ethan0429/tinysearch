# TinySearch privacy

Updated October 27, 2026.

TinySearch displays public research answers in Destiny.gg chat and, optionally,
as notifications on other websites. The extension
downloads those answers; the separate research service generates them from the
public stream.

## Network requests

The extension requests public answers from
`https://tinysearch.app/v1/answers` and public
release information from `https://tinysearch.app/v1/extension`.
The release service reads the project's public GitHub releases.

Cloudflare receives normal connection information, including the requesting IP
address and request timing, when serving these requests. The extension sends
feed cursors and cache headers to synchronize public answers. Requests omit
cookies and referrers. Update requests do not include an installed version or
installation identifier. TinySearch does not add analytics, advertising, or
user tracking to these requests.

## Information used within your browser

TinySearch finds the chat container so it can insert its own interface. When
available, it reads the current YouTube video identifier from the DGG page's
stream URL or embedded player URL to support the This stream filter. This
limited page context stays in the browser and is not uploaded. The extension
does not request access to your general browsing history.

History search text is processed in memory within the browser. Native chat
messages, chat drafts, account details, search text, and the current video
identifier are not included in the extension's network requests.

**Answers on other tabs** is off by default. Enabling it requests optional
website and scripting access so TinySearch can insert its own notification into
the active tab of the focused browser window. It checks that tab's URL locally
to avoid DGG and protected pages. It does not read the site's text, forms,
passwords or account data, and does not transmit that URL. Only TinySearch's own
notification content and controls are inserted. Browser alarms allow public
answer checks to continue with DGG closed. Turning this setting off dismisses
notifications and removes the optional permissions requested for this feature.

Local extension storage holds display preferences, up to 200 recent public
answers within seven days, synchronization metadata, and cached release notes
and update-check times, plus notification enable time and delivered answer IDs
to avoid duplicate notifications. Search text is not saved. Uninstalling the extension
removes its local storage.

## Clipboard and links

Clicking a copy button writes the selected summary or full answer to the system
clipboard, prefixed with `@Destiny `. You choose where to paste it. The extension
does not read the clipboard or send chat messages.

Opening a source, stream timestamp, dashboard, or release link navigates to that
website. Its own privacy practices apply to your visit.

## Code and permissions

All executable JavaScript, styling, Markdown rendering, and icon assets are
included in the extension package. Remote responses contain public answers and
release metadata, which are treated as data rather than executable code.

The extension uses local-storage and clipboard-write permissions, access to
tinysearch.app, and a content script limited to DGG's chat embed. The alarms
permission schedules optional background answer checks. Scripting and HTTP/HTTPS
website access are optional and requested only when notifications are enabled;
the packaged notification script is injected only when a new answer is shown.

## Limited use and contact

TinySearch uses the information described here only to provide its displayed
answers, local history, stream filtering, settings, clipboard controls, and
release notices. TinySearch does not sell user data, use it for personalized
advertising, or use it to determine creditworthiness or lending eligibility.
Its use of user data follows the Chrome Web Store User Data Policy, including
the Limited Use requirements.

Questions about this policy can be raised through the
[TinySearch project](https://github.com/Ethan0429/tinysearch/issues).
