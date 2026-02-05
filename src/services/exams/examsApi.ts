import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Exam, ExamQuestion, ExamWithQuestions, ExamSection, ExamSectionWithQuestions, Question } from '../../types/database';

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

interface CreateSectionRequest {
  exam_id: string;
  title: string;
  description?: string;
  order_index: number;
}

interface UpdateSectionRequest {
  id: string;
  data: Partial<ExamSection>;
}

interface AssignQuestionsToSectionRequest {
  exam_id: string;
  section_id: string;
  question_ids: string[];
}

interface SaveSectionsWithQuestionsRequest {
  exam_id: string;
  sections: {
    id?: string;
    title: string;
    description?: string;
    order_index: number;
    question_ids: string[];
  }[];
}

export const examsApi = createApi({
  reducerPath: 'examsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Exams', 'ExamQuestions', 'ExamSections'],
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

        // Fetch sections
        const { data: sections, error: sectionsError } = await supabase
          .from('exam_sections')
          .select('*')
          .eq('exam_id', id)
          .order('order_index');

        if (sectionsError) {
          return { error: { status: 500, data: { message: sectionsError.message } } };
        }

        const { data: examQuestions, error: eqError } = await supabase
          .from('exam_questions')
          .select('question_id, order_index, section_id')
          .eq('exam_id', id)
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
        }).filter(q => q.id) as (Question & { order_index: number; section_id?: string })[];

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
      providesTags: (_, __, id) => [
        { type: 'Exams', id },
        { type: 'ExamQuestions', id },
        { type: 'ExamSections', id },
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

    // Section endpoints
    createSection: build.mutation<ExamSection, CreateSectionRequest>({
      queryFn: async (section) => {
        const { data, error } = await supabase
          .from('exam_sections')
          .insert(section)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, { exam_id }) => [
        { type: 'ExamSections', id: exam_id },
        { type: 'Exams', id: exam_id },
      ],
    }),

    updateSection: build.mutation<ExamSection, UpdateSectionRequest>({
      queryFn: async ({ id, data }) => {
        const { data: updated, error } = await supabase
          .from('exam_sections')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: updated };
      },
      invalidatesTags: (result) => result ? [
        { type: 'ExamSections', id: result.exam_id },
        { type: 'Exams', id: result.exam_id },
      ] : [],
    }),

    deleteSection: build.mutation<void, { id: string; exam_id: string }>({
      queryFn: async ({ id }) => {
        const { error } = await supabase
          .from('exam_sections')
          .delete()
          .eq('id', id);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: undefined };
      },
      invalidatesTags: (_, __, { exam_id }) => [
        { type: 'ExamSections', id: exam_id },
        { type: 'Exams', id: exam_id },
        { type: 'ExamQuestions', id: exam_id },
      ],
    }),

    saveSectionsWithQuestions: build.mutation<void, SaveSectionsWithQuestionsRequest>({
      queryFn: async ({ exam_id, sections }) => {
        // Delete existing sections (cascade will delete exam_questions with section_id)
        const { error: deleteError } = await supabase
          .from('exam_sections')
          .delete()
          .eq('exam_id', exam_id);

        if (deleteError) {
          return { error: { status: 500, data: { message: deleteError.message } } };
        }

        // Delete all exam_questions for this exam
        const { error: deleteQError } = await supabase
          .from('exam_questions')
          .delete()
          .eq('exam_id', exam_id);

        if (deleteQError) {
          return { error: { status: 500, data: { message: deleteQError.message } } };
        }

        // Create sections and their questions
        for (const section of sections) {
          const { data: newSection, error: sectionError } = await supabase
            .from('exam_sections')
            .insert({
              exam_id,
              title: section.title,
              description: section.description,
              order_index: section.order_index,
            })
            .select()
            .single();

          if (sectionError) {
            return { error: { status: 500, data: { message: sectionError.message } } };
          }

          // Insert questions for this section
          if (section.question_ids.length > 0) {
            const examQuestions: ExamQuestion[] = section.question_ids.map((question_id, index) => ({
              exam_id,
              question_id,
              section_id: newSection.id,
              order_index: index,
            }));

            const { error: insertError } = await supabase
              .from('exam_questions')
              .insert(examQuestions);

            if (insertError) {
              return { error: { status: 500, data: { message: insertError.message } } };
            }
          }
        }

        return { data: undefined };
      },
      invalidatesTags: (_, __, { exam_id }) => [
        { type: 'ExamSections', id: exam_id },
        { type: 'ExamQuestions', id: exam_id },
        { type: 'Exams', id: exam_id },
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
  useCreateSectionMutation,
  useUpdateSectionMutation,
  useDeleteSectionMutation,
  useSaveSectionsWithQuestionsMutation,
} = examsApi;
