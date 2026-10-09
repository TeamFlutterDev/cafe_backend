import type { FastifyInstance } from 'fastify';
import { newId } from '../../lib/ids.js';

export interface RoleRow {
  id: string;
  company_id: string;
  role_name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  can_view_dashboard: boolean;
  can_create_bill: boolean;
  can_edit_bill: boolean;
  can_cancel_bill: boolean;
  can_apply_discount: boolean;
  can_manage_items: boolean;
  can_manage_tables: boolean;
  can_view_reports: boolean;
  can_manage_users: boolean;
  can_manage_settings: boolean;
  can_void_items: boolean;
  can_manage_stock: boolean;
  can_manage_roles: boolean;
  created_at: Date;
}

export async function getRoles(app: FastifyInstance, companyId: string): Promise<RoleRow[]> {
  const [rows] = await app.db.query(
    'SELECT * FROM role_master WHERE company_id = ? ORDER BY is_system DESC, display_name',
    [companyId],
  );
  return rows as RoleRow[];
}

export async function getRoleByName(
  app: FastifyInstance,
  companyId: string,
  roleName: string,
): Promise<RoleRow | null> {
  const [rows] = await app.db.query(
    'SELECT * FROM role_master WHERE company_id = ? AND role_name = ?',
    [companyId, roleName],
  );
  return (rows as RoleRow[])[0] ?? null;
}

export async function upsertRole(
  app: FastifyInstance,
  data: {
    id?: string;
    company_id: string;
    role_name: string;
    display_name: string;
    description?: string | null;
    is_system?: boolean;
    is_active?: boolean;
    can_view_dashboard?: boolean;
    can_create_bill?: boolean;
    can_edit_bill?: boolean;
    can_cancel_bill?: boolean;
    can_apply_discount?: boolean;
    can_manage_items?: boolean;
    can_manage_tables?: boolean;
    can_view_reports?: boolean;
    can_manage_users?: boolean;
    can_manage_settings?: boolean;
    can_void_items?: boolean;
    can_manage_stock?: boolean;
    can_manage_roles?: boolean;
  },
): Promise<{ id: string }> {
  const id = data.id ?? newId();
  await app.db.execute(
    `INSERT INTO role_master (
       id, company_id, role_name, display_name, description, is_system, is_active,
       can_view_dashboard, can_create_bill, can_edit_bill, can_cancel_bill,
       can_apply_discount, can_manage_items, can_manage_tables, can_view_reports,
       can_manage_users, can_manage_settings, can_void_items, can_manage_stock,
       can_manage_roles
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name        = VALUES(display_name),
       description         = VALUES(description),
       is_active           = VALUES(is_active),
       can_view_dashboard  = VALUES(can_view_dashboard),
       can_create_bill     = VALUES(can_create_bill),
       can_edit_bill       = VALUES(can_edit_bill),
       can_cancel_bill     = VALUES(can_cancel_bill),
       can_apply_discount  = VALUES(can_apply_discount),
       can_manage_items    = VALUES(can_manage_items),
       can_manage_tables   = VALUES(can_manage_tables),
       can_view_reports    = VALUES(can_view_reports),
       can_manage_users    = VALUES(can_manage_users),
       can_manage_settings = VALUES(can_manage_settings),
       can_void_items      = VALUES(can_void_items),
       can_manage_stock    = VALUES(can_manage_stock),
       can_manage_roles    = VALUES(can_manage_roles)`,
    [
      id,
      data.company_id,
      data.role_name,
      data.display_name,
      data.description ?? null,
      data.is_system ? 1 : 0,
      data.is_active !== false ? 1 : 0,
      data.can_view_dashboard ? 1 : 0,
      data.can_create_bill ? 1 : 0,
      data.can_edit_bill ? 1 : 0,
      data.can_cancel_bill ? 1 : 0,
      data.can_apply_discount ? 1 : 0,
      data.can_manage_items ? 1 : 0,
      data.can_manage_tables ? 1 : 0,
      data.can_view_reports ? 1 : 0,
      data.can_manage_users ? 1 : 0,
      data.can_manage_settings ? 1 : 0,
      data.can_void_items ? 1 : 0,
      data.can_manage_stock ? 1 : 0,
      data.can_manage_roles ? 1 : 0,
    ],
  );
  return { id };
}

export async function deleteRole(
  app: FastifyInstance,
  roleId: string,
  companyId: string,
): Promise<void> {
  // Block deletion of system roles.
  const [rows] = await app.db.query(
    'SELECT is_system FROM role_master WHERE id = ? AND company_id = ?',
    [roleId, companyId],
  );
  const row = (rows as { is_system: boolean }[])[0];
  if (!row) return; // already gone
  if (row.is_system) {
    throw Object.assign(new Error('System roles cannot be deleted.'), { statusCode: 422 });
  }
  await app.db.execute(
    'DELETE FROM role_master WHERE id = ? AND company_id = ?',
    [roleId, companyId],
  );
}
