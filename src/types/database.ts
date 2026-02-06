export interface Profile {
  id: string;
  name: string;
  created_at: string;
}

// Bloom's Taxonomy levels with K-values (K1-K6)
export type BloomLevel =
  | 'K1'  // Wissen / Erinnern
  | 'K2'  // Verstehen
  | 'K3'  // Anwenden
  | 'K4'  // Analysieren
  | 'K5'  // Bewerten / Beurteilen
  | 'K6'; // Erschaffen / Kreieren

export const BLOOM_LEVELS: { value: BloomLevel; label: string; description: string }[] = [
  { value: 'K1', label: 'K1 - Wissen', description: 'Fakten und Konzepte abrufen, wiedergeben' },
  { value: 'K2', label: 'K2 - Verstehen', description: 'Bedeutung erklären, interpretieren, zusammenfassen' },
  { value: 'K3', label: 'K3 - Anwenden', description: 'Wissen in neuen Situationen nutzen, durchführen' },
  { value: 'K4', label: 'K4 - Analysieren', description: 'Verbindungen erkennen, unterscheiden, strukturieren' },
  { value: 'K5', label: 'K5 - Beurteilen', description: 'Urteile fällen, bewerten, kritisieren' },
  { value: 'K6', label: 'K6 - Erschaffen', description: 'Neue Ideen entwickeln, entwerfen, konstruieren' },
];

export interface Subject {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'free_text'
  | 'file_upload'
  | 'kprim'
  | 'cloze'
  | 'matching'
  | 'essay';

export interface Question {
  id: string;
  teacher_id: string;
  type: QuestionType;
  title: string;
  content: QuestionContent;
  points: number;
  bloom_level?: BloomLevel;
  subject_id?: string;
  created_at: string;
}

export type QuestionContent =
  | MultipleChoiceContent
  | FreeTextContent
  | FileUploadContent
  | KPrimContent
  | ClozeContent
  | MatchingContent
  | EssayContent;

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
  expected_length?: 'word' | 'short' | 'medium' | 'long';
  sample_answer?: string;
}

export interface FileUploadContent {
  question: string;
  allowed_types?: string[]; // e.g., ['pdf', 'docx', 'jpg', 'png']
  max_file_size_mb?: number;
  max_files?: number;
}

// K-Prim: 4 statements, each can be true or false
export interface KPrimContent {
  question: string;
  statements: KPrimStatement[];
}

export interface KPrimStatement {
  id: string;
  text: string;
  is_true: boolean;
}

// Cloze/Fill-in-the-blanks
export interface ClozeContent {
  question: string;
  text: string; // Text with {{blank_id}} placeholders
  blanks: ClozeBlank[];
}

export interface ClozeBlank {
  id: string;
  correct_answers: string[]; // Multiple acceptable answers
  case_sensitive?: boolean;
}

// Matching/Zuordnung
export interface MatchingContent {
  question: string;
  pairs: MatchingPair[];
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

// Essay/Aufsatz (longer form writing)
export interface EssayContent {
  question: string;
  min_words?: number;
  max_words?: number;
  rubric?: string; // Grading criteria for the teacher
}

export interface Exam {
  id: string;
  teacher_id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'closed';
  time_limit_minutes?: number;
  lock_on_tab_leave?: boolean;
  created_at: string;
}

export interface ExamSection {
  id: string;
  exam_id: string;
  title: string;
  description?: string;
  order_index: number;
  created_at: string;
}

export interface ExamQuestion {
  exam_id: string;
  question_id: string;
  section_id?: string;
  order_index: number;
}

export interface ExamSession {
  id: string;
  exam_id: string;
  student_name: string;
  student_email: string;
  started_at: string;
  submitted_at?: string;
  is_locked?: boolean;
  tab_leave_count?: number;
}

export type AnswerContent =
  | MultipleChoiceAnswer
  | FreeTextAnswer
  | FileUploadAnswer
  | KPrimAnswer
  | ClozeAnswer
  | MatchingAnswer
  | EssayAnswer;

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  content: AnswerContent;
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

export interface KPrimAnswer {
  answers: { statement_id: string; selected: boolean }[];
}

export interface ClozeAnswer {
  answers: { blank_id: string; text: string }[];
}

export interface MatchingAnswer {
  matches: { left_id: string; right_id: string }[];
}

export interface EssayAnswer {
  text: string;
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
  sections?: ExamSectionWithQuestions[];
}

export interface QuestionWithOrder extends Question {
  order_index: number;
  section_id?: string;
}

export interface ExamSectionWithQuestions extends ExamSection {
  questions: QuestionWithOrder[];
}

export interface ExamSessionWithAnswers extends ExamSession {
  answers: Answer[];
}

// =====================================================
// Teacher Groups & Collaboration Types
// =====================================================

export type GroupRole = 'owner' | 'admin' | 'member';

export interface TeacherGroup {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  teacher_id: string;
  role: GroupRole;
  joined_at: string;
}

export interface GroupMemberWithProfile extends GroupMember {
  profile: Profile;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  invited_email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface GroupInvitationWithGroup extends GroupInvitation {
  group: TeacherGroup;
}

export interface QuestionShare {
  question_id: string;
  group_id: string;
  shared_by: string;
  shared_at: string;
}

export interface TeacherGroupWithStats extends TeacherGroup {
  member_count: number;
  my_role: GroupRole;
}

export interface QuestionWithSharing extends Question {
  shared_by_profile?: Profile;
  is_shared?: boolean;
  is_mine?: boolean;
}
