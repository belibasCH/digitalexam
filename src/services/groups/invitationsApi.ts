import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { GroupInvitation, GroupInvitationWithGroup, TeacherGroup } from '../../types/database';

interface SendInvitationRequest {
  groupId: string;
  email: string;
}

export const invitationsApi = createApi({
  reducerPath: 'invitationsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['MyInvitations', 'GroupInvitations', 'Groups'],
  endpoints: (build) => ({
    // Get pending invitations for the current user
    getMyInvitations: build.query<GroupInvitationWithGroup[], void>({
      queryFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        const { data, error } = await supabase
          .from('group_invitations')
          .select(`
            *,
            teacher_groups (
              id,
              name,
              description,
              created_by,
              created_at
            )
          `)
          .eq('invited_email', user.email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        const invitations: GroupInvitationWithGroup[] = data?.map(inv => ({
          id: inv.id,
          group_id: inv.group_id,
          invited_email: inv.invited_email,
          invited_by: inv.invited_by,
          status: inv.status as 'pending' | 'accepted' | 'declined',
          created_at: inv.created_at,
          group: inv.teacher_groups as unknown as TeacherGroup,
        })) || [];

        return { data: invitations };
      },
      providesTags: ['MyInvitations'],
    }),

    // Get invitations for a specific group (for admins)
    getGroupInvitations: build.query<GroupInvitation[], string>({
      queryFn: async (groupId) => {
        const { data, error } = await supabase
          .from('group_invitations')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: data as GroupInvitation[] };
      },
      providesTags: (_, __, groupId) => [{ type: 'GroupInvitations', id: groupId }],
    }),

    // Send an invitation
    sendInvitation: build.mutation<GroupInvitation, SendInvitationRequest>({
      queryFn: async ({ groupId, email }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Check if already invited (pending)
        const { data: existing } = await supabase
          .from('group_invitations')
          .select('id')
          .eq('group_id', groupId)
          .eq('invited_email', email.toLowerCase())
          .eq('status', 'pending')
          .single();

        if (existing) {
          return { error: { status: 400, data: { message: 'Bereits eingeladen' } } };
        }

        // Note: We cannot check if the user is already a member from client-side
        // as we don't have access to look up users by email without admin privileges.
        // The RLS policies and unique constraint will handle duplicate cases.

        const { data, error } = await supabase
          .from('group_invitations')
          .insert({
            group_id: groupId,
            invited_email: email.toLowerCase(),
            invited_by: user.id,
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: data as GroupInvitation };
      },
      invalidatesTags: (_, __, { groupId }) => [
        { type: 'GroupInvitations', id: groupId },
      ],
    }),

    // Accept an invitation
    acceptInvitation: build.mutation<void, string>({
      queryFn: async (invitationId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Get the invitation
        const { data: invitation, error: invError } = await supabase
          .from('group_invitations')
          .select('*')
          .eq('id', invitationId)
          .eq('status', 'pending')
          .single();

        if (invError || !invitation) {
          return { error: { status: 404, data: { message: 'Einladung nicht gefunden' } } };
        }

        // Update invitation status
        const { error: updateError } = await supabase
          .from('group_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitationId);

        if (updateError) {
          return { error: { status: 500, data: { message: updateError.message } } };
        }

        // Add user as member
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({
            group_id: invitation.group_id,
            teacher_id: user.id,
            role: 'member',
          });

        if (memberError) {
          // Rollback invitation status
          await supabase
            .from('group_invitations')
            .update({ status: 'pending' })
            .eq('id', invitationId);
          return { error: { status: 500, data: { message: memberError.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: ['MyInvitations', { type: 'Groups', id: 'LIST' }],
    }),

    // Decline an invitation
    declineInvitation: build.mutation<void, string>({
      queryFn: async (invitationId) => {
        const { error } = await supabase
          .from('group_invitations')
          .update({ status: 'declined' })
          .eq('id', invitationId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: ['MyInvitations'],
    }),

    // Cancel/delete an invitation (for admins)
    cancelInvitation: build.mutation<void, { invitationId: string; groupId: string }>({
      queryFn: async ({ invitationId }) => {
        const { error } = await supabase
          .from('group_invitations')
          .delete()
          .eq('id', invitationId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: (_, __, { groupId }) => [
        { type: 'GroupInvitations', id: groupId },
      ],
    }),
  }),
});

export const {
  useGetMyInvitationsQuery,
  useGetGroupInvitationsQuery,
  useSendInvitationMutation,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
  useCancelInvitationMutation,
} = invitationsApi;
