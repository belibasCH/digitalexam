import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';

import { ProtectedRoutes } from './components/auth/ProtectedRoutes';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { QuestionsListPage } from './pages/questions/QuestionsListPage';
import { QuestionEditorPage } from './pages/questions/QuestionEditorPage';
import { ExamsListPage } from './pages/exams/ExamsListPage';
import { ExamEditorPage } from './pages/exams/ExamEditorPage';
import { ExamDetailPage } from './pages/exams/ExamDetailPage';
import { ExamMonitorPage } from './pages/exams/ExamMonitorPage';
import { EvaluatePage } from './pages/evaluate/EvaluatePage';
import { SubjectsPage } from './pages/subjects/SubjectsPage';
import { GroupsListPage } from './pages/groups/GroupsListPage';
import { GroupDetailPage } from './pages/groups/GroupDetailPage';
import { JoinExamPage } from './pages/take/JoinExamPage';
import { TakeExamPage } from './pages/take/TakeExamPage';
import { ExamCompletePage } from './pages/take/ExamCompletePage';

import { useAppDispatch } from './app/hooks';
import { authActions, useAuthInitialized } from './services/auth/authSlice';
import { supabase } from './services/common/supabase';
import { Profile } from './types/database';

// Helper function to get or create profile
async function getOrCreateProfile(userId: string, fallbackName: string): Promise<Profile> {
  const fallbackProfile = { id: userId, name: fallbackName, created_at: new Date().toISOString() };

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return fallbackProfile;
    }

    if (profile) {
      return profile;
    }

    // Try to create profile
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name: fallbackName })
      .select()
      .single();

    if (insertError) {
      return fallbackProfile;
    }

    return newProfile || fallbackProfile;
  } catch {
    return fallbackProfile;
  }
}

const App = () => {
  const dispatch = useAppDispatch();
  const initialized = useAuthInitialized();

  useEffect(() => {
    let isInitialized = false;

    // Fallback: manually check session after 2 seconds if onAuthStateChange hasn't fired
    const fallbackTimeout = setTimeout(async () => {
      if (!isInitialized) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const profile = await getOrCreateProfile(
              session.user.id,
              session.user.user_metadata?.name || session.user.email || 'User'
            );
            dispatch(authActions.setUser(profile));
          } else {
            dispatch(authActions.setUser(undefined));
          }
        } catch {
          dispatch(authActions.setUser(undefined));
        }
        isInitialized = true;
      }
    }, 2000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Cancel fallback if auth state change fires
      if (!isInitialized) {
        clearTimeout(fallbackTimeout);
        isInitialized = true;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          // Use session data immediately for fast load
          const quickProfile: Profile = {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            created_at: session.user.created_at,
          };
          dispatch(authActions.setUser(quickProfile));

          // Fetch real profile in background (non-blocking)
          getOrCreateProfile(session.user.id, quickProfile.name).then(profile => {
            dispatch(authActions.setUser(profile));
          });
        } else {
          dispatch(authActions.setUser(undefined));
        }
      } else if (event === 'SIGNED_OUT') {
        dispatch(authActions.setUser(undefined));
      }
    });

    return () => {
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, [dispatch]);

  if (!initialized) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Student exam routes (public) */}
      <Route path="/take/:examId" element={<JoinExamPage />} />
      <Route path="/take/:examId/exam" element={<TakeExamPage />} />
      <Route path="/take/:examId/complete" element={<ExamCompletePage />} />

      {/* Protected teacher routes */}
      <Route element={<ProtectedRoutes />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />


          {/* Questions */}
          <Route path="/questions" element={<QuestionsListPage />} />
          <Route path="/questions/new" element={<QuestionEditorPage />} />
          <Route path="/questions/:id/edit" element={<QuestionEditorPage />} />

          {/* Exams */}
          <Route path="/exams" element={<ExamsListPage />} />
          <Route path="/exams/new" element={<ExamEditorPage />} />
          <Route path="/exams/:id" element={<ExamDetailPage />} />
          <Route path="/exams/:id/edit" element={<ExamEditorPage />} />
          <Route path="/exams/:id/monitor" element={<ExamMonitorPage />} />
          <Route path="/exams/:id/evaluate" element={<EvaluatePage />} />


          {/* Subjects */}
          <Route path="/subjects" element={<SubjectsPage />} />

          {/* Groups */}
          <Route path="/groups" element={<GroupsListPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Route>
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
