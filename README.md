# Raghd Boulos portfolio

Website: https://raghdb.github.io/raghd-boulos-website/

**Edit your website:** https://raghdb.github.io/raghd-boulos-website/admin/

## Everyday editing

1. Open the editor and choose a page or **Contact & navigation**.
2. Change text, images, captions or links.
3. **Save draft** keeps your work in this browser, including new images.
4. **Connect GitHub**, then **Publish to website** when ready. Allow GitHub Pages a few minutes to rebuild.

Bookmark the editor. It works in modern desktop and mobile browsers. Nothing needs to be installed. The public portfolio retains its original layout and desktop-oriented design.

## Connect securely

Use the editor’s **Connect GitHub** button. Its setup link opens GitHub’s own fine-grained access-key page with the required permission preset. Choose **Only select repositories → raghd-boulos-website**, with **Contents: Read and write** and **Metadata: Read**. Keep administration and other unnecessary permissions disabled. Create the key and paste it only into the editor’s password field. Do not paste it in chat, repository files or screenshots.

The key stays in this tab’s memory. It is cleared by **Disconnect**, closing the tab, or refreshing the page. It is never included in the website, drafts, request URLs or browser storage. GitHub enforces actual write access; knowing the admin URL does not grant publishing permission. The key expires according to the expiration chosen on GitHub and can be revoked there at any time.

## Security and portability

There is no extra editing service, local server, Mac app, Python runtime, GitHub CLI or external JavaScript dependency. The editor uses standard browser APIs and sends authenticated publishing requests only to `api.github.com` over HTTPS. Its page has a strict hash-based Content Security Policy; user content is rendered as text. Framed use is blocked before the editor starts. Uploaded images accept PNG, JPEG, GIF and WebP with size and signature checks; SVG uploads are not accepted.

Drafts contain website content and images only, stored locally using IndexedDB. They are not secret storage: scripts elsewhere on the same website origin have the browser’s usual same-origin access. Clearing browser data removes drafts. Published content and revision history are public.

Publishing updates only the six fixed content JSON files and referenced image uploads in this repository. It preserves unrelated remote changes and stops on content conflicts; it never force-pushes. A successful commit starts the usual GitHub Pages build. Repository history can restore a published edit.

## Source

GitHub Pages builds `docs/` from `main` using Jekyll. Editable content is `docs/_data/*.json`; page layouts are `docs/**/index.html`. Keep Liquid expressions and front matter intact when editing layouts. The editor changes existing fields and project images; adding or removing layout sections requires a code change.

Editor source is `tools/editor-ui.html`, `tools/github-editor-api.js`, and `tools/editor-schema.json`. `python3 tools/build-admin.py` is an optional development packaging helper; it is never needed to edit or publish from the browser. It creates `docs/admin/index.html`, `schema.json` and the Jekyll-generated `content.json` snapshot. Existing styles, animations, Eina fonts and Vimeo/Embedly video remain part of the portfolio.
