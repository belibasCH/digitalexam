-- Simple, self-contained group policies
-- Run this if previous migrations failed

-- =====================================================
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION is_member_of_group(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_owner_of_group(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND teacher_id = auth.uid()
    AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_of_group(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND teacher_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$;

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE teacher_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP ALL EXISTING POLICIES
-- =====================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'teacher_groups'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON teacher_groups', pol.policyname);
    END LOOP;
END $$;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'group_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON group_members', pol.policyname);
    END LOOP;
END $$;

-- =====================================================
-- TEACHER_GROUPS POLICIES
-- =====================================================

-- SELECT: View groups you created or are a member of
CREATE POLICY "select_own_groups" ON teacher_groups
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR is_member_of_group(id)
  );

-- INSERT: Create groups
CREATE POLICY "insert_groups" ON teacher_groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Only admins/owners can update
CREATE POLICY "update_groups" ON teacher_groups
  FOR UPDATE TO authenticated
  USING (is_admin_of_group(id));

-- DELETE: Only owner can delete
CREATE POLICY "delete_groups" ON teacher_groups
  FOR DELETE TO authenticated
  USING (is_owner_of_group(id));

-- =====================================================
-- GROUP_MEMBERS POLICIES
-- =====================================================

-- SELECT: View members of groups you belong to
CREATE POLICY "select_group_members" ON group_members
  FOR SELECT TO authenticated
  USING (is_member_of_group(group_id));

-- INSERT: Add yourself as owner or member
CREATE POLICY "insert_group_members" ON group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND role IN ('owner', 'member')
  );

-- UPDATE: Only owner can change roles
CREATE POLICY "update_group_members" ON group_members
  FOR UPDATE TO authenticated
  USING (is_owner_of_group(group_id));

-- DELETE: Owner/admin can remove (except owner), or leave yourself
CREATE POLICY "delete_group_members" ON group_members
  FOR DELETE TO authenticated
  USING (
    (teacher_id = auth.uid() AND role != 'owner')
    OR
    (role != 'owner' AND is_admin_of_group(group_id))
  );
