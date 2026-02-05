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
import { JoinExamPage } from './pages/take/JoinExamPage';
import { TakeExamPage } from './pages/take/TakeExamPage';
import { ExamCompletePage } from './pages/take/ExamCompletePage';

import { useLazyGetSessionQuery } from './services/auth/authApi';
import { useAppDispatch } from './app/hooks';
import { authActions, useAuthInitialized } from './services/auth/authSlice';
import { supabase } from './services/common/supabase';

const App = () => {
  const dispatch = useAppDispatch();
  const initialized = useAuthInitialized();
  const [getSession] = useLazyGetSessionQuery();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const result = await getSession().unwrap();
        dispatch(authActions.setUser(result.user || undefined));
      } catch {
        dispatch(authActions.setUser(undefined));
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const result = await getSession().unwrap();
        dispatch(authActions.setUser(result.user || undefined));
      } else if (event === 'SIGNED_OUT') {
        dispatch(authActions.setUser(undefined));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch, getSession]);

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
        </Route>
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
