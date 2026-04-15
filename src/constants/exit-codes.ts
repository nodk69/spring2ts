export const EXIT_CODES = {
  SUCCESS: 0,
  PARSE_ERROR: 1,
  FILE_NOT_FOUND: 2,
  BREAKING_CHANGE: 3,
  CONFIG_ERROR: 4,
  UNKNOWN_ERROR: 5,
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];