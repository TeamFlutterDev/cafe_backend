import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as rolesService from './service.js';
import { Errors } from '../../plugins/errors.js';

const RoleBody = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  role_name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, digits, underscores only'),
  display_name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  is_system: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  can_view_dashboard: z.boolean().optional().default(false),
  can_create_bill: z.boolean().optional().default(false),
  can_edit_bill: z.boolean().optional().default(false),
  can_cancel_bill: z.boolean().optional().default(false),
  can_apply_discount: z.boolean().optional().default(false),
  can_manage_items: z.boolean().optional().default(false),
  can_manage_tables: z.boolean().optional().default(false),
  can_view_reports: z.boolean().optional().default(false),
  can_manage_users: z.boolean().optional().default(false),
  can_manage_settings: z.boolean().optional().default(false),
  can_void_items: z.boolean().optional().default(false),
  can_manage_stock: z.boolean().optional().default(false),
  can_manage_roles: z.boolean().optional().default(false),
});

export default async function rolesRoutes(app: FastifyInstance) {
  // GET /roles?company_id=
  app.get(
    '/roles',
    { preHandler: [app.authenticate, app.requirePerm('can_manage_roles')] },
    async (req) => {
      const q = z.object({ company_id: z.string().uuid().optional() }).parse(req.query);
      const companyId = req.user.role === 'owner' && q.company_id ? q.company_id : req.user.cid;
      if (!companyId) throw Errors.badRequest('No company associated with this account.');
      return rolesService.getRoles(app, companyId);
    },
  );

  // GET /roles/by-name?company_id=&role_name=
  // Used during login permission sync — any authenticated user may call this.
  app.get(
    '/roles/by-name',
    { preHandler: app.authenticate },
    async (req) => {
      const q = z
        .object({
          company_id: z.string().uuid().optional(),
          role_name: z.string().min(1),
        })
        .parse(req.query);
      const companyId = req.user.role === 'owner' && q.company_id ? q.company_id : req.user.cid;
      if (!companyId) throw Errors.badRequest('No company associated with this account.');
      return rolesService.getRoleByName(app, companyId, q.role_name);
    },
  );

  // POST /roles  (create or update — upsert)
  app.post(
    '/roles',
    { preHandler: [app.authenticate, app.requirePerm('can_manage_roles')] },
    async (req) => {
      const body = RoleBody.parse(req.body);
      // Tenant isolation: non-owner callers always write to their own company.
      const companyId = req.user.role === 'owner' ? body.company_id : (req.user.cid ?? body.company_id);
      if (!companyId) throw Errors.badRequest('No company associated with this account.');
      return rolesService.upsertRole(app, { ...body, company_id: companyId });
    },
  );

  // DELETE /roles/:id
  app.delete(
    '/roles/:id',
    { preHandler: [app.authenticate, app.requirePerm('can_manage_roles')] },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const companyId = req.user.cid;
      if (!companyId && req.user.role !== 'owner') throw Errors.badRequest('No company associated with this account.');
      await rolesService.deleteRole(app, id, companyId ?? '');
      return { ok: true };
    },
  );
}
