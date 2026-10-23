# Free guides by @nylejoness

Free money and property guides for young UK adults, turned from PDFs into interactive web pages. Served with GitHub Pages at https://n4jones.github.io/renting-guide/.

Plain HTML, CSS and vanilla JS. No frameworks and no build step, so GitHub Pages serves the files as they are.

## Structure

```
index.html              Hub page with a card for each guide
assets/brand.css        Shared brand tokens, type and components
assets/site.js          Shared behaviour: follow badge, checklist storage, accordions, copy buttons
rent-to-buy/            One folder per guide
  index.html
  guide.css             Guide specific tool styles
  guide.js              Guide specific tools
README.md
```

## Guides

| Guide | Folder | Last checked |
| --- | --- | --- |
| Rent to Buy | `/rent-to-buy/` | 23 Oct 2026 |

## Adding a guide

Rerun the guide builder prompt with the new PDF link. It will:

1. Fact-check the PDF against current official sources.
2. Add a new folder, for example `/lifetime-isa/index.html`, using `assets/brand.css` and `assets/site.js`.
3. Add a card for it inside `#guides` on `index.html`, keeping every existing card.

## Updating facts

Each guide shows a "Last checked" date. When rules change (income caps, Lifetime ISA limits, providers), update the copy, the constants at the top of the guide's `guide.js`, and the date.

Everything here is information only, not financial or legal advice.
