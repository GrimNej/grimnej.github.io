# grimnej.com

Personal portfolio of Ginej Neupane (GrimNej), served by GitHub Pages from this repository.

It is a static site with no build step: `index.html`, one stylesheet, and a few ES modules.

## Preview locally

```sh
python -m http.server 4317
```

Then open http://127.0.0.1:4317. Open it through a server rather than as a file, because the ES modules and the portrait effect need same-origin loading.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | All content, metadata, and structured data |
| `assets/css/main.css` | Design tokens, layout, and responsive rules |
| `assets/js/main.js` | Boot sequence (loader ring and iris), smooth scroll, reveals, echo headings, marquee, hover and scroll interactions |
| `assets/js/about.js` | The About scene: the photo card opens to fill the screen while "About" and "me" split apart |
| `assets/js/reel.js` | Selected work on large screens: a WebGL ribbon that folds into a ring, then a reel the scroll turns |
| `assets/js/process.js` | How it goes: a pinned horizontal track on large screens, a list with a filling rail elsewhere |
| `assets/js/field.js` | WebGL particle field that morphs between sections |
| `assets/js/portrait.js` | Hero portrait intro and the ASCII "token view" lens |
| `assets/js/mascot.js` | Grim, the mascot: chat guide, speech bubbles, and reactions |
| `assets/js/pit.js` | The "Ball knowledge" physics pit |
| `assets/js/tools.js` | Tool names, colours, and Simple Icons paths for the pit |
| `assets/js/github.js` | Live repository list with an offline fallback |
| `assets/work/` | Project previews taken from each project's own README banner or live app |
| `assets/vendor/` | GSAP 3.15 (ScrollTrigger, SplitText) and Lenis 1.3, self-hosted |
| `data/github.json` | Offline fallback for the repository list |
| `robots.txt`, `sitemap.xml` | Crawling hints for search engines |

## Keeping things current

- **The rest of the pile** loads public repositories from the GitHub API in the visitor's browser, so new repositories appear without editing the site. Results are cached for 30 minutes per browser session. If the API is unreachable, the list falls back to `data/github.json`; refresh it with `node scripts/snapshot-github.mjs`.
- Repositories without a GitHub description show a tagline from their README (`FALLBACK_DESCRIPTIONS` in `assets/js/github.js`). Adding descriptions on GitHub replaces those automatically.
- **Selected work** is curated by hand in `index.html`. To feature a project, copy one `<article class="project">` block, put its banner or screenshot in `assets/work/`, add the repository to `FEATURED` in `assets/js/github.js`, and add it to `workExample` in the JSON-LD block. The reel builds itself from those articles (banner, accent, text, and links), so it needs no separate edit; the articles are also what phones, short screens, and reduced motion show.
- **Stack**: add a tool to the list in `index.html` and, for the pit, to `assets/js/tools.js`.
- **Grim's answers** live in `TOPICS` and `LINES` at the top of `assets/js/mascot.js`.
- After a deploy, update `lastmod` in `sitemap.xml` and `dateModified` in the JSON-LD.
