-- Migration: Add subjects, Bloom's taxonomy, and new question types

-- Create subjects table
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, name)
);

-- Add bloom_level and subject_id to questions
ALTER TABLE questions ADD COLUMN bloom_level TEXT;
ALTER TABLE questions ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- Update question type constraint to include new types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN ('multiple_choice', 'free_text', 'file_upload', 'kprim', 'cloze', 'matching', 'essay'));

-- Create index for subject queries
CREATE INDEX idx_questions_subject_id ON questions(subject_id);
CREATE INDEX idx_subjects_teacher_id ON subjects(teacher_id);

-- RLS Policies for subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own subjects" ON subjects
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create own subjects" ON subjects
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own subjects" ON subjects
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own subjects" ON subjects
  FOR DELETE USING (teacher_id = auth.uid());
