-- ============================================================================
--  Migration 0002 — role_master (RBAC) + can_manage_roles + role enum expand
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─── 1. role_master ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_master (
  id                  CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  company_id          CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role_name           VARCHAR(50)   NOT NULL,
  display_name        VARCHAR(100)  NOT NULL,
  description         TEXT          NULL,
  is_system           TINYINT(1)    NOT NULL DEFAULT 0,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  can_view_dashboard  TINYINT(1)    NOT NULL DEFAULT 0,
  can_create_bill     TINYINT(1)    NOT NULL DEFAULT 0,
  can_edit_bill       TINYINT(1)    NOT NULL DEFAULT 0,
  can_cancel_bill     TINYINT(1)    NOT NULL DEFAULT 0,
  can_apply_discount  TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_items    TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_tables   TINYINT(1)    NOT NULL DEFAULT 0,
  can_view_reports    TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_users    TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_settings TINYINT(1)    NOT NULL DEFAULT 0,
  can_void_items      TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_stock    TINYINT(1)    NOT NULL DEFAULT 0,
  can_manage_roles    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_role_company_name (company_id, role_name),
  CONSTRAINT fk_role_company FOREIGN KEY (company_id) REFERENCES company_master (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─── 2. Add can_manage_roles to user_permission (idempotent via procedure) ───
DROP PROCEDURE IF EXISTS _add_col_can_manage_roles;

CREATE PROCEDURE _add_col_can_manage_roles()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'user_permission'
      AND COLUMN_NAME  = 'can_manage_roles'
  ) THEN
    ALTER TABLE user_permission
      ADD COLUMN can_manage_roles TINYINT(1) NOT NULL DEFAULT 0;
  END IF;
END;

CALL _add_col_can_manage_roles();
DROP PROCEDURE IF EXISTS _add_col_can_manage_roles;

-- ─── 3. Expand user_role CHECK constraint (idempotent via procedure) ─────────
DROP PROCEDURE IF EXISTS _update_role_check;

CREATE PROCEDURE _update_role_check()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA   = DATABASE()
      AND TABLE_NAME     = 'user_profiles'
      AND CONSTRAINT_NAME = 'chk_user_role'
  ) THEN
    ALTER TABLE user_profiles DROP CHECK chk_user_role;
  END IF;
  ALTER TABLE user_profiles
    ADD CONSTRAINT chk_user_role
      CHECK (user_role IN ('owner','admin','manager','staff','kitchen_master','cashier','waiter','kitchen'));
END;

CALL _update_role_check();
DROP PROCEDURE IF EXISTS _update_role_check;

-- ─── 4. Seed system roles for all existing companies ─────────────────────────
INSERT IGNORE INTO role_master (
  id, company_id, role_name, display_name, description, is_system,
  can_view_dashboard, can_create_bill, can_edit_bill, can_cancel_bill,
  can_apply_discount, can_manage_items, can_manage_tables, can_view_reports,
  can_manage_users, can_manage_settings, can_void_items, can_manage_stock,
  can_manage_roles
)
SELECT
  UUID(), c.id,
  r.role_name, r.display_name, r.description, 1,
  r.cvd, r.ccb, r.ceb, r.ccbill, r.cad, r.cmi, r.cmt, r.cvr, r.cmu, r.cms, r.cvi, r.cmst, r.cmr
FROM company_master c
JOIN (
  SELECT 'admin'          AS role_name, 'Admin'          AS display_name, 'Full system access'          AS description, 1 AS cvd, 1 AS ccb, 1 AS ceb, 1 AS ccbill, 1 AS cad, 1 AS cmi, 1 AS cmt, 1 AS cvr, 1 AS cmu, 1 AS cms, 1 AS cvi, 1 AS cmst, 1 AS cmr UNION ALL
  SELECT 'manager',        'Manager',        'Manage operations & reports', 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0 UNION ALL
  SELECT 'staff',          'Staff',          'Billing and table service',   0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'kitchen_master', 'Kitchen Master', 'Kitchen display & KOTs',      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0
) r ON (1=1);
