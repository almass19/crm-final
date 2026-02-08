import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post('tasks')
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.create(dto, userId);
  }

  @Get('clients/:clientId/tasks')
  async findByClient(@Param('clientId') clientId: string) {
    return this.tasksService.findByClient(clientId);
  }

  @Get('tasks/my')
  async findMyTasks(@CurrentUser('id') userId: string) {
    return this.tasksService.findMyTasks(userId);
  }

  @Get('tasks/all')
  async findAllTasks() {
    return this.tasksService.findAllTasks();
  }

  @Get('tasks/:id')
  async findById(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Patch('tasks/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete('tasks/:id')
  @Roles(Role.ADMIN)
  async delete(@Param('id') id: string) {
    return this.tasksService.delete(id);
  }
}
