/**
 * Home's server-computed figures.
 *
 * All the arithmetic lives in the `get_month_pace`, `get_month_movers` and
 * `get_net_worth_series` RPCs, shared with the web app, so the two clients
 * cannot disagree about a number. This file only passes the device's timezone
 * and maps the rows.
 */

import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** Row returned by `get_month_pace`. */
type MonthPaceRow = {
  month_start: string;
  as_of_date: string;
  spent_to_date: number;
  net_to_date: number;
  prev_month_net_to_day: number | null;
  typical_spent_to_date: number | null;
  prior_30d_net: number;
};

type MonthPace = {
  monthStart: string;
  asOfDate: string;
  spentToDate: number;
  netToDate: number;
  prevMonthNetToDay: number | null;
  typicalSpentToDate: number | null;
  prior30dNet: number;
};

/** Row returned by `get_month_movers`. */
type MonthMoverRow = {
  main_category: string;
  sub_category: string | null;
  delta: number;
};

export type MonthMover = {
  mainCategory: string;
  subCategory: string | null;
  /** What it has cost so far minus what a typical month would have by now. */
  delta: number;
};

/**
 * The device's IANA timezone. The database attributes dates in it, so a payment
 * just after local midnight on the 1st belongs to the month the user thinks it
 * does. Hermes omits the field on some builds; UTC then matches the old
 * behaviour rather than silently shifting a day.
 */
function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Today's local date as `YYYY-MM-DD`. */
function localToday(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function currentUserId(): Promise<string | null> {
  // Local session read — getUser() would add an auth round-trip to every load.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/** The current month's spending, pace and comparisons. */
export function useMonthPace() {
  return useQuery({
    queryKey: qk.monthPace(),
    queryFn: async (): Promise<MonthPace | null> => {
      const userId = await currentUserId();
      if (!userId) return null;

      const timeZone = deviceTimeZone();
      const { data, error } = await supabase.rpc('get_month_pace', {
        p_user_id: userId,
        p_month: localToday(timeZone),
        p_tz: timeZone,
      });

      if (error) throw error;

      const row = ((data ?? []) as MonthPaceRow[])[0];
      if (!row) return null;

      return {
        monthStart: row.month_start,
        asOfDate: row.as_of_date,
        spentToDate: Number(row.spent_to_date) || 0,
        netToDate: Number(row.net_to_date) || 0,
        prevMonthNetToDay:
          row.prev_month_net_to_day === null ? null : Number(row.prev_month_net_to_day),
        typicalSpentToDate:
          row.typical_spent_to_date === null ? null : Number(row.typical_spent_to_date),
        prior30dNet: Number(row.prior_30d_net) || 0,
      };
    },
  });
}

/** Categories running hot or cold against their usual pace. */
export function useMonthMovers() {
  return useQuery({
    queryKey: qk.monthMovers(),
    queryFn: async (): Promise<MonthMover[]> => {
      const userId = await currentUserId();
      if (!userId) return [];

      const timeZone = deviceTimeZone();
      const { data, error } = await supabase.rpc('get_month_movers', {
        p_user_id: userId,
        p_month: localToday(timeZone),
        p_tz: timeZone,
      });

      if (error) throw error;

      return ((data ?? []) as MonthMoverRow[]).map((row) => ({
        mainCategory: row.main_category,
        subCategory: row.sub_category,
        delta: Number(row.delta) || 0,
      }));
    },
  });
}

