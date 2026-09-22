/**
 * `typedRoutes` is on, so Next type-checks every href against the routes that
 * actually exist — a typo in a link is a build error rather than a 404 in
 * production. That check cannot see through a path that is *computed*, such as
 * the one `homePathFor(role)` returns.
 *
 * This is the single place that bridges the two. Hand-written hrefs in
 * components stay literal and fully checked; only computed navigation passes
 * through here, so the escape hatch is one line wide and reviewable.
 */
export type AppPath = string

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dynamicRoute(path: AppPath): any {
  return path
}
