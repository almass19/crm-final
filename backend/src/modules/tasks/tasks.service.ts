import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskInclude = {
  client: { select: { id: true, fullName: true, companyName: true } },
  creator: { select: { id: true, fullName: true, role: true } },
  assignee: { select: { id: true, fullName: true, role: true } },
};

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto, creatorId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 50,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        clientId: dto.clientId,
        creatorId,
        assigneeId: dto.assigneeId,
      },
      include: taskInclude,
    });
  }

  async findByClient(clientId: string) {
    return this.prisma.task.findMany({
      where: { clientId },
      include: taskInclude,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findMyTasks(userId: string) {
    return this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: TaskStatus.DONE },
      },
      include: taskInclude,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findAllTasks() {
    return this.prisma.task.findMany({
      where: {
        status: { not: TaskStatus.DONE },
      },
      include: taskInclude,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findById(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }
    return task;
  }

  async update(taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: taskInclude,
    });
  }

  async delete(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { deleted: true };
  }
}
