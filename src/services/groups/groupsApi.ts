import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import {
  TeacherGroup,
  TeacherGroupWithStats,
  GroupMember,
  GroupMemberWithProfile,
  GroupRole,
} from '../../types/database';

interface CreateGroupRequest {
  name: string;
  description?: string;
}

interface UpdateGroupRequest {
  id: string;
  name: string;
  description?: string;
}

interface UpdateMemberRoleRequest {
  groupId: string;
  teacherId: string;
  role: GroupRole;
}

interface RemoveMemberRequest {
  groupId: string;
  teacherId: string;
}

export const groupsApi = createApi({
  reducerPath: 'groupsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Groups', 'GroupMembers'],
  endpoints: (build) => ({
    // Get all groups for the current user
    getMyGroups: build.query<TeacherGroupWithStats[], void>({
      queryFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Get groups with member count and user's role
        const { data: memberships, error: membershipError } = await supabase
          .from('group_members')
          .select(`
            group_id,
            role,
            teacher_groups (
              id,
              name,
              description,
              created_by,
              created_at
            )
          `)
          .eq('teacher_id', user.id);

        if (membershipError) {
          return { error: { status: 500, data: { message: membershipError.message } } };
        }

        // Get member counts for each group
        const groupIds = memberships?.map(m => m.group_id) || [];
        const { data: memberCounts, error: countError } = await supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', groupIds);

        if (countError) {
          return { error: { status: 500, data: { message: countError.message } } };
        }

        // Count members per group
        const countMap = new Map<string, number>();
        memberCounts?.forEach(m => {
          countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
        });

        const groups: TeacherGroupWithStats[] = memberships?.map(m => ({
          ...(m.teacher_groups as unknown as TeacherGroup),
          member_count: countMap.get(m.group_id) || 1,
          my_role: m.role as GroupRole,
        })) || [];

        return { data: groups };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Groups' as const, id })),
              { type: 'Groups', id: 'LIST' },
            ]
          : [{ type: 'Groups', id: 'LIST' }],
    }),

    // Get a single group by ID
    getGroup: build.query<TeacherGroupWithStats, string>({
      queryFn: async (groupId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Get group details
        const { data: group, error: groupError } = await supabase
          .from('teacher_groups')
          .select('*')
          .eq('id', groupId)
          .single();

        if (groupError) {
          return { error: { status: 500, data: { message: groupError.message } } };
        }

        // Get user's role
        const { data: membership, error: membershipError } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('teacher_id', user.id)
          .single();

        if (membershipError) {
          return { error: { status: 500, data: { message: membershipError.message } } };
        }

        // Get member count
        const { count, error: countError } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId);

        if (countError) {
          return { error: { status: 500, data: { message: countError.message } } };
        }

        return {
          data: {
            ...group,
            member_count: count || 1,
            my_role: membership.role as GroupRole,
          },
        };
      },
      providesTags: (_, __, id) => [{ type: 'Groups', id }],
    }),

    // Get members of a group
    getGroupMembers: build.query<GroupMemberWithProfile[], string>({
      queryFn: async (groupId) => {
        const { data, error } = await supabase
          .from('group_members')
          .select(`
            group_id,
            teacher_id,
            role,
            joined_at,
            profiles (
              id,
              name,
              created_at
            )
          `)
          .eq('group_id', groupId)
          .order('joined_at');

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        const members: GroupMemberWithProfile[] = data?.map(m => ({
          group_id: m.group_id,
          teacher_id: m.teacher_id,
          role: m.role as GroupRole,
          joined_at: m.joined_at,
          profile: m.profiles as unknown as { id: string; name: string; created_at: string },
        })) || [];

        return { data: members };
      },
      providesTags: (_, __, groupId) => [{ type: 'GroupMembers', id: groupId }],
    }),

    // Create a new group
    createGroup: build.mutation<TeacherGroup, CreateGroupRequest>({
      queryFn: async ({ name, description }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        // Create the group
        const { data: group, error: groupError } = await supabase
          .from('teacher_groups')
          .insert({
            name,
            description,
            created_by: user.id,
          })
          .select()
          .single();

        if (groupError) {
          return { error: { status: 500, data: { message: groupError.message } } };
        }

        // Add creator as owner
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({
            group_id: group.id,
            teacher_id: user.id,
            role: 'owner',
          });

        if (memberError) {
          // Rollback: delete the group
          await supabase.from('teacher_groups').delete().eq('id', group.id);
          return { error: { status: 500, data: { message: memberError.message } } };
        }

        return { data: group };
      },
      invalidatesTags: [{ type: 'Groups', id: 'LIST' }],
    }),

    // Update a group
    updateGroup: build.mutation<TeacherGroup, UpdateGroupRequest>({
      queryFn: async ({ id, name, description }) => {
        const { data, error } = await supabase
          .from('teacher_groups')
          .update({ name, description })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data };
      },
      invalidatesTags: (_, __, { id }) => [
        { type: 'Groups', id },
        { type: 'Groups', id: 'LIST' },
      ],
    }),

    // Delete a group
    deleteGroup: build.mutation<void, string>({
      queryFn: async (id) => {
        const { error } = await supabase
          .from('teacher_groups')
          .delete()
          .eq('id', id);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Groups', id: 'LIST' }],
    }),

    // Leave a group
    leaveGroup: build.mutation<void, string>({
      queryFn: async (groupId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { error: { status: 401, data: { message: 'Not authenticated' } } };
        }

        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('teacher_id', user.id);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Groups', id: 'LIST' }],
    }),

    // Update a member's role
    updateMemberRole: build.mutation<GroupMember, UpdateMemberRoleRequest>({
      queryFn: async ({ groupId, teacherId, role }) => {
        const { data, error } = await supabase
          .from('group_members')
          .update({ role })
          .eq('group_id', groupId)
          .eq('teacher_id', teacherId)
          .select()
          .single();

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: data as GroupMember };
      },
      invalidatesTags: (_, __, { groupId }) => [
        { type: 'GroupMembers', id: groupId },
      ],
    }),

    // Remove a member from a group
    removeMember: build.mutation<void, RemoveMemberRequest>({
      queryFn: async ({ groupId, teacherId }) => {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('teacher_id', teacherId);

        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }

        return { data: undefined };
      },
      invalidatesTags: (_, __, { groupId }) => [
        { type: 'GroupMembers', id: groupId },
        { type: 'Groups', id: groupId },
      ],
    }),
  }),
});

export const {
  useGetMyGroupsQuery,
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} = groupsApi;
