import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../common/supabase';
import { Profile } from '../../types/database';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  user: Profile | null;
}

async function getOrCreateProfile(userId: string, fallbackName: string): Promise<Profile | null> {
  // Try to get existing profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    return profile;
  }

  // Profile doesn't exist, create one
  const { data: newProfile } = await supabase
    .from('profiles')
    .insert({ id: userId, name: fallbackName })
    .select()
    .single();

  return newProfile;
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Auth'],
  endpoints: (build) => ({
    login: build.mutation<AuthResponse, LoginRequest>({
      queryFn: async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { error: { status: 401, data: { message: error.message } } };
        }

        if (data.user) {
          const profile = await getOrCreateProfile(
            data.user.id,
            data.user.user_metadata?.name || data.user.email || 'User'
          );
          return { data: { user: profile } };
        }

        return { data: { user: null } };
      },
      invalidatesTags: ['Auth'],
    }),

    register: build.mutation<AuthResponse, RegisterRequest>({
      queryFn: async ({ email, password, name }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }, // Pass name in metadata for the trigger
          },
        });

        if (error) {
          return { error: { status: 400, data: { message: error.message } } };
        }

        if (data.user) {
          // The trigger should create the profile, but let's ensure it exists
          const profile = await getOrCreateProfile(data.user.id, name);
          return { data: { user: profile } };
        }

        return { data: { user: null } };
      },
      invalidatesTags: ['Auth'],
    }),

    logout: build.mutation<void, void>({
      queryFn: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          return { error: { status: 500, data: { message: error.message } } };
        }
        return { data: undefined };
      },
      invalidatesTags: ['Auth'],
    }),

    getSession: build.query<AuthResponse, void>({
      queryFn: async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await getOrCreateProfile(
            session.user.id,
            session.user.user_metadata?.name || session.user.email || 'User'
          );
          return { data: { user: profile } };
        }

        return { data: { user: null } };
      },
      providesTags: ['Auth'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetSessionQuery,
  useLazyGetSessionQuery,
} = authApi;
