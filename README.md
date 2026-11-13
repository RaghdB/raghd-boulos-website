# Raghd Boulos portfolio

Website: https://raghdb.github.io/raghd-boulos-website/

**Visual website builder:** https://raghdb.github.io/raghd-boulos-website/admin/

## Edit visually

1. Open the builder and connect the GitHub account that owns this repository. Logged-out visitors see only the sign-in screen.
2. Choose one of your five pages. Double-click text to edit it directly on the canvas.
3. Drag **Section**, **2 columns**, **3 columns**, **Heading**, **Paragraph**, **Image**, **Button**, **Divider** or **Spacer** onto the page.
4. Select an element to change its typography, colors, spacing and layout in **Style**. Use **Layers** to select and reorder nested elements. Duplicate or delete selected blocks; undo and redo changes.
5. Select an image and choose **Replace image** to upload PNG, JPEG, GIF or WebP files. Use **Settings** for element attributes such as link destinations and image descriptions.
6. Use Desktop, Tablet and Mobile canvas views, then **Preview**. **Save draft** keeps your project and image uploads in this browser; **Publish website** commits the exported pages to GitHub. Allow GitHub Pages a few minutes to deploy.

Bookmark the builder. It runs in a modern desktop browser without installation. The full design workspace benefits from a desktop-sized screen. The portfolio keeps its existing fonts, styles and layout until you deliberately edit and publish it.

## Connect securely

The sign-in screen links to GitHub’s own fine-grained access-key page. Choose **Only select repositories → raghd-boulos-website**, with **Contents: Read and write** and **Metadata: Read**. Leave administration and unrelated permissions disabled. Create the key and paste it only into the builder’s password field. Never put a key in chat, source files or screenshots.

The key remains in this tab’s memory only. Disconnecting, refreshing or closing the tab forgets it. Neither the website nor browser drafts contain credentials. GitHub independently enforces publishing permissions. The builder verifies the owner account before loading pages or reading drafts; knowing the admin URL does not grant editing or publishing access. The key can be revoked in GitHub settings and expires according to the expiry you choose.

The repository, website, and builder source are public because they use public GitHub Pages. The locked screen is not a server-side privacy boundary for source code or already-public page content.

## Security

GrapesJS 0.23.9 is bundled locally with its BSD-3-Clause license and verified npm package integrity. No builder CDN, cloud editing service, telemetry, subscription, local server, Python runtime or GitHub CLI is needed to use the editor. The only authenticated online destination is `api.github.com` over HTTPS.

The visual canvas is sandboxed without script execution. Imported page scripts, event handlers, executable component attributes, unsafe URLs and active markup are removed. Custom code and arbitrary embeds are disabled; the original video embed is preserved through an exact allowlist. Exported HTML uses a fixed page shell and the original local Webflow/jQuery scripts, with integrity hashes. CSS is checked before export, including imports, network URLs and style-tag breakouts. Uploads are limited to raster image types with size and signature checks; format checks are not a full image sanitizer.

Browser drafts use IndexedDB and include content and pending images, not access keys. Browser storage is not secret storage: the usual same-origin browser rules apply. Clearing browser data removes local drafts.

Publishing is restricted to the five configured HTML pages, `docs/admin/builder-project.json`, and generated image upload paths. It checks the current GitHub revisions, preserves unrelated changes using the latest tree, and never force-pushes. A conflict stops publication. GitHub commit history can restore an earlier published version.

## Source and publishing

The initial pages use Jekyll templates and `docs/_data`. The first visual publication exports the five pages as plain static HTML; later visual edits use `docs/admin/builder-project.json` while checking for manual source changes. Existing local CSS, Eina fonts, scripts and approved video remain available.

Builder source is `tools/builder-ui.html` and `tools/builder-api.js`. `docs/admin/vendor/` contains the pinned library. `python3 tools/build-builder.py` packages developer changes into `docs/admin/index.html`; it is optional development tooling, not a runtime dependency. `node tests/builder-security.mjs` runs security and publication regression tests. The older form-editor source is retained for history and is not loaded by the visual builder.
