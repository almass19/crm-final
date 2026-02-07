import { IsEmail, IsNotEmpty, IsOptional, IsString, IsArray, ArrayNotEmpty, Matches } from 'class-validator';

export class CreateClientDto {
  @IsOptional()
  @IsString({ message: 'ФИО должно быть строкой' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Название компании должно быть строкой' })
  companyName?: string;

  @IsNotEmpty({ message: 'Телефон обязателен' })
  @Matches(/^\+?[\d\s\-()]{7,20}$/, { message: 'Некорректный формат телефона' })
  phone: string;

  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsArray({ message: 'Услуги должны быть массивом' })
  @ArrayNotEmpty({ message: 'Выберите хотя бы одну услугу' })
  @IsString({ each: true, message: 'Каждая услуга должна быть строкой' })
  services: string[];

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;
}
