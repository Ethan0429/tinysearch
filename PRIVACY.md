# TinySearch privacy

TinySearch downloads public research answers from
`discord-relay-production-861c.up.railway.app`. Railway receives normal connection
information, including IP address and request timing. Requests omit cookies and
referrers. Research searches and stream filtering run locally.

The extension also checks public release metadata at
`tinysearch-dashboard-production.up.railway.app/v1/extension`. The service reads
the project’s GitHub releases. Update requests omit cookies and referrers and do
not send your installed version or an installation identifier. Release notes and
the last update check are cached locally.

Local extension storage holds display preferences, up to 200 recent public
answers within seven days, and synchronization metadata. Uninstalling the
extension removes that storage.

The clipboard button writes the selected answer, prefixed with `@Destiny `, when
clicked. You choose where to paste it. Clipboard permission is write-only.

The extension uses storage and clipboard-write permissions, access to the public
relay and release-metadata hosts, and a content script on DGG’s chat embed. Its network requests contain
feed cursors and cache headers. Chat messages, composer input, account details,
search text and current video IDs stay outside those requests.
