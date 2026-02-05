import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Subject } from '../../types/database';

interface CreateSubjectRequest {
  teacher_id: string;
  name: string;
}

interface UpdateSubjectRequest {
  id: string;
  name: string;
}

export const subjectsApi = createApi({
  reducerPath: 'subjectsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Subjects'],
  endpoints: (build) => ({
    getSubjects: build.query<Subject[], string>({
      queryFn: async (teacherId) => {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('teacher_id', teacherId)
          .order('name');

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: data || [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Subjects' as const, id })),
              { type: 'Subjects', id: 'LIST' },
            ]
          : [{ type: 'Subjects', id: 'LIST' }],
    }),

    createSubject: build.mutation<Subject, CreateSubjectRequest>({
      queryFn: async (subject) => {
        const { data, error } = await supabase
          .from('subjects')
          .insert(subject)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: [{ type: 'Subjects', id: 'LIST' }],
    }),

    updateSubject: build.mutation<Subject, UpdateSubjectRequest>({
      queryFn: async ({ id, name }) => {
        const { data, error } = await supabase
          .from('subjects')
          .update({ name })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data };
      },
      invalidatesTags: (_, __, { id }) => [
        { type: 'Subjects', id },
        { type: 'Subjects', id: 'LIST' },
      ],
    }),

    deleteSubject: build.mutation<void, string>({
      queryFn: async (id) => {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', id);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Subjects', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
} = subjectsApi;
