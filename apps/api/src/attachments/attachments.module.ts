import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { STORAGE_PORT } from './storage.port';
import { FileSystemStorage } from './filesystem.storage';
import { S3Storage } from './s3.storage';

/**
 * Elige la implementación según entorno: `S3_BUCKET` presente → S3/MinIO
 * (prod); si no, filesystem en `UPLOADS_DIR` (dev, 03 §4.6).
 */
function storageFactory(): {
  provide: typeof STORAGE_PORT;
  useClass: typeof FileSystemStorage | typeof S3Storage;
} {
  return {
    provide: STORAGE_PORT,
    useClass: process.env.S3_BUCKET ? S3Storage : FileSystemStorage,
  };
}

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, storageFactory()],
})
export class AttachmentsModule {}
