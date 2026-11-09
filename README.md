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

## Weekly log

Each week is one note in `_notes/log/` (for example `2026-w46.md`, published at `/log/2026-w46`). It has a heading for each day and a reflection at the end.

```sh
bin/log                  # open this week's log; adds today's heading if missing
bin/log "tried X, found Y"   # add a bullet under today without opening an editor
bin/log reflect          # open the log at the weekly reflection
bin/log publish          # commit and push this week's log
```

The editor comes from `$EDITOR` (VS Code jumps to the line); without one, the file opens in your default app.
