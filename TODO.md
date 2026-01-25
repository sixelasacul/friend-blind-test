# TODO

## MVP

- [ ] Min 1 artist
- [ ] Min 1 player

## Future features

- [ ] Include genres unrelated to users' choices
- [ ] Difficulty settings (changes popularity threshold)
- [ ] Connect to one's account (YT, Spotify, Deezer) to pick from their liked artists/songs
- [ ] Can be played solo/local

## Technical

- [ ] Define a SPECS.md file for agents?
- [x] Update README
- [x] Prettier
- [x] Oxlint + Oxfmt
- [x] lefthook (lint-staged)
- [x] Update tanstack router config and repo structure
  - [x] Probably run create-tsrouter-app to redo everything (wasn't available at first)
- [x] Update code with deprecation notes (ts-router, eslint)
- [ ] Github actions CI
  - [ ] https://oxc.rs/docs/guide/usage/linter/ci.html
- [ ] Sentry? Feedback?
- [ ] Debuggin tools
  - [ ] Pause
  - [ ] Skip
  - [x] Dedicated page to generate songs for a single artist
    - [ ] Use virtual route from tsrouter to not have it on prod
    - [ ] Or simply use beforeload, but the code will be bundled (though with automatic code splitting, that's no an issue)
  - [ ] Debugging logger (pino + pino-pretty on convex logs)
