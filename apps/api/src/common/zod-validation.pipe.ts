import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * NestJS pipe that runs a Zod schema against the incoming body. Boundary
 * validation — internal services trust their inputs.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
