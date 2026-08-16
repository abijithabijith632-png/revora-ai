-- Registration originally assigned the first tenant user an Admin role without
-- materializing the role's permission grants. Backfill the global vocabulary
-- and the canonical Admin mapping without touching users or tenant data.

INSERT INTO "permissions" ("resource", "action")
SELECT resources.resource, actions.action
FROM (VALUES
  ('dashboard'), ('leads'), ('clients'), ('contacts'), ('opportunities'),
  ('pipeline'), ('activities'), ('tasks'), ('meetings'), ('proposals'),
  ('documents'), ('reports'), ('analytics'), ('notifications'), ('users'),
  ('roles'), ('settings'), ('audit_logs'), ('ai_insights'), ('organization'),
  ('billing'), ('lead_statuses'), ('lead_sources'), ('invitations'), ('platform')
) AS resources(resource)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete'), ('export'), ('assign'), ('approve')) AS actions(action)
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON (p.resource, p.action) IN (
  ('dashboard', 'view'),
  ('organization', 'view'),
  ('users', 'view'), ('users', 'create'), ('users', 'edit'), ('users', 'assign'),
  ('roles', 'view'), ('roles', 'assign'),
  ('settings', 'view'), ('settings', 'edit'),
  ('audit_logs', 'view'),
  ('billing', 'view'),
  ('lead_statuses', 'view'), ('lead_statuses', 'edit'),
  ('lead_sources', 'view'), ('lead_sources', 'edit'),
  ('invitations', 'view'), ('invitations', 'create'), ('invitations', 'edit'),
  ('leads', 'view'), ('leads', 'create'), ('leads', 'edit'), ('leads', 'delete'), ('leads', 'export'), ('leads', 'assign'), ('leads', 'approve'),
  ('clients', 'view'), ('clients', 'create'), ('clients', 'edit'), ('clients', 'export'), ('clients', 'assign'), ('clients', 'approve'),
  ('contacts', 'view'), ('contacts', 'create'), ('contacts', 'edit'), ('contacts', 'export'), ('contacts', 'assign'),
  ('opportunities', 'view'), ('opportunities', 'create'), ('opportunities', 'edit'), ('opportunities', 'export'), ('opportunities', 'assign'), ('opportunities', 'approve'),
  ('pipeline', 'view'), ('pipeline', 'edit'),
  ('activities', 'view'), ('activities', 'create'), ('activities', 'edit'),
  ('tasks', 'view'), ('tasks', 'create'), ('tasks', 'edit'), ('tasks', 'delete'), ('tasks', 'assign'),
  ('meetings', 'view'), ('meetings', 'create'), ('meetings', 'edit'), ('meetings', 'assign'),
  ('proposals', 'view'), ('proposals', 'create'), ('proposals', 'edit'), ('proposals', 'approve'),
  ('documents', 'view'), ('documents', 'create'), ('documents', 'edit'), ('documents', 'delete'), ('documents', 'export'),
  ('reports', 'view'), ('reports', 'export'),
  ('analytics', 'view'), ('analytics', 'export'),
  ('notifications', 'view'), ('ai_insights', 'view')
)
WHERE r.name = 'Admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
