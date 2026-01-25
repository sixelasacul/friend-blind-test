# friend-blind-test

This is a simple web blind test app to be played with friends, or solo. The key part is that each player selects a few artists they like, and the app will generate a playlist of songs to guess based given artists and similar ones. Each round, you'll have to guess the song name and artist(s), and to which player it is associated. Faster players will score more points!

## Tech stack

- **Frontend**: Typescript React, TanStack Router, Vite, TailwindCSS, ShadCN, Base UI
- **Backend**: Typescript, Convex, Spotify, Last.fm
- **Tooling**: Oxlint, Oxfmt, Lefthook
- **Infrastructure**: CloudFlare, Github Actions
- **Package manager**: pnpm

## Development

1. After cloning the repository, you should install the dependencies with:

```sh
pnpm install
```

2. Then, copy the `.env.example` file into `.env.local` and change the environment variables. You'll need a Spotify application, a Last.fm application, and a Convex account with a project. For the latter, you can run the following command to let Convex create a project and update the `.env.local` for you:

```sh
pnpm convex:dev
```

3. Once everything is setup, you can simply run the following command to run the front-end and back-end:

```sh
pnpm dev
```

4. This project uses Oxlint for the linter and Oxfmt for the formatter. For a smoother developer experience, you should configure your IDE to work with these tools. The project is already configured for Zed. Otherwise, you can use the following commands:

```sh
# Format the code
pnpm format:fix

# Lint the code
pnpm lint:fix
```
