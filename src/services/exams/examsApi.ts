import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Exam, ExamQuestion, ExamWithQuestions, Question } from '../../types/database';

interface CreateExamRequest {
  teacher_id: string;
  title: string;
  description?: string;
  time_limit_minutes?: number;
}

interface UpdateExamRequest {
  id: string;
  data: Partial<Exam>;
}

interface AssignQuestionsRequest {
  exam_id: string;
  question_ids: string[];
}

export const examsApi = createApi({
  reducerPath: 'examsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Exams', 'ExamQuestions'],
  endpoints: (build) => ({
    getExams: build.query<Exam[], string>({
      queryFn: async (teacherId) => {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false });

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: data || [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Exams' as const, id })),
              { type: 'Exams', id: 'LIST' },
            ]
          : [{ type: 'Exams', id: 'LIST' }],
    }),

    getExam: build.query<Exam, string>({
      queryFn: async (id) => {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      providesTags: (_, __, id) => [{ type: 'Exams', id }],
    }),

    getExamWithQuestions: build.query<ExamWithQuestions, string>({
      queryFn: async (id) => {
        const { data: exam, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', id)
          .single();

        if (examError) {
          return { error: { status: 500, data: { message: examError.message } } };
        }

        const { data: examQuestions, error: eqError } = await supabase
          .from('exam_questions')
          .select('question_id, order_index')
          .eq('exam_id', id)
          .order('order_index');

        if (eqError) {
          return { error: { status: 500, data: { message: eqError.message } } };
        }

        if (!examQuestions || examQuestions.length === 0) {
          return { data: { ...exam, questions: [] } };
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
          };
        }).filter(q => q.id) as (Question & { order_index: number })[];

        return { data: { ...exam, questions: questionsWithOrder } };
      },
      providesTags: (_, __, id) => [
        { type: 'Exams', id },
        { type: 'ExamQuestions', id },
      ],
    }),

    createExam: build.mutation<Exam, CreateExamRequest>({
      queryFn: async (exam) => {
        const { data, error } = await supabase
          .from('exams')
          .insert(exam)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: [{ type: 'Exams', id: 'LIST' }],
    }),

    updateExam: build.mutation<Exam, UpdateExamRequest>({
      queryFn: async ({ id, data }) => {
        const { data: updated, error } = await supabase
          .from('exams')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [
        { type: 'Exams', id },
        { type: 'Exams', id: 'LIST' },
      ],
    }),

    deleteExam: build.mutation<void, string>({
      queryFn: async (id) => {
        const { error } = await supabase
          .from('exams')
          .delete()
          .eq('id', id);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Exams', id: 'LIST' }],
    }),

    assignQuestions: build.mutation<void, AssignQuestionsRequest>({
      queryFn: async ({ exam_id, question_ids }) => {
        // First delete existing assignments
        const { error: deleteError } = await supabase
          .from('exam_questions')
          .delete()
          .eq('exam_id', exam_id);

        if (deleteError) {
          return { error: { status: 500, data: { message: deleteError.message } } };
        }

        // Then insert new assignments
        if (question_ids.length > 0) {
          const assignments: ExamQuestion[] = question_ids.map((question_id, index) => ({
            exam_id,
            question_id,
            order_index: index,
          }));

          const { error: insertError } = await supabase
            .from('exam_questions')
            .insert(assignments);

          if (insertError) {
            return { error: { status: 500, data: { message: insertError.message } } };
          }
        }

        return { data: undefined };
      },
      invalidatesTags: (_, __, { exam_id }) => [
        { type: 'ExamQuestions', id: exam_id },
      ],
    }),

    activateExam: build.mutation<Exam, string>({
      queryFn: async (id) => {
        const { data, error } = await supabase
          .from('exams')
          .update({ status: 'active' })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, id) => [
        { type: 'Exams', id },
        { type: 'Exams', id: 'LIST' },
      ],
    }),

    closeExam: build.mutation<Exam, string>({
      queryFn: async (id) => {
        const { data, error } = await supabase
          .from('exams')
          .update({ status: 'closed' })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, id) => [
        { type: 'Exams', id },
        { type: 'Exams', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetExamsQuery,
  useGetExamQuery,
  useGetExamWithQuestionsQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
  useAssignQuestionsMutation,
  useActivateExamMutation,
  useCloseExamMutation,
} = examsApi;
