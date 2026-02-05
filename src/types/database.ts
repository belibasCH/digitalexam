export interface Profile {
  id: string;
  name: string;
  created_at: string;
}

export interface Question {
  id: string;
  teacher_id: string;
  type: 'multiple_choice' | 'free_text' | 'file_upload';
  title: string;
  content: MultipleChoiceContent | FreeTextContent | FileUploadContent;
  points: number;
  created_at: string;
}

export interface MultipleChoiceContent {
  question: string;
  options: MultipleChoiceOption[];
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface FreeTextContent {
  question: string;
  expected_length?: 'short' | 'medium' | 'long';
  sample_answer?: string;
}

export interface FileUploadContent {
  question: string;
  allowed_types?: string[]; // e.g., ['pdf', 'docx', 'jpg', 'png']
  max_file_size_mb?: number;
  max_files?: number;
}

export interface Exam {
  id: string;
  teacher_id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'closed';
  time_limit_minutes?: number;
  created_at: string;
}

export interface ExamQuestion {
  exam_id: string;
  question_id: string;
  order_index: number;
}

export interface ExamSession {
  id: string;
  exam_id: string;
  student_name: string;
  student_email: string;
  started_at: string;
  submitted_at?: string;
}

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  content: MultipleChoiceAnswer | FreeTextAnswer | FileUploadAnswer;
  points_awarded?: number;
  updated_at: string;
}

export interface MultipleChoiceAnswer {
  selected_option_id: string;
}

export interface FreeTextAnswer {
  text: string;
}

export interface FileUploadAnswer {
  files: UploadedFile[];
}

export interface UploadedFile {
  name: string;
  path: string; // Storage path in Supabase
  size: number;
  type: string;
  uploaded_at: string;
}

export interface ExamWithQuestions extends Exam {
  questions: QuestionWithOrder[];
}

export interface QuestionWithOrder extends Question {
  order_index: number;
}

export interface ExamSessionWithAnswers extends ExamSession {
  answers: Answer[];
}
