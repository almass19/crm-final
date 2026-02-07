import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientStatus, Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('clients')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(Role.SALES_MANAGER)
  async create(
    @Body() dto: CreateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.create(dto, userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query('search') search?: string,
    @Query('status') status?: ClientStatus,
    @Query('unassigned') unassigned?: string,
  ) {
    return this.clientsService.findAll(
      user.role,
      user.id,
      search,
      status,
      unassigned === 'true',
    );
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.clientsService.findById(id, user.role, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.clientsService.update(id, dto, user.id, user.role);
  }

  @Patch(':id/archive')
  @Roles(Role.ADMIN)
  async archive(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.archive(id, userId);
  }

  @Post(':id/assign')
  @Roles(Role.ADMIN)
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.assign(id, dto.specialistId, dto.designerId, userId);
  }

  @Post(':id/acknowledge')
  @Roles(Role.SPECIALIST, Role.DESIGNER)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    const type = user.role === Role.DESIGNER ? 'designer' : 'specialist';
    return this.clientsService.acknowledge(id, user.id, type);
  }
}
