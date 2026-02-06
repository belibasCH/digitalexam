import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Answer, ExamSession, ExamSessionWithAnswers, ExamWithQuestions, ExamSectionWithQuestions, Question } from '../../types/database';

interface JoinExamRequest {
  exam_id: string;
  student_name: string;
  student_email: string;
}

interface SaveAnswerRequest {
  session_id: string;
  question_id: string;
  content: unknown;
}

interface AwardPointsRequest {
  answer_id: string;
  points: number;
}

export const sessionsApi = createApi({
  reducerPath: 'sessionsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Sessions', 'Answers'],
  endpoints: (build) => ({
    getExamForStudent: build.query<ExamWithQuestions, string>({
      queryFn: async (examId) => {
        const { data: exam, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .eq('status', 'active')
          .single();

        if (examError) {
          return { error: { status: 404, data: { message: 'Prüfung nicht gefunden oder nicht aktiv' } } };
        }

        // Fetch sections
        const { data: sections, error: sectionsError } = await supabase
          .from('exam_sections')
          .select('*')
          .eq('exam_id', examId)
          .order('order_index');

        if (sectionsError) {
          return { error: { status: 500, data: { message: sectionsError.message } } };
        }

        const { data: examQuestions, error: eqError } = await supabase
          .from('exam_questions')
          .select('question_id, order_index, section_id')
          .eq('exam_id', examId)
          .order('order_index');

        if (eqError) {
          return { error: { status: 500, data: { message: eqError.message } } };
        }

        if (!examQuestions || examQuestions.length === 0) {
          const sectionsWithQuestions: ExamSectionWithQuestions[] = (sections || []).map(s => ({
            ...s,
            questions: [],
          }));
          return { data: { ...exam, questions: [], sections: sectionsWithQuestions } };
        }

        const questionIds = examQuestions.map(eq => eq.question_id);
        const { data: questions, error: qError } = await supabase
          .from('questions')
          .select('*')
          .in('id', questionIds);

        if (qError) {
          return { error: { status: 500, data: { message: qError.message } } };
        }

        const questionsWithOrder = examQuestions.map(eq => {
          const question = questions?.find(q => q.id === eq.question_id);
          return {
            ...question,
            order_index: eq.order_index,
            section_id: eq.section_id,
          };
        }).filter(q => q && q.id) as (Question & { order_index: number; section_id?: string })[];

        // Group questions by section
        const sectionsWithQuestions: ExamSectionWithQuestions[] = (sections || []).map(section => ({
          ...section,
          questions: questionsWithOrder
            .filter(q => q.section_id === section.id)
            .sort((a, b) => a.order_index - b.order_index),
        }));

        // Questions without a section (for backward compatibility)
        const unsectionedQuestions = questionsWithOrder.filter(q => !q.section_id);

        return {
          data: {
            ...exam,
            questions: unsectionedQuestions,
            sections: sectionsWithQuestions,
          }
        };
      },
    }),

    joinExam: build.mutation<ExamSession, JoinExamRequest>({
      queryFn: async ({ exam_id, student_name, student_email }) => {
        // Check if session already exists
        const { data: existingSession } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('exam_id', exam_id)
          .eq('student_email', student_email)
          .single();

        if (existingSession) {
          return { data: existingSession };
        }

        // Create new session
        const { data, error } = await supabase
          .from('exam_sessions')
          .insert({
            exam_id,
            student_name,
            student_email,
          })
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: [{ type: 'Sessions', id: 'LIST' }],
    }),

    getSession: build.query<ExamSession, string>({
      queryFn: async (sessionId) => {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      providesTags: (_, __, id) => [{ type: 'Sessions', id }],
    }),

    getSessionWithAnswers: build.query<ExamSessionWithAnswers, string>({
      queryFn: async (sessionId) => {
        const { data: session, error: sessionError } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError) {
          return { error: { status: 500, data: { message: sessionError.message } } };
        }

        const { data: answers, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('session_id', sessionId);

        if (answersError) {
          return { error: { status: 500, data: { message: answersError.message } } };
        }

        return { data: { ...session, answers: answers || [] } };
      },
      providesTags: (_, __, id) => [
        { type: 'Sessions', id },
        { type: 'Answers', id },
      ],
    }),

    getExamSessions: build.query<ExamSession[], string>({
      queryFn: async (examId) => {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('exam_id', examId)
          .order('started_at', { ascending: false });

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: data || [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Sessions' as const, id })),
              { type: 'Sessions', id: 'LIST' },
            ]
          : [{ type: 'Sessions', id: 'LIST' }],
    }),

    saveAnswer: build.mutation<Answer, SaveAnswerRequest>({
      queryFn: async ({ session_id, question_id, content }) => {
        const { data, error } = await supabase
          .from('answers')
          .upsert(
            {
              session_id,
              question_id,
              content,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'session_id,question_id' }
          )
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, { session_id }) => [
        { type: 'Answers', id: session_id },
      ],
    }),

    submitExam: build.mutation<ExamSession, string>({
      queryFn: async (sessionId) => {
        const { data, error } = await supabase
          .from('exam_sessions')
          .update({ submitted_at: new Date().toISOString() })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, id) => [
        { type: 'Sessions', id },
        { type: 'Sessions', id: 'LIST' },
      ],
    }),

    awardPoints: build.mutation<Answer, AwardPointsRequest>({
      queryFn: async ({ answer_id, points }) => {
        const { data, error } = await supabase
          .from('answers')
          .update({ points_awarded: points })
          .eq('id', answer_id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: ['Answers'],
    }),

    getAnswersForSession: build.query<Answer[], string>({
      queryFn: async (sessionId) => {
        const { data, error } = await supabase
          .from('answers')
          .select('*')
          .eq('session_id', sessionId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: data || [] };
      },
      providesTags: (_, __, sessionId) => [{ type: 'Answers', id: sessionId }],
    }),

    lockSession: build.mutation<ExamSession, string>({
      queryFn: async (sessionId) => {
        // Increment tab_leave_count and set is_locked
        const { data: current } = await supabase
          .from('exam_sessions')
          .select('tab_leave_count')
          .eq('id', sessionId)
          .single();

        const newCount = (current?.tab_leave_count || 0) + 1;

        const { data, error } = await supabase
          .from('exam_sessions')
          .update({ is_locked: true, tab_leave_count: newCount })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, id) => [
        { type: 'Sessions', id },
        { type: 'Sessions', id: 'LIST' },
      ],
    }),

    unlockSession: build.mutation<ExamSession, string>({
      queryFn: async (sessionId) => {
        const { data, error } = await supabase
          .from('exam_sessions')
          .update({ is_locked: false })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, id) => [
        { type: 'Sessions', id },
        { type: 'Sessions', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetExamForStudentQuery,
  useJoinExamMutation,
  useGetSessionQuery,
  useGetSessionWithAnswersQuery,
  useGetExamSessionsQuery,
  useSaveAnswerMutation,
  useSubmitExamMutation,
  useAwardPointsMutation,
  useGetAnswersForSessionQuery,
  useLockSessionMutation,
  useUnlockSessionMutation,
} = sessionsApi;
