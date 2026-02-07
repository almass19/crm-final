import { IsOptional, IsUUID } from 'class-validator';

export class AssignClientDto {
  @IsOptional()
  @IsUUID('4', { message: 'Некорректный ID специалиста' })
  specialistId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Некорректный ID дизайнера' })
  designerId?: string;
}
