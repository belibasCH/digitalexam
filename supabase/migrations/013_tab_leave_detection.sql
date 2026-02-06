ALTER TABLE exams ADD COLUMN lock_on_tab_leave BOOLEAN DEFAULT false;
ALTER TABLE exam_sessions ADD COLUMN is_locked BOOLEAN DEFAULT false;
ALTER TABLE exam_sessions ADD COLUMN tab_leave_count INTEGER DEFAULT 0;
