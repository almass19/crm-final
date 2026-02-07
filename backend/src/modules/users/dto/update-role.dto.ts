import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(Role, { message: 'Некорректная роль' })
  @IsNotEmpty({ message: 'Роль обязательна' })
  role: Role;
}
