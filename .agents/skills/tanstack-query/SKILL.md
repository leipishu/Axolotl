---
name: tanstack-query
description: Convert a page or component from useAsyncData/manual ref patterns to TanStack Query for server state management. Use when migrating data fetching to useQuery/useMutation, adding cache invalidation, or replacing useAsyncData with TanStack Query.
argument-hint: <path-to-file>
---

## Steps

1. **Read the target file** at `$ARGUMENTS` and identify all data-fetching patterns: `useAsyncData`, `useFetch`, manual `ref()` + `await`, or `onMounted` fetch calls.
2. **Define query boundaries**: use stable hierarchical keys, preserve reactive parameters, and decide whether mutation feedback needs an optimistic update.
3. **Convert queries:**
   - Replace `useAsyncData` / `useFetch` / manual fetches with `useQuery`.
   - Use the `api-client` via `injectModrinthClient()` for the `queryFn`.
   - Design query keys with the `['resource', 'version', ...params]` convention.
   - Use `computed` query keys for reactive parameters.
   - Use the `enabled` option for conditional queries that depend on other data.
4. **Convert mutations:**
   - Replace manual `try/catch` + `ref` patterns with `useMutation`.
   - Add `onSuccess` handlers that invalidate or update related query caches.
   - Consider optimistic updates for UI-critical mutations.
5. **Clean up:**
   - Remove manual loading/error `ref()`s that are now handled by TanStack Query's return values (`isPending`, `isError`, `error`).
   - Remove manual `onMounted` fetch calls.
   - Preserve the target surface's lifecycle behavior and avoid introducing duplicate initial requests.
6. **Verify** the page still renders correctly and that cache invalidation triggers re-fetches where expected.
