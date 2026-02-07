import { IsEmail, IsEnum, IsOptional, IsString, IsArray, Matches } from 'class-validator';
import { ClientStatus } from '@prisma/client';

export class UpdateClientDto {
  @IsOptional()
  @IsString({ message: 'ФИО должно быть строкой' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Название компании должно быть строкой' })
  companyName?: string;

  @IsOptional()
  @Matches(/^\+?[\d\s\-()]{7,20}$/, { message: 'Некорректный формат телефона' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @IsArray({ message: 'Услуги должны быть массивом' })
  @IsString({ each: true, message: 'Каждая услуга должна быть строкой' })
  services?: string[];

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;

  @IsOptional()
  @IsEnum(ClientStatus, { message: 'Некорректный статус' })
  status?: ClientStatus;
}
