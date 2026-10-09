import { HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-code.js';
import { ALLOWED_MIME_TYPES } from '../../core/storage/file-type.util.js';
import { MAX_UPLOAD_BYTES } from '../../config/env.validation.js';

export const PhotoUploadInterceptor = FileInterceptor('photo', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new AppException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          ErrorCode.UNSUPPORTED_FILE_TYPE,
          'Photo must be a JPEG, PNG, or WebP image.',
        ),
        false,
      );
    } else {
      cb(null, true);
    }
  },
});
