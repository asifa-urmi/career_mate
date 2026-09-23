/**
 * Which sidebar link is highlighted for the current path.
 *
 * Two rules pull in opposite directions: `/jobs` must light up on `/jobs/12`
 * (a detail page belongs to its list), but `/admin` must NOT light up on
 * `/admin/users` (that route has its own nav item). Telling those apart is
 * impossible from the href and the path alone — it depends on whether a more
 * specific sibling claims the route. So the sibling set is an argument.
 *
 * The result: exactly one item is ever active, which the tests pin directly.
 */
export function isNavItemActive(
  itemHref: string,
  pathname: string,
  siblingHrefs: readonly string[] = [],
): boolean {
  const item = normalise(itemHref)
  const path = normalise(pathname)

  if (item === path) return true
  if (!path.startsWith(`${item}/`)) return false

  const claimedByDeeperSibling = siblingHrefs.some((href) => {
    const sibling = normalise(href)
    if (sibling === item) return false
    return sibling === path || path.startsWith(`${sibling}/`)
  })

  return !claimedByDeeperSibling
}

function normalise(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}
