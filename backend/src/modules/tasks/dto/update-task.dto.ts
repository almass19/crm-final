import { IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой' })
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Приоритет должен быть целым числом' })
  @Min(0, { message: 'Приоритет должен быть от 0 до 100' })
  @Max(100, { message: 'Приоритет должен быть от 0 до 100' })
  priority?: number;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Некорректный статус' })
  status?: TaskStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Некорректный ID исполнителя' })
  assigneeId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата' })
  dueDate?: string;
}
