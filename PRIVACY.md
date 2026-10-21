# TinySearch privacy

Updated October 21, 2026.

TinySearch displays public research answers in Destiny.gg chat. The extension
downloads those answers; the separate research service generates them from the
public stream.

## Network requests

The extension requests public answers from
`https://discord-relay-production-861c.up.railway.app/v1/answers` and public
release information from `https://tinysearch.up.railway.app/v1/extension`.
The release service reads the project's public GitHub releases.

Railway receives normal connection information, including the requesting IP
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

Local extension storage holds display preferences, up to 200 recent public
answers within seven days, synchronization metadata, and cached release notes
and update-check times. Search text is not saved. Uninstalling the extension
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

The extension uses local-storage and clipboard-write permissions, access to the
two public feed hosts, and a content script limited to DGG's chat embed.

## Limited use and contact

TinySearch uses the information described here only to provide its displayed
answers, local history, stream filtering, settings, clipboard controls, and
release notices. TinySearch does not sell user data, use it for personalized
advertising, or use it to determine creditworthiness or lending eligibility.
Its use of user data follows the Chrome Web Store User Data Policy, including
the Limited Use requirements.

Questions about this policy can be raised through the
[TinySearch project](https://github.com/Ethan0429/tinysearch/issues).
