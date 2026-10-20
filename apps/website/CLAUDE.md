# Axolotl Website

`apps/website` is the official Axolotl Launcher website. It is a Nuxt 3 static site using Vue 3, Tailwind CSS, and the shared UI and asset packages.

## Development

Run `pnpm website:dev` from the repository root for local development and `pnpm website:build` for the production build.

## Structure

- `src/pages/` contains file-based routes.
- `src/components/` contains website-specific components.
- `src/layouts/` contains page layouts.
- `src/locales/` contains website messages.
- Shared components and styles belong in `packages/ui` and `packages/assets` when both the website and desktop application can use them.
