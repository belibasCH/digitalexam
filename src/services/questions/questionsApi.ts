import { createApi } from '@reduxjs/toolkit/query/react';
import { supabaseBaseQuery } from '../common/apiHelpers';
import { Question } from '../../types/database';

export const questionsApi = createApi({
  reducerPath: 'questionsApi',
  baseQuery: supabaseBaseQuery(),
  tagTypes: ['Questions'],
  endpoints: (build) => ({
    getQuestions: build.query<Question[], string>({
      query: (teacherId) => ({
        table: 'questions',
        method: 'select',
        eq: { teacher_id: teacherId },
        order: { column: 'created_at', ascending: false },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Questions' as const, id })),
              { type: 'Questions', id: 'LIST' },
            ]
          : [{ type: 'Questions', id: 'LIST' }],
    }),

    getQuestion: build.query<Question, string>({
      query: (id) => ({
        table: 'questions',
        method: 'select',
        eq: { id },
        single: true,
      }),
      providesTags: (_, __, id) => [{ type: 'Questions', id }],
    }),

    createQuestion: build.mutation<Question, Omit<Question, 'id' | 'created_at'>>({
      query: (question) => ({
        table: 'questions',
        method: 'insert',
        body: question,
        single: true,
      }),
      invalidatesTags: [{ type: 'Questions', id: 'LIST' }],
    }),

    updateQuestion: build.mutation<Question, { id: string; data: Partial<Question> }>({
      query: ({ id, data }) => ({
        table: 'questions',
        method: 'update',
        body: data,
        match: { id },
        single: true,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Questions', id },
        { type: 'Questions', id: 'LIST' },
      ],
    }),

    deleteQuestion: build.mutation<void, string>({
      query: (id) => ({
        table: 'questions',
        method: 'delete',
        match: { id },
      }),
      invalidatesTags: [{ type: 'Questions', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetQuestionsQuery,
  useGetQuestionQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
} = questionsApi;
