import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Profile } from "../../types/database";
import { createSelectors, createSetters, VariablesOf } from "../common/sliceUtils";
import { useAppSelector } from "../../app/hooks";

interface State {
  user: Profile | undefined;
  initialized: boolean;
}

const initialState: State = {
  user: undefined,
  initialized: false,
};

const variables: VariablesOf<State> = ["user", "initialized"] as const;

const reducers = createSetters<State>()(variables);

const slice = createSlice({
  name: "authSlice",
  reducerPath: "auth",
  initialState,
  reducers: {
    ...reducers,
    setUser: (state, { payload }: PayloadAction<Profile | undefined>) => {
      state.user = payload;
      state.initialized = true;
    },
    logout: (state) => {
      state.user = undefined;
    },
  },
});

const selectors = {
  ...createSelectors(slice)(variables),
};

export const authSliceReducer = slice.reducer;
export const authSelectors = selectors;
export const authActions = {
  ...slice.actions,
};

export const authSlice = slice;

export const useAuth = () => useAppSelector(authSelectors.user);
export const useAuthInitialized = () => useAppSelector(authSelectors.initialized);
