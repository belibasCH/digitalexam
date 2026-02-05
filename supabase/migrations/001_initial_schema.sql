-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'free_text')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  time_limit_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exam Questions junction table
CREATE TABLE exam_questions (
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (exam_id, question_id)
);

-- Exam Sessions table (student participation)
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (exam_id, student_email)
);

-- Answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  points_awarded INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Questions policies
CREATE POLICY "Teachers can view own questions" ON questions
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own questions" ON questions
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own questions" ON questions
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own questions" ON questions
  FOR DELETE USING (teacher_id = auth.uid());

-- Students can view questions for active exams (for taking exams)
CREATE POLICY "Students can view questions in active exams" ON questions
  FOR SELECT USING (
    id IN (
      SELECT eq.question_id FROM exam_questions eq
      JOIN exams e ON eq.exam_id = e.id
      WHERE e.status = 'active'
    )
  );

-- Exams policies
CREATE POLICY "Teachers can view own exams" ON exams
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own exams" ON exams
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own exams" ON exams
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own exams" ON exams
  FOR DELETE USING (teacher_id = auth.uid());

-- Students can view active exams (public access for joining)
CREATE POLICY "Anyone can view active exams" ON exams
  FOR SELECT USING (status = 'active');

-- Exam questions policies
CREATE POLICY "Teachers can manage exam questions" ON exam_questions
  FOR ALL USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students can view exam questions for active exams" ON exam_questions
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE status = 'active')
  );

-- Exam sessions policies
CREATE POLICY "Teachers can view sessions for own exams" ON exam_sessions
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

-- Anyone can create a session for active exams (joining)
CREATE POLICY "Anyone can join active exams" ON exam_sessions
  FOR INSERT WITH CHECK (
    exam_id IN (SELECT id FROM exams WHERE status = 'active')
  );

-- Students can view and update own sessions (using email from RLS context or public)
CREATE POLICY "Anyone can view exam sessions" ON exam_sessions
  FOR SELECT USING (true);

CREATE POLICY "Sessions can be updated by anyone" ON exam_sessions
  FOR UPDATE USING (true);

-- Answers policies
CREATE POLICY "Teachers can view answers for own exams" ON answers
  FOR SELECT USING (
    session_id IN (
      SELECT es.id FROM exam_sessions es
      JOIN exams e ON es.exam_id = e.id
      WHERE e.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update answers for grading" ON answers
  FOR UPDATE USING (
    session_id IN (
      SELECT es.id FROM exam_sessions es
      JOIN exams e ON es.exam_id = e.id
      WHERE e.teacher_id = auth.uid()
    )
  );

-- Students can insert and update their own answers (public access for exam taking)
CREATE POLICY "Anyone can insert answers" ON answers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view answers" ON answers
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update answers" ON answers
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM exam_sessions WHERE submitted_at IS NULL
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_questions_teacher_id ON questions(teacher_id);
CREATE INDEX idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX idx_exam_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX idx_answers_session_id ON answers(session_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE exam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;
