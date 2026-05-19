import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreatePaymentModeDto, UpdatePaymentModeDto } from './dto/payment-mode.dto';

@Injectable()
export class PaymentModeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentModeMasterWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.paymentModeMaster.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.paymentModeMaster.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.paymentModeMaster.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Payment mode not found');
    return row;
  }

  async create(dto: CreatePaymentModeDto, userId: string, ip?: string) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.paymentModeMaster.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Payment mode code already exists');

    const row = await this.prisma.paymentModeMaster.create({
      data: { ...dto, code },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'PaymentModeMaster',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdatePaymentModeDto, userId: string, ip?: string) {
    await this.findOne(id);
    const data = { ...dto };
    if (dto.code) data.code = dto.code.trim().toUpperCase();

    const row = await this.prisma.paymentModeMaster.update({ where: { id }, data });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'PaymentModeMaster',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}
