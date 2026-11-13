# Raghd Boulos portfolio

Live website: https://raghdb.github.io/raghd-boulos-website/

## Edit without code, on your Mac

Double-click **Start Website Editor.command** in this project folder. Keep the Terminal window open while editing. The launcher opens a local browser editor with forms for all five pages, shared contact details, images and external links.

1. GitHub CLI (`gh`, https://cli.github.com/) and Python 3 are required. They are already installed on the original Mac.
2. On first use, follow the GitHub CLI sign-in prompt. Credentials stay with GitHub CLI, outside the website and browser editor.
3. Change any fields; **Save locally** keeps a draft. **Publish to website** commits the content and selected uploads to this repository. Wait for GitHub Pages to finish building before refreshing the live website.
4. Close the Terminal window to stop the editor. Reopen the launcher for a fresh session. To launch from Terminal, run `python3 tools/editor.py` in the project folder.

The editor changes existing content and images. Adding/removing page layouts or project sections requires editing the templates. Keep leading/trailing spaces on inline text fragments. Use repository commit history to restore a published edit.

## Security

No extra online editing service is used. The editor binds only to `127.0.0.1` on a random port, requires a fresh session token on API requests, checks request origin and host, and exposes only configured files. Website visitors cannot reach your Mac’s local editing controls. No CMS collaborators, public save endpoint or publishing tokens are configured in the site.

Only GitHub handles online sign-in and publishing. The local editor uses the existing `gh` credential and restricts its operations to `RaghdB/raghd-boulos-website`, branch `main`, the six content JSON files, and generated raster uploads. GitHub CLI’s credential may have broader access than the editor itself. Do not share your session URL or invite repository collaborators unless you intend to grant access.

Text is escaped during the Jekyll build; external links must use HTTPS. Image uploads accept PNG, JPEG, GIF and WebP with matching file signatures; they are not a full image sanitizer. Draft state is ignored by Git. Content and uploaded images become public when published. Concurrent remote content changes stop publication rather than being overwritten. A conflict requires resolving the remote and local versions before publishing again.

## Publishing

GitHub Pages builds `docs/` from `main` using Jekyll. Content is in `docs/_data/*.json`; page layouts are `docs/**/index.html`; the local form schema is `tools/editor-schema.json`. Keep Liquid expressions and front matter intact. Existing CSS, animations, scripts, Eina fonts and the Vimeo/Embedly demonstration video are retained.
