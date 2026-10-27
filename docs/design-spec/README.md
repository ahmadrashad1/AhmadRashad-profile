# Bauhaus UI Specification — source

`../AhmadRashad-Bauhaus-UI-Spec.pdf` is generated from `spec.html`. Edit the HTML/CSS,
never the PDF.

## Regenerate

```bash
cd docs/design-spec
google-chrome --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=../AhmadRashad-Bauhaus-UI-Spec.pdf \
  --virtual-time-budget=20000 spec.html
```

Page size comes from `@page { size: 297mm 210mm }` in `spec.css` — A4 landscape, zero margin.
Each `<section class="page">` is exactly one printed page.

## Fonts

Jost and IBM Plex Mono are vendored as woff2 under `fonts/`, referenced by `fonts.css`
with relative paths. Nothing is fetched at render time, so the PDF is reproducible offline
and byte-stable across machines.

Chrome embeds Jost as a Type 3 font because it is a variable font; the ToUnicode map
survives, so the PDF text is still selectable and searchable (~27k extractable characters).

## Checking a change

Content silently overflowing a page is the failure mode this layout is prone to, and it is
invisible in a thumbnail. After editing, re-run the overflow check rather than eyeballing:
load `spec.html` in a browser and, for every `.page`, compare each descendant's
`getBoundingClientRect().bottom` against the page's own. Anything past it is clipped in the
PDF. Page 04 overran by 86px on the first pass and looked fine until it was measured.
