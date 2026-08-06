// Minimal Suspense fallback for lazy-loaded routes. Deliberately has zero
// imports beyond React so it never adds to whatever chunk is loading — it's
// inlined in the main bundle. Shown only on the brief gap while a route
// chunk downloads, which itself is now much smaller after code-splitting.
export function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
