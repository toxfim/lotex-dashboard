# CLAUDE.md — Lotex Frontend

Coding conventions for the Lotex (UzEx / xarid.uzex.uz) tender tooling frontend.
Stack: **Vue 3 + `<script setup>` + TypeScript + Tailwind CSS**.

When generating or editing code in this repo, follow every rule below unless the task explicitly overrides it.

---

## 1. Core principles

- TypeScript everywhere. No plain `.js`/`.vue` without `lang="ts"`.
- Composition API only, always with `<script setup lang="ts">`. Never the Options API.
- Prefer small, single-responsibility components and composables over large files.
- No `any`. If a type is unknown, use `unknown` and narrow it. Use `// TODO(type)` only as a last resort.
- Fail loud in dev: validate API responses, don't silently swallow errors.

## 2. SFC structure

Single-File Component block order is fixed:

```vue
<script setup lang="ts">
// 1. imports (see §8)
// 2. props / emits
// 3. composables & stores
// 4. local reactive state (ref/reactive)
// 5. computed
// 6. watchers
// 7. functions / handlers
// 8. lifecycle hooks
</script>

<template>
  <!-- markup -->
</template>

<!-- avoid <style>; use Tailwind. Only add scoped <style> for things Tailwind can't express. -->
```

## 3. TypeScript

- Props and emits are **typed via generics**, never runtime objects:

```ts
const props = defineProps<{
  lotId: string;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [lotId: string];
  remove: [lotId: string];
}>();
```

- Use `withDefaults` for optional props with defaults.
- Prefer `interface` for object shapes, `type` for unions/aliases.
- Domain types (Lot, Offer, Spec, InventoryItem, Tender) live in `src/types/` and are imported, never redefined inline.
- Use `as const` for literal arrays/objects that drive types.

## 4. Reactivity

- `ref()` for primitives and single values; `reactive()` only for tightly-coupled object state.
- Never destructure a `reactive` object (loses reactivity). Use `toRefs` if needed.
- `computed` for derived state — never compute in the template.
- Watchers: prefer `watchEffect` for simple side-effects, `watch` when you need old/new values or explicit sources.

## 5. Composables

- Reusable logic goes in `src/composables/`, named `useX.ts` and returning a plain object of refs/functions.
- One composable = one concern (e.g. `useLotMatching`, `useOfferForm`, `useNgSelectScrape`).
- Composables don't touch the DOM directly unless that's their explicit job.

## 6. State management (Pinia)

- Global/shared state uses Pinia stores in `src/stores/`, setup-style:

```ts
export const useTenderStore = defineStore("tender", () => {
  const lots = ref<Lot[]>([]);
  const loading = ref(false);
  const matchedLots = computed(() => lots.value.filter((l) => l.matched));
  async function fetchLots() {
    /* ... */
  }
  return { lots, loading, matchedLots, fetchLots };
});
```

- Component-local state stays in the component. Don't put everything in Pinia.

## 7. Tailwind

- Tailwind utilities first; reach for `<style>` only when impossible otherwise.
- Merge conditional classes with a `cn()` helper (`clsx` + `tailwind-merge`):

```ts
import { cn } from '@/lib/cn'
:class="cn('rounded-md px-3 py-2', selected && 'bg-blue-600 text-white')"
```

- No magic arbitrary values (`w-[437px]`) unless genuinely necessary — use the scale.
- Repeated multi-utility patterns → extract a component, not a `@apply` soup.
- Class order follows the default Tailwind/Prettier-plugin ordering; run the formatter.

## 8. Imports

- Use the `@/` alias for `src/`. No deep relative chains (`../../../`).
- Order: external packages → `@/` internal → relative → types (`import type`).
- Always `import type { ... }` for type-only imports.

## 9. Naming

- Components: `PascalCase` files and tags (`LotCard.vue`, `<LotCard />`).
- Composables: `useCamelCase`.
- Stores: `useXStore`.
- Variables/functions: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Boolean props/vars read as predicates: `isLoading`, `hasMatch`, `canSubmit`.
- Event handlers: `handleX` locally, emitted events are bare verbs (`select`, not `onSelect`).

## 10. Folder structure

```folder-structure
src/
  assets/
  components/        # dumb/presentational + shared
  composables/
  stores/
  types/
  lib/               # cn(), api client, parsers (TSV/spec extraction)
  views/ or pages/   # route-level components
  router/
```

## 11. API & data

- Single typed API client in `src/lib/api.ts`. Components/composables call it, not `fetch` directly.
- Parse and validate external/scraped data (ng-select dropdowns, offer forms) at the boundary before it enters typed state.
- Spec/TSV formatting logic lives in `src/lib/` as pure, testable functions.

## 12. Formatting & lint

- Prettier + ESLint (`@vue/eslint-config-typescript`) are the source of truth — don't hand-format.
- No unused vars/imports. No `console.log` in committed code (use a logger or remove).
- Keep comments about _why_, not _what_. Uzbek or English comments both fine; be consistent within a file.
