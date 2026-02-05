import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import { authApi } from "../services/auth/authApi";
import { authSliceReducer } from "../services/auth/authSlice";
import { questionsApi } from "../services/questions/questionsApi";
import { examsApi } from "../services/exams/examsApi";
import { sessionsApi } from "../services/sessions/sessionsApi";

export const store = configureStore({
  reducer: {
    auth: authSliceReducer,

    [authApi.reducerPath]: authApi.reducer,
    [questionsApi.reducerPath]: questionsApi.reducer,
    [examsApi.reducerPath]: examsApi.reducer,
    [sessionsApi.reducerPath]: sessionsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(questionsApi.middleware)
      .concat(examsApi.middleware)
      .concat(sessionsApi.middleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
