-- Migration: Add exam sections
-- A section is a page in the exam containing questions

-- Create exam_sections table
CREATE TABLE exam_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add section_id to exam_questions (nullable for backward compatibility)
ALTER TABLE exam_questions ADD COLUMN section_id UUID REFERENCES exam_sections(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_exam_sections_exam_id ON exam_sections(exam_id);
CREATE INDEX idx_exam_questions_section_id ON exam_questions(section_id);

-- RLS Policies for exam_sections
ALTER TABLE exam_sections ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own exam sections
CREATE POLICY "Teachers can view own exam sections" ON exam_sections
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can create sections for own exams" ON exam_sections
  FOR INSERT WITH CHECK (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can update own exam sections" ON exam_sections
  FOR UPDATE USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can delete own exam sections" ON exam_sections
  FOR DELETE USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

-- Students can view sections of exams they're taking
CREATE POLICY "Students can view sections of active exams" ON exam_sections
  FOR SELECT USING (
    exam_id IN (
      SELECT exam_id FROM exam_sessions
      WHERE student_email = current_setting('request.jwt.claims', true)::json->>'email'
    )
    OR
    exam_id IN (SELECT id FROM exams WHERE status = 'active')
  );
