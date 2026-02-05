-- Add file_upload to question types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN ('multiple_choice', 'free_text', 'file_upload'));

-- Create storage bucket for exam file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-uploads', 'exam-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for exam uploads

-- Anyone can upload files (students taking exams)
CREATE POLICY "Anyone can upload exam files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exam-uploads');

-- Anyone can view files (for download)
CREATE POLICY "Anyone can view exam files"
ON storage.objects FOR SELECT
USING (bucket_id = 'exam-uploads');

-- Teachers can delete files
CREATE POLICY "Teachers can delete exam files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exam-uploads'
  AND auth.role() = 'authenticated'
);
