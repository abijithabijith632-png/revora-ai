/**
 * Service layer foundation.
 *
 * Services hold business logic and orchestrate repositories. They are the
 * boundary between route handlers and the data-access layer, and are the
 * natural home for tenant/authorization enforcement + logging.
 */

export abstract class BaseService {
  // TODO: shared logger + tenant context resolution will live here.
}
