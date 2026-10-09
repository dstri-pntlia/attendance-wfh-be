import { ValidateBy, type ValidationOptions } from 'class-validator';

export type SortDirection = 'ASC' | 'DESC';

export interface SortOrder<F extends string = string> {
  field: F;
  direction: SortDirection;
}

const SORT_PATTERN = /^([A-Za-z]+):(asc|desc)$/;

export function parseSort<F extends string>(
  value: unknown,
  allowedFields: readonly F[],
): SortOrder<F> | null {
  if (typeof value !== 'string') return null;
  const match = SORT_PATTERN.exec(value);
  if (!match) return null;
  const [, field, direction] = match;
  if (!(allowedFields as readonly string[]).includes(field)) return null;
  return {
    field: field as F,
    direction: direction === 'asc' ? 'ASC' : 'DESC',
  };
}

export function IsSort(
  allowedFields: readonly string[],
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSort',
      constraints: [allowedFields],
      validator: {
        validate: (value: unknown) => parseSort(value, allowedFields) !== null,
        defaultMessage: () =>
          `$property must be "field:asc" or "field:desc" where field is one of: ${allowedFields.join(', ')}`,
      },
    },
    options,
  );
}
