import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClientStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientInclude = {
  createdBy: { select: { fullName: true } },
  assignedTo: { select: { fullName: true } },
  designer: { select: { fullName: true } },
};

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateClientDto, userId: string) {
    if (!dto.fullName && !dto.companyName) {
      throw new BadRequestException(
        'Необходимо указать ФИО или название компании',
      );
    }

    const client = await this.prisma.client.create({
      data: {
        fullName: dto.fullName,
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email,
        services: dto.services,
        notes: dto.notes,
        createdById: userId,
      },
      include: clientInclude,
    });

    await this.auditService.log(
      'CLIENT_CREATED',
      userId,
      client.id,
      `Клиент создан: ${dto.fullName || dto.companyName}`,
    );

    return client;
  }

  async findAll(
    userRole: Role | null,
    userId: string,
    search?: string,
    status?: ClientStatus,
    unassigned?: boolean,
  ) {
    const where: any = { archived: false };

    if (userRole === Role.SPECIALIST) {
      where.assignedToId = userId;
    }

    if (userRole === Role.DESIGNER) {
      where.designerId = userId;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (unassigned) {
      where.assignedToId = null;
    }

    return this.prisma.client.findMany({
      where,
      include: clientInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userRole: Role | null, userId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, role: true } },
        designer: { select: { id: true, fullName: true, role: true } },
        assignmentHistory: {
          include: {
            specialist: { select: { fullName: true } },
            designer: { select: { fullName: true } },
            assignedBy: { select: { fullName: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    if (userRole === Role.SPECIALIST && client.assignedToId !== userId) {
      throw new ForbiddenException('Нет доступа к данному клиенту');
    }

    if (userRole === Role.DESIGNER && client.designerId !== userId) {
      throw new ForbiddenException('Нет доступа к данному клиенту');
    }

    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    userId: string,
    userRole: Role | null,
  ) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    if (userRole === Role.SPECIALIST && client.assignedToId !== userId) {
      throw new ForbiddenException('Нет доступа к данному клиенту');
    }

    if (userRole === Role.DESIGNER && client.designerId !== userId) {
      throw new ForbiddenException('Нет доступа к данному клиенту');
    }

    if (dto.status && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Только администратор может менять статус клиента',
      );
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: dto,
      include: clientInclude,
    });

    if (dto.status) {
      await this.auditService.log(
        'STATUS_CHANGED',
        userId,
        id,
        `Статус изменён: ${client.status} → ${dto.status}`,
      );
    }

    return updated;
  }

  async archive(id: string, userId: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    await this.auditService.log(
      'CLIENT_ARCHIVED',
      userId,
      id,
      'Клиент архивирован',
    );

    return this.prisma.client.update({
      where: { id },
      data: { archived: true },
    });
  }

  async assign(
    clientId: string,
    specialistId: string | undefined,
    designerId: string | undefined,
    assignedById: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    if (!specialistId && !designerId) {
      throw new BadRequestException(
        'Необходимо указать специалиста или дизайнера',
      );
    }

    const updateData: any = {};

    if (specialistId) {
      const specialist = await this.prisma.user.findUnique({
        where: { id: specialistId },
      });
      if (!specialist || specialist.role !== Role.SPECIALIST) {
        throw new BadRequestException(
          'Указанный пользователь не является специалистом',
        );
      }

      const oldAssignee = client.assignedToId;
      updateData.assignedToId = specialistId;
      updateData.assignedAt = new Date();
      updateData.assignmentSeen = false;

      await this.prisma.assignmentHistory.create({
        data: {
          clientId,
          type: 'SPECIALIST',
          specialistId,
          assignedById,
        },
      });

      const action = oldAssignee
        ? 'SPECIALIST_REASSIGNED'
        : 'SPECIALIST_ASSIGNED';
      await this.auditService.log(
        action,
        assignedById,
        clientId,
        `Специалист назначен: ${specialist.fullName}`,
      );
    }

    if (designerId) {
      const designer = await this.prisma.user.findUnique({
        where: { id: designerId },
      });
      if (!designer || designer.role !== Role.DESIGNER) {
        throw new BadRequestException(
          'Указанный пользователь не является дизайнером',
        );
      }

      const oldDesigner = client.designerId;
      updateData.designerId = designerId;
      updateData.designerAssignedAt = new Date();
      updateData.designerAssignmentSeen = false;

      await this.prisma.assignmentHistory.create({
        data: {
          clientId,
          type: 'DESIGNER',
          designerId,
          assignedById,
        },
      });

      const action = oldDesigner
        ? 'DESIGNER_REASSIGNED'
        : 'DESIGNER_ASSIGNED';
      await this.auditService.log(
        action,
        assignedById,
        clientId,
        `Дизайнер назначен: ${designer.fullName}`,
      );
    }

    if (client.status === ClientStatus.NEW) {
      updateData.status = ClientStatus.ASSIGNED;
    }

    return this.prisma.client.update({
      where: { id: clientId },
      data: updateData,
      include: clientInclude,
    });
  }

  async acknowledge(
    clientId: string,
    userId: string,
    type: 'specialist' | 'designer' = 'specialist',
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    if (type === 'specialist') {
      if (client.assignedToId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены на данного клиента как специалист',
        );
      }
      if (client.assignmentSeen) {
        throw new BadRequestException('Назначение уже подтверждено');
      }

      await this.prisma.client.update({
        where: { id: clientId },
        data: { assignmentSeen: true, status: ClientStatus.IN_WORK },
      });

      await this.auditService.log(
        'SPECIALIST_ACKNOWLEDGED',
        userId,
        clientId,
        'Специалист принял клиента в работу',
      );
    } else {
      if (client.designerId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены на данного клиента как дизайнер',
        );
      }
      if (client.designerAssignmentSeen) {
        throw new BadRequestException(
          'Назначение дизайнера уже подтверждено',
        );
      }

      await this.prisma.client.update({
        where: { id: clientId },
        data: { designerAssignmentSeen: true },
      });

      await this.auditService.log(
        'DESIGNER_ACKNOWLEDGED',
        userId,
        clientId,
        'Дизайнер принял клиента в работу',
      );
    }
  }
}
