import { Module } from '@nestjs/common';
import { TasksController, NodeTasksController } from './tasks.controller';
import { IssuesController, NodeIssuesController } from './issues.controller';
import { CommentsController } from './comments.controller';
import { TasksService } from './tasks.service';
import { IssuesService } from './issues.service';
import { CommentsService } from './comments.service';

@Module({
  controllers: [
    TasksController,
    NodeTasksController,
    IssuesController,
    NodeIssuesController,
    CommentsController,
  ],
  providers: [TasksService, IssuesService, CommentsService],
  exports: [TasksService, IssuesService, CommentsService],
})
export class WorkModule {}
