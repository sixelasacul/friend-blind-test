## Build/Lint/Test Commands

**Build** (only builds the app)
`pnpm build`

**Serve** (only after building)
`pnpm serve`

**Lint**
`pnpm lint`

## Package Manager

Use `pnpm install` to install all dependencies.

## Code Style Guidelines

- **TypeScript**: Use strict mode (`"strict": true`), explicit type annotations, and prefer `interface` over `type` for public APIs.
- **Imports**: Use relative paths (`./module`), group by feature, and avoid cyclic dependencies.
- **Naming**:
  - PascalCase for classes, enums, and types
  - snake_case for variables and functions
  - camelCase for private variables
- **Error Handling**: Use `try/catch` for async operations, reject invalid inputs, and avoid silent failures.
- **Formatting**: Follow ESLint rules (see `eslint.config.js`), and use Prettier for code formatting.
- **Whitespace**: 2 spaces per indent, 1 blank line between top-level blocks.
