# Raghd Boulos portfolio

Live website: https://raghdb.github.io/raghd-boulos-website/

## Edit without code

Open https://app.pagescms.org/, sign in with GitHub, and choose `RaghdB/raghd-boulos-website`, branch `main`. The shortcut https://raghdb.github.io/raghd-boulos-website/admin/ links to the editor.

- **Name, contact & navigation** updates shared values everywhere.
- Choose a page to edit its text, headings, captions, existing project images, image descriptions and external links.
- Preserve leading/trailing spaces on inline text fragments. Paragraph breaks are supported in multiline fields.
- Save to publish. Allow GitHub Pages to finish building before refreshing the website.
- Use the repository commit history to restore an earlier edit.

## Access and security

GitHub authenticates the editor. Install the Pages CMS GitHub App only for this repository; no passwords or publishing tokens belong in this code. No CMS collaborators are configured. Do not invite collaborators unless you intend to grant editing access. GitHub repository collaborators with write permission can also modify the source.

The repository and website are public. Editable content must not contain secrets. Text and image attributes are escaped during the Jekyll build, and external links only render with `https://`. New media uploads through the editor are limited to raster image formats. Existing SVG artwork remains part of the design.

## How publishing works

GitHub Pages builds `docs/` from the `main` branch using Jekyll. Content lives in `docs/_data/*.json`, the editor schema in `.pages.yml`, and page layouts in `docs/**/index.html`. Keep Liquid expressions and front matter intact when editing layouts. The site retains its local fonts, CSS, scripts and Vimeo/Embedly demonstration video.
