import { Module } from '@nestjs/common';
import {
  ChangesController,
  NodeTraceController,
  RelationsController,
  TestCasesController,
  TraceController,
} from './trace.controller';
import { ChangesService } from './changes.service';
import { TestCasesService } from './testcases.service';
import { TraceService } from './trace.service';

@Module({
  controllers: [
    ChangesController,
    TestCasesController,
    RelationsController,
    TraceController,
    NodeTraceController,
  ],
  providers: [ChangesService, TestCasesService, TraceService],
  exports: [ChangesService, TestCasesService, TraceService],
})
export class TraceModule {}
