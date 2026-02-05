import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import { authApi } from "../services/auth/authApi";
import { authSliceReducer } from "../services/auth/authSlice";
import { questionsApi } from "../services/questions/questionsApi";
import { examsApi } from "../services/exams/examsApi";
import { sessionsApi } from "../services/sessions/sessionsApi";
import { subjectsApi } from "../services/subjects/subjectsApi";
import { groupsApi } from "../services/groups/groupsApi";
import { invitationsApi } from "../services/groups/invitationsApi";
import { sharingApi } from "../services/groups/sharingApi";

export const store = configureStore({
  reducer: {
    auth: authSliceReducer,

    [authApi.reducerPath]: authApi.reducer,
    [questionsApi.reducerPath]: questionsApi.reducer,
    [examsApi.reducerPath]: examsApi.reducer,
    [sessionsApi.reducerPath]: sessionsApi.reducer,
    [subjectsApi.reducerPath]: subjectsApi.reducer,
    [groupsApi.reducerPath]: groupsApi.reducer,
    [invitationsApi.reducerPath]: invitationsApi.reducer,
    [sharingApi.reducerPath]: sharingApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(questionsApi.middleware)
      .concat(examsApi.middleware)
      .concat(sessionsApi.middleware)
      .concat(subjectsApi.middleware)
      .concat(groupsApi.middleware)
      .concat(invitationsApi.middleware)
      .concat(sharingApi.middleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
