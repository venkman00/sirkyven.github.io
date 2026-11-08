# venkman.in

Personal site and digital garden, built with Jekyll on [Maxime Vaillancourt's digital garden template](https://github.com/maximevaillancourt/digital-garden-jekyll-template). The colors are the [Flexoki](https://stephango.com/flexoki) palette.

- `_notes/`: notes. Use `[[Note title]]` to link between them; backlinks are generated automatically.
- `_pages/`: Home, About, Now, and All notes.
- Pushing to `main` builds and deploys the site to GitHub Pages through `.github/workflows/jekyll.yml`.

Run it locally:

```sh
bundle install
bundle exec jekyll serve
```
