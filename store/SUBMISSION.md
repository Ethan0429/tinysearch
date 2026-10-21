# TinySearch Chrome Web Store submission

This directory contains listing assets and copy-and-paste form fields. Upload
the extension ZIP from the release, not a ZIP of this directory.

## Store listing

- Name: TinySearch
- Language: English (United States)
- Category: Tools
- Detailed description: `detailed-description.txt`
- Icon: `icon-128.png` (128 x 128 PNG)
- Screenshot: `screenshot-chat-1280x800.jpg`
- Optional second screenshot: `screenshot-history-1280x800.jpg`
- Small promotional tile: `promo-440x280.png`
- Homepage: https://github.com/Ethan0429/tinysearch
- Support: https://github.com/Ethan0429/tinysearch/issues
- Privacy policy: https://github.com/Ethan0429/tinysearch/blob/main/PRIVACY.md

The screenshots show the real extension UI in a DGG-style demonstration page;
the chat conversation is fictional and the player uses a Destiny stream
thumbnail. They are labeled DEMO because DGG was unavailable during capture.

Google requires a small promotional tile in addition to the icon and screenshot:
https://developer.chrome.com/docs/webstore/images

## Privacy practices

Paste the contents of each matching text file into its form field:

- Single purpose: `single-purpose.txt`
- clipboardWrite: `clipboardWrite-justification.txt`
- storage: `storage-justification.txt`
- Host permissions: `host-permissions-justification.txt`
- Remote code: select **No, I am not using remote code**. If the form still offers
  an explanation, use `remote-code-explanation.txt`.

Fetching public JSON is not loading executable code. See:
https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements

The clipboard permission is used by `src/clipboard.js` and the explicit copy
buttons in `src/ui.js`; storage is used by `src/background.js`; the only remote
fetch destinations are the two fixed HTTPS feed hosts. The package contains its
own Markdown renderer and SVG icons. No declared permission is unused.

## Data-use review and certification

The publisher must review and select the data-use declarations and complete
Google's final policy certification in the store editor. Do not describe this
extension as handling no user data: it uses limited page/stream URL context and
history-search input locally, and the hosted services receive ordinary network
connection information. The privacy policy describes this handling and its
limits.

Google says local-only data handling must also be disclosed. When reviewing the
data-type fields, account for the current page/player URL (web browsing activity)
and page/player context (website content), while distinguishing these from
collecting a user's general browsing history or native chat messages. Do not
select unrelated sensitive categories merely because the public answer feed
can discuss those topics. If the editor asks about server logs or identifiers,
include the service provider's normal connection information described in the
privacy policy. Exact declarations must match the editor's definitions.

The extension does not sell user data, use data beyond its stated purpose, or
use it for creditworthiness or lending. The account holder should review the
actual certification wording before checking it and submitting for review.

References:
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq

## Submission checks

The manifest already includes the extension icon. The Store listing icon is a
separate upload. Store language and category are also editor settings; neither
requires changing the manifest.

The connected browser did not expose the publisher's Web Store editor, so these
listing fields and assets have been prepared but have not been entered or
uploaded there. The final certification and submission remain with the publisher.
