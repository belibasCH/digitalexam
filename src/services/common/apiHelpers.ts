import { type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { supabase } from './supabase';
import { PostgrestError } from '@supabase/supabase-js';

export interface SupabaseQueryArgs {
  table: string;
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  body?: unknown;
  select?: string;
  match?: Record<string, unknown>;
  filters?: Array<{ column: string; operator: string; value: unknown }>;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
  eq?: Record<string, unknown>;
  limit?: number;
}

export interface SupabaseError {
  status: number;
  data: {
    message: string;
    details?: string;
  };
}

type SupabaseBaseQueryFn = BaseQueryFn<SupabaseQueryArgs, unknown, SupabaseError>;

export const supabaseBaseQuery = (): SupabaseBaseQueryFn => {
  return async ({ table, method, body, select = '*', match, filters, order, single, eq, limit }) => {
    try {
      let query = supabase.from(table);

      switch (method) {
        case 'select': {
          let selectQuery = query.select(select);

          if (eq) {
            for (const [key, value] of Object.entries(eq)) {
              selectQuery = selectQuery.eq(key, value);
            }
          }

          if (filters) {
            for (const filter of filters) {
              selectQuery = selectQuery.filter(filter.column, filter.operator, filter.value);
            }
          }

          if (order) {
            selectQuery = selectQuery.order(order.column, { ascending: order.ascending ?? true });
          }

          if (limit) {
            selectQuery = selectQuery.limit(limit);
          }

          if (single) {
            const { data, error } = await selectQuery.single();
            if (error) throw error;
            return { data };
          }

          const { data, error } = await selectQuery;
          if (error) throw error;
          return { data };
        }

        case 'insert': {
          const insertQuery = query.insert(body as object).select(select);
          if (single) {
            const { data, error } = await insertQuery.single();
            if (error) throw error;
            return { data };
          }
          const { data, error } = await insertQuery;
          if (error) throw error;
          return { data };
        }

        case 'update': {
          let updateQuery = query.update(body as object);

          if (match) {
            for (const [key, value] of Object.entries(match)) {
              updateQuery = updateQuery.eq(key, value);
            }
          }

          const updateSelectQuery = updateQuery.select(select);
          if (single) {
            const { data, error } = await updateSelectQuery.single();
            if (error) throw error;
            return { data };
          }
          const { data, error } = await updateSelectQuery;
          if (error) throw error;
          return { data };
        }

        case 'upsert': {
          const upsertQuery = query.upsert(body as object).select(select);
          if (single) {
            const { data, error } = await upsertQuery.single();
            if (error) throw error;
            return { data };
          }
          const { data, error } = await upsertQuery;
          if (error) throw error;
          return { data };
        }

        case 'delete': {
          let deleteQuery = query.delete();

          if (match) {
            for (const [key, value] of Object.entries(match)) {
              deleteQuery = deleteQuery.eq(key, value);
            }
          }

          const { error } = await deleteQuery;
          if (error) throw error;
          return { data: null };
        }

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      return {
        error: {
          status: parseInt(pgError.code) || 500,
          data: {
            message: pgError.message || 'Ein Fehler ist aufgetreten',
            details: pgError.details,
          },
        },
      };
    }
  };
};

export const isSupabaseError = (error: unknown): error is SupabaseError => {
  return typeof error === 'object' && error !== null && 'status' in error && 'data' in error;
};

export const stringifyApiError = (error: SupabaseError | unknown): string => {
  if (!error) {
    return 'Unbekannter Fehler';
  }
  if (isSupabaseError(error)) {
    return error.data.message;
  }
  return 'Ein Fehler ist aufgetreten';
};
