/**
 * @vendored-from antunello-app:utils/date.ts
 * @upstream-sha256 2357233a6d9f8ab903577a3ad7079ae3989ba38994707d2b48f79679e18146ab
 * @vendored-on 2026-09-10
 * @parity exact
 * @divergences none
 *
 * DO NOT EDIT THIS COPY IN ISOLATION.
 *
 * This file is vendored verbatim from the web app. The hash above is of the
 * upstream file after alias rewriting; it must equal the hash of everything
 * below this header. If you change the web implementation, re-run
 * `npm run vendor` and follow PARITY.md.
 */
/**
 * Date formatting and parsing utilities.
 *
 * Provides functions for converting between ISO date strings, local datetime-local
 * input format values, and user-friendly display formats including relative labels
 * (Today, Yesterday), day-of-week, and locale-aware formatting.
 *
 * @module utils/date
 */

/**
 * Parses an ISO 8601 date string into a Date object, treating datetime strings
 * that lack an explicit timezone indicator as UTC.
 *
 * Per the ES6 specification, `new Date("2024-08-03T14:00:00")` treats the
 * string as local time when no timezone is specified. This is problematic
 * when external services (Enable Banking, Trade Republic) produce UTC
 * timestamps without the `Z` suffix — the resulting Date would be offset by
 * the local timezone (e.g. 2 hours behind in CEST).
 *
 * This function detects the missing timezone and appends `Z` so the string
 * is unambiguously parsed as UTC. Date-only strings (no `T`) and strings
 * that already carry a timezone (`Z`, `+HH:MM`, `-HH:MM`) are passed
 * through unchanged.
 *
 * @param dateString - ISO 8601 date or datetime string
 * @returns A Date object representing the correct UTC moment
 */
export function parseISODateTime(dateString: string): Date {
  if (
    dateString.includes('T') &&
    !dateString.endsWith('Z') &&
    !/[+-]\d{2}:\d{2}$/.test(dateString)
  ) {
    return new Date(dateString + 'Z')
  }
  return new Date(dateString)
}

// Format date for datetime-local input (local timezone)
/**
 * Converts an ISO date string to the format required by datetime-local HTML inputs.
 * Adjusts for the local timezone offset to produce a correct local datetime value.
 *
 * @param dateString - ISO 8601 date string (e.g. "2025-08-15T14:30:00.000Z")
 * @returns A string in "YYYY-MM-DDTHH:MM" format suitable for datetime-local input
 */
export function formatDateTimeLocal(dateString: string): string {
  const date = parseISODateTime(dateString)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

// Format date only (DD/MM/YYYY)
/**
 * Formats an ISO date string to a short date representation using Italian locale.
 * Output format: DD/MM/YYYY.
 *
 * @param isoString - ISO 8601 date string
 * @returns The formatted date string (e.g. "15/08/2025")
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Parse datetime-local input and return ISO string
/**
 * Parses a value from a datetime-local input and converts it to an ISO 8601 string.
 *
 * @param date - A date string as returned by a datetime-local HTML input
 * @returns The date as an ISO 8601 string
 */
export function parseDateTime(date: string): string {
  return new Date(date).toISOString()
}

// Format date with relative labels (Today, Yesterday) and day of week for older dates
/**
 * Formats an ISO date string into a human-readable header format.
 * Uses relative labels "Today" and "Yesterday" where applicable, shows
 * the weekday and full month/day for dates within the current year, and
 * includes the year for dates in different years.
 *
 * @param isoString - ISO 8601 date string
 * @returns A formatted header string (e.g. "Today, August 15" or "Monday, August 2")
 */
export function formatDateHeader(isoString: string): string {
  const date = new Date(isoString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  // Reset time to compare only dates
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return `Yesterday, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
  } else if (date.getFullYear() === today.getFullYear()) {
    // Same year: "Monday, August 2"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  } else {
    // Different year: "Tuesday, December 31, 2024"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }
}

// Format date header with forced year display (for search results)
/**
 * Formats an ISO date string into a human-readable header with an always-visible year.
 * Similar to formatDateHeader but always includes the year component regardless of
 * the current year context. Used in search results where temporal context is important.
 *
 * @param isoString - ISO 8601 date string
 * @returns A formatted header string with year included
 *          (e.g. "Today, August 15, 2023" or "Thursday, July 31, 2023")
 */
export function formatDateHeaderWithYear(isoString: string): string {
  const date = new Date(isoString)
  const today = new Date()

  // Reset time to compare only dates
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())

  if (dateOnly.getTime() === todayOnly.getTime()) {
    // For current year: "Today, August 15"
    // For different year: "Today, August 15, 2023"
    const baseFormat = `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    return date.getFullYear() === today.getFullYear() ? baseFormat : `${baseFormat}, ${date.getFullYear()}`
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    // For current year: "Yesterday, August 14"
    // For different year: "Yesterday, August 14, 2023"
    const baseFormat = `Yesterday, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    return date.getFullYear() === today.getFullYear() ? baseFormat : `${baseFormat}, ${date.getFullYear()}`
  } else {
    // Always include year: "Thursday, July 31, 2023"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }
}
