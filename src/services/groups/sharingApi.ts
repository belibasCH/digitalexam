import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Question, QuestionShare, QuestionWithSharing, Profile, TeacherGroup } from '../../types/database';

interface ShareQuestionRequest {
  questionId: string;
  groupIds: string[];
}

interface UnshareQuestionRequest {
  questionId: string;
  groupId: string;
}

interface QuestionShareWithGroup extends QuestionShare {
  group: TeacherGroup;
}

export const sharingApi = createApi({
  reducerPath: 'sharingApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['SharedQuestions', 'QuestionShares'],
  endpoints: (build) => ({
    // Get questions shared with a specific group
    getGroupQuestions: build.query<QuestionWithSharing[], string>({
      queryFn: async (groupId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        const { data, error } = await supabase
          .from('question_shares')
          .select(`
            question_id,
            shared_by,
            shared_at,
            questions (
              id,
              teacher_id,
              type,
              title,
              content,
              points,
              bloom_level,
              subject_id,
              created_at
            ),
            profiles:shared_by (
              id,
              name,
              created_at
            )
          `)
          .eq('group_id', groupId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        const questions: QuestionWithSharing[] = data?.map(share => ({
          ...(share.questions as unknown as Question),
          shared_by_profile: share.profiles as unknown as Profile,
          is_shared: true,
          is_mine: (share.questions as unknown as Question).teacher_id === user.id,
        })) || [];

        return { data: questions };
      },
      providesTags: (_, __, groupId) => [{ type: 'SharedQuestions', id: groupId }],
    }),

    // Get all questions shared with user (from all groups)
    getSharedQuestions: build.query<QuestionWithSharing[], void>({
      queryFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Get user's group IDs
        const { data: memberships, error: membershipError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('teacher_id', user.id);

        if (membershipError) {
          return { error: { status: 500, data: { message: membershipError.message } } };
        }

        const groupIds = memberships?.map(m => m.group_id) || [];
        if (groupIds.length === 0) {
          return { data: [] };
        }

        // Get shared questions from all groups
        const { data, error } = await supabase
          .from('question_shares')
          .select(`
            question_id,
            shared_by,
            shared_at,
            questions (
              id,
              teacher_id,
              type,
              title,
              content,
              points,
              bloom_level,
              subject_id,
              created_at
            ),
            profiles:shared_by (
              id,
              name,
              created_at
            )
          `)
          .in('group_id', groupIds);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        // Deduplicate by question_id (a question might be shared with multiple groups)
        const questionMap = new Map<string, QuestionWithSharing>();
        data?.forEach(share => {
          const question = share.questions as unknown as Question;
          if (!questionMap.has(question.id)) {
            questionMap.set(question.id, {
              ...question,
              shared_by_profile: share.profiles as unknown as Profile,
              is_shared: true,
              is_mine: question.teacher_id === user.id,
            });
          }
        });

        return { data: Array.from(questionMap.values()) };
      },
      providesTags: [{ type: 'SharedQuestions', id: 'ALL' }],
    }),

    // Get which groups a question is shared with
    getQuestionShares: build.query<QuestionShareWithGroup[], string>({
      queryFn: async (questionId) => {
        const { data, error } = await supabase
          .from('question_shares')
          .select(`
            question_id,
            group_id,
            shared_by,
            shared_at,
            teacher_groups (
              id,
              name,
              description,
              created_by,
              created_at
            )
          `)
          .eq('question_id', questionId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        const shares: QuestionShareWithGroup[] = data?.map(share => ({
          question_id: share.question_id,
          group_id: share.group_id,
          shared_by: share.shared_by,
          shared_at: share.shared_at,
          group: share.teacher_groups as unknown as TeacherGroup,
        })) || [];

        return { data: shares };
      },
      providesTags: (_, __, questionId) => [{ type: 'QuestionShares', id: questionId }],
    }),

    // Share a question with groups
    shareQuestion: build.mutation<QuestionShare[], ShareQuestionRequest>({
      queryFn: async ({ questionId, groupIds }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        const shares = groupIds.map(groupId => ({
          question_id: questionId,
          group_id: groupId,
          shared_by: user.id,
        }));

        const { data, error } = await supabase
          .from('question_shares')
          .upsert(shares, { onConflict: 'question_id,group_id' })
          .select();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: data as QuestionShare[] };
      },
      invalidatesTags: (_, __, { questionId, groupIds }) => [
        { type: 'QuestionShares', id: questionId },
        { type: 'SharedQuestions', id: 'ALL' },
        ...groupIds.map(id => ({ type: 'SharedQuestions' as const, id })),
      ],
    }),

    // Unshare a question from a group
    unshareQuestion: build.mutation<void, UnshareQuestionRequest>({
      queryFn: async ({ questionId, groupId }) => {
        const { error } = await supabase
          .from('question_shares')
          .delete()
          .eq('question_id', questionId)
          .eq('group_id', groupId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: (_, __, { questionId, groupId }) => [
        { type: 'QuestionShares', id: questionId },
        { type: 'SharedQuestions', id: 'ALL' },
        { type: 'SharedQuestions', id: groupId },
      ],
    }),

    // Copy a shared question to own collection
    copySharedQuestion: build.mutation<Question, string>({
      queryFn: async (questionId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Get the original question
        const { data: original, error: fetchError } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (fetchError || !original) {
          return { error: { status: 404, data: { message: 'Aufgabe nicht gefunden' } } };
        }

        // Create a copy with new owner
        const { data: copy, error: createError } = await supabase
          .from('questions')
          .insert({
            teacher_id: user.id,
            type: original.type,
            title: `${original.title} (Kopie)`,
            content: original.content,
            points: original.points,
            bloom_level: original.bloom_level,
            // Note: subject_id is NOT copied as subjects are private
          })
          .select()
          .single();

        if (createError) {
          return { error: { status: 500, data: { message: createError.message } } };
        }

        return { data: copy as Question };
      },
      // This will need to invalidate the questions list in questionsApi
      // For now, the user may need to refresh the questions list
    }),
  }),
});

export const {
  useGetGroupQuestionsQuery,
  useGetSharedQuestionsQuery,
  useGetQuestionSharesQuery,
  useShareQuestionMutation,
  useUnshareQuestionMutation,
  useCopySharedQuestionMutation,
} = sharingApi;
