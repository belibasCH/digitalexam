-- Teacher Groups for Collaboration
-- Allows teachers to create groups, invite other teachers, and share questions

-- Gruppen
CREATE TABLE teacher_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gruppenmitglieder mit Rollen
CREATE TABLE group_members (
  group_id UUID REFERENCES teacher_groups(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, teacher_id)
);

-- Einladungen
CREATE TABLE group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES teacher_groups(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, invited_email, status)
);

-- Aufgaben-Freigaben
CREATE TABLE question_shares (
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES teacher_groups(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (question_id, group_id)
);

-- Indexes for performance
CREATE INDEX idx_group_members_teacher_id ON group_members(teacher_id);
CREATE INDEX idx_group_invitations_email ON group_invitations(invited_email);
CREATE INDEX idx_group_invitations_status ON group_invitations(status);
CREATE INDEX idx_question_shares_group_id ON question_shares(group_id);
CREATE INDEX idx_teacher_groups_created_by ON teacher_groups(created_by);

-- Enable RLS on all new tables
ALTER TABLE teacher_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_shares ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for teacher_groups
-- =====================================================

-- Members can view their groups
CREATE POLICY "Members can view their groups" ON teacher_groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM group_members WHERE teacher_id = auth.uid())
  );

-- Anyone can create a group
CREATE POLICY "Teachers can create groups" ON teacher_groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Owner and admins can update group
CREATE POLICY "Owner and admins can update group" ON teacher_groups
  FOR UPDATE USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owner can delete group
CREATE POLICY "Owner can delete group" ON teacher_groups
  FOR DELETE USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role = 'owner'
    )
  );

-- =====================================================
-- RLS Policies for group_members
-- =====================================================

-- Members can view other members in their groups
CREATE POLICY "Members can view group members" ON group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE teacher_id = auth.uid())
  );

-- System can insert when accepting invitation (owner is added automatically)
CREATE POLICY "Allow member insertion" ON group_members
  FOR INSERT WITH CHECK (
    -- Owner adding themselves when creating group
    (teacher_id = auth.uid() AND role = 'owner') OR
    -- Member being added (via invitation acceptance)
    (teacher_id = auth.uid() AND role = 'member')
  );

-- Only owner can change roles
CREATE POLICY "Owner can update member roles" ON group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role = 'owner'
    )
  );

-- Owner and admins can remove members (except owner)
CREATE POLICY "Owner and admins can remove members" ON group_members
  FOR DELETE USING (
    -- Owner or admin removing someone else
    (group_id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role IN ('owner', 'admin')
    ) AND role != 'owner')
    OR
    -- Member leaving voluntarily (except owner can't leave)
    (teacher_id = auth.uid() AND role != 'owner')
  );

-- =====================================================
-- RLS Policies for group_invitations
-- =====================================================

-- Invited users can see their pending invitations
CREATE POLICY "Invited users can see their invitations" ON group_invitations
  FOR SELECT USING (
    -- User can see invitations sent to their email
    invited_email = (SELECT auth.jwt() ->> 'email') OR
    -- Group admins/owners can see group invitations
    group_id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner and admins can send invitations
CREATE POLICY "Owner and admins can send invitations" ON group_invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid() AND
    group_id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Invited users can update (accept/decline) their invitations
CREATE POLICY "Invited users can respond to invitations" ON group_invitations
  FOR UPDATE USING (
    invited_email = (SELECT auth.jwt() ->> 'email') AND status = 'pending'
  );

-- Owner and admins can delete invitations
CREATE POLICY "Owner and admins can delete invitations" ON group_invitations
  FOR DELETE USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE teacher_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- RLS Policies for question_shares
-- =====================================================

-- Group members can see shared questions
CREATE POLICY "Group members can see shared questions" ON question_shares
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE teacher_id = auth.uid())
  );

-- Question owner can share their questions
CREATE POLICY "Question owner can share questions" ON question_shares
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    question_id IN (SELECT id FROM questions WHERE teacher_id = auth.uid()) AND
    group_id IN (SELECT group_id FROM group_members WHERE teacher_id = auth.uid())
  );

-- Question owner can unshare their questions
CREATE POLICY "Question owner can unshare questions" ON question_shares
  FOR DELETE USING (
    shared_by = auth.uid() OR
    question_id IN (SELECT id FROM questions WHERE teacher_id = auth.uid())
  );

-- =====================================================
-- Update questions policy to allow viewing shared questions
-- =====================================================

-- Drop the existing policy for viewing questions first
DROP POLICY IF EXISTS "Teachers can view own questions" ON questions;

-- Create new policy that includes shared questions
CREATE POLICY "Teachers can view own and shared questions" ON questions
  FOR SELECT USING (
    teacher_id = auth.uid() OR
    id IN (
      SELECT qs.question_id FROM question_shares qs
      JOIN group_members gm ON qs.group_id = gm.group_id
      WHERE gm.teacher_id = auth.uid()
    )
  );

-- =====================================================
-- Helper view for profiles (to allow viewing group members' names)
-- =====================================================

-- Allow viewing profiles of group members
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view own and group members profiles" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR
    id IN (
      SELECT gm2.teacher_id FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.teacher_id = auth.uid()
    )
  );
