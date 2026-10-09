import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  Length,
  Matches,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function IsPasswordPolicy(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
    Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
      message: '$property must contain at least one letter and one digit',
    }),
  );
}

export function IsDifferentFrom(otherKey: string): PropertyDecorator {
  return ValidateBy({
    name: 'isDifferentFrom',
    validator: {
      validate: (value: unknown, args?: ValidationArguments) =>
        value !== (args?.object as Record<string, unknown>)[otherKey],
      defaultMessage: () => `$property must differ from ${otherKey}`,
    },
  });
}
