-- Fix infinite recursion in RLS policies for group_members and profiles
-- The original policies had circular references causing infinite recursion

-- =====================================================
-- Helper functions with SECURITY DEFINER to avoid RLS recursion
-- =====================================================

-- Function to get group IDs for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_group_ids(user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT group_id FROM group_members WHERE teacher_id = user_id;
$$;

-- Function to check if user is member of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_member(user_id UUID, check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE teacher_id = user_id AND group_id = check_group_id
  );
$$;

-- Function to check if user has admin/owner role in a group (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_admin(user_id UUID, check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE teacher_id = user_id
      AND group_id = check_group_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Function to check if user is owner of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_owner(user_id UUID, check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE teacher_id = user_id
      AND group_id = check_group_id
      AND role = 'owner'
  );
$$;

-- =====================================================
-- Drop ALL old policies to ensure clean slate
-- =====================================================

-- Drop group_members policies
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Allow member insertion" ON group_members;
DROP POLICY IF EXISTS "Owner can update member roles" ON group_members;
DROP POLICY IF EXISTS "Owner and admins can remove members" ON group_members;

-- Drop teacher_groups policies
DROP POLICY IF EXISTS "Members can view their groups" ON teacher_groups;
DROP POLICY IF EXISTS "Teachers can create groups" ON teacher_groups;
DROP POLICY IF EXISTS "Owner and admins can update group" ON teacher_groups;
DROP POLICY IF EXISTS "Owner can delete group" ON teacher_groups;

-- Drop group_invitations policies
DROP POLICY IF EXISTS "Invited users can see their invitations" ON group_invitations;
DROP POLICY IF EXISTS "Owner and admins can send invitations" ON group_invitations;
DROP POLICY IF EXISTS "Invited users can respond to invitations" ON group_invitations;
DROP POLICY IF EXISTS "Owner and admins can delete invitations" ON group_invitations;

-- Drop question_shares policies
DROP POLICY IF EXISTS "Group members can see shared questions" ON question_shares;
DROP POLICY IF EXISTS "Question owner can share questions" ON question_shares;
DROP POLICY IF EXISTS "Question owner can unshare questions" ON question_shares;

-- Drop profiles policies (both old and new versions)
DROP POLICY IF EXISTS "Users can view own and group members profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Drop questions policies (both old and new versions)
DROP POLICY IF EXISTS "Teachers can view own and shared questions" ON questions;
DROP POLICY IF EXISTS "Teachers can view shared questions" ON questions;
DROP POLICY IF EXISTS "Teachers can view own questions" ON questions;

-- =====================================================
-- Restore original profiles policy
-- =====================================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- =====================================================
-- Restore original questions SELECT policy
-- =====================================================
CREATE POLICY "Teachers can view own questions" ON questions
  FOR SELECT USING (teacher_id = auth.uid());

-- =====================================================
-- Recreate policies using helper functions
-- =====================================================

-- teacher_groups policies
CREATE POLICY "Members can view their groups" ON teacher_groups
  FOR SELECT USING (
    id IN (SELECT get_user_group_ids(auth.uid()))
  );

CREATE POLICY "Teachers can create groups" ON teacher_groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner and admins can update group" ON teacher_groups
  FOR UPDATE USING (is_group_admin(auth.uid(), id));

CREATE POLICY "Owner can delete group" ON teacher_groups
  FOR DELETE USING (is_group_owner(auth.uid(), id));

-- group_members policies
CREATE POLICY "Members can view group members" ON group_members
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Allow member insertion" ON group_members
  FOR INSERT WITH CHECK (
    -- Owner adding themselves when creating group
    (teacher_id = auth.uid() AND role = 'owner') OR
    -- Member being added (via invitation acceptance)
    (teacher_id = auth.uid() AND role = 'member')
  );

CREATE POLICY "Owner can update member roles" ON group_members
  FOR UPDATE USING (is_group_owner(auth.uid(), group_id));

CREATE POLICY "Owner and admins can remove members" ON group_members
  FOR DELETE USING (
    -- Owner or admin removing someone else (but not the owner)
    (is_group_admin(auth.uid(), group_id) AND role != 'owner')
    OR
    -- Member leaving voluntarily (except owner can't leave)
    (teacher_id = auth.uid() AND role != 'owner')
  );

-- group_invitations policies
CREATE POLICY "Invited users can see their invitations" ON group_invitations
  FOR SELECT USING (
    invited_email = (SELECT auth.jwt() ->> 'email') OR
    is_group_admin(auth.uid(), group_id)
  );

CREATE POLICY "Owner and admins can send invitations" ON group_invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid() AND
    is_group_admin(auth.uid(), group_id)
  );

CREATE POLICY "Invited users can respond to invitations" ON group_invitations
  FOR UPDATE USING (
    invited_email = (SELECT auth.jwt() ->> 'email') AND status = 'pending'
  );

CREATE POLICY "Owner and admins can delete invitations" ON group_invitations
  FOR DELETE USING (is_group_admin(auth.uid(), group_id));

-- question_shares policies
CREATE POLICY "Group members can see shared questions" ON question_shares
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Question owner can share questions" ON question_shares
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    question_id IN (SELECT id FROM questions WHERE teacher_id = auth.uid()) AND
    is_group_member(auth.uid(), group_id)
  );

CREATE POLICY "Question owner can unshare questions" ON question_shares
  FOR DELETE USING (
    shared_by = auth.uid() OR
    question_id IN (SELECT id FROM questions WHERE teacher_id = auth.uid())
  );

-- questions policy for viewing shared questions (additional to the restored original policy)
CREATE POLICY "Teachers can view shared questions" ON questions
  FOR SELECT USING (
    id IN (
      SELECT qs.question_id FROM question_shares qs
      WHERE is_group_member(auth.uid(), qs.group_id)
    )
  );