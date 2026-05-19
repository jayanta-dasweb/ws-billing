import { CustomerType, PrismaClient, UserRole } from '@prisma/client';
import { PERMISSION_CATALOG } from '@billing/shared';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_PERMS = PERMISSION_CATALOG.map((p) => p.code);

const CASHIER_PERMS = [
  ...PERMISSION_CATALOG.filter((p) => p.group === 'billing').map((p) => p.code),
  'master.customer.view',
  'master.customer.create',
];

async function seedRbac() {
  for (let i = 0; i < PERMISSION_CATALOG.length; i++) {
    const p = PERMISSION_CATALOG[i];
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {
        groupKey: p.group,
        resource: p.resource,
        action: p.action,
        name: p.name,
        description: p.description,
        sortOrder: i,
      },
      create: {
        code: p.code,
        groupKey: p.group,
        resource: p.resource,
        action: p.action,
        name: p.name,
        description: p.description,
        sortOrder: i,
      },
    });
  }

  await prisma.role.upsert({
    where: { id: 'role-super-admin' },
    update: { name: 'Super Admin', isActive: true },
    create: {
      id: 'role-super-admin',
      key: 'super_admin',
      name: 'Super Admin',
      description: 'Full access',
      isSystem: true,
    },
  });
  await prisma.role.upsert({
    where: { id: 'role-admin' },
    update: { name: 'Admin', isActive: true },
    create: {
      id: 'role-admin',
      key: 'admin',
      name: 'Admin',
      description: 'Manage shop setup',
      isSystem: true,
    },
  });
  await prisma.role.upsert({
    where: { id: 'role-cashier' },
    update: { name: 'Cashier', isActive: true },
    create: {
      id: 'role-cashier',
      key: 'cashier',
      name: 'Cashier',
      description: 'Billing counter',
      isSystem: true,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: 'role-admin' } });
  await prisma.rolePermission.createMany({
    data: ADMIN_PERMS.map((permissionCode) => ({ roleId: 'role-admin', permissionCode })),
    skipDuplicates: true,
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: 'role-cashier' } });
  await prisma.rolePermission.createMany({
    data: CASHIER_PERMS.map((permissionCode) => ({ roleId: 'role-cashier', permissionCode })),
    skipDuplicates: true,
  });
}

async function main() {
  await seedRbac();

  await prisma.company.upsert({
    where: { id: 'seed-company-1' },
    update: {
      name: 'Demo Pharmacy & Retail',
      address: '123 Main Street, City',
      gstin: '29AAAAA0000A1Z5',
      phone: '9876543210',
      isActive: true,
    },
    create: {
      id: 'seed-company-1',
      name: 'Demo Pharmacy & Retail',
      address: '123 Main Street, City',
      gstin: '29AAAAA0000A1Z5',
      phone: '9876543210',
      invoiceFooter: 'Thank you for your purchase!',
    },
  });

  const tax = await prisma.taxMaster.upsert({
    where: { id: 'seed-tax-12' },
    update: { name: 'GST 12%', gstPercent: 12, cgstPercent: 6, sgstPercent: 6, igstPercent: 12 },
    create: {
      id: 'seed-tax-12',
      name: 'GST 12%',
      gstPercent: 12,
      cgstPercent: 6,
      sgstPercent: 6,
      igstPercent: 12,
    },
  });

  const paymentModes = [
    { code: 'CASH', name: 'Cash', sortOrder: 1 },
    { code: 'CARD', name: 'Card', sortOrder: 2 },
    { code: 'UPI', name: 'UPI', sortOrder: 3 },
    { code: 'SPLIT', name: 'Split Payment', sortOrder: 4 },
  ];
  for (const pm of paymentModes) {
    await prisma.paymentModeMaster.upsert({
      where: { code: pm.code },
      update: { name: pm.name, sortOrder: pm.sortOrder, isActive: true },
      create: pm,
    });
  }

  const counter = await prisma.counter.upsert({
    where: { id: 'seed-counter-1' },
    update: { name: 'Counter 1', isActive: true },
    create: { id: 'seed-counter-1', name: 'Counter 1', isActive: true },
  });

  const adminHash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminHash,
      role: UserRole.SUPER_ADMIN,
      roleId: 'role-super-admin',
      isActive: true,
      counterId: null,
    },
    create: {
      username: 'admin',
      passwordHash: adminHash,
      role: UserRole.SUPER_ADMIN,
      roleId: 'role-super-admin',
      isActive: true,
    },
  });

  const cashierHash = await bcrypt.hash('Cashier@123', 12);
  const cashier = await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: {
      passwordHash: cashierHash,
      role: UserRole.CASHIER,
      roleId: 'role-cashier',
      isActive: true,
      counterId: counter.id,
    },
    create: {
      username: 'cashier1',
      passwordHash: cashierHash,
      role: UserRole.CASHIER,
      roleId: 'role-cashier',
      isActive: true,
      counterId: counter.id,
    },
  });

  await prisma.userCounter.upsert({
    where: {
      userId_counterId: { userId: cashier.id, counterId: counter.id },
    },
    update: { isPrimary: true },
    create: { userId: cashier.id, counterId: counter.id, isPrimary: true },
  });

  await prisma.counterIpRule.upsert({
    where: { id: 'seed-ip-local' },
    update: { cidr: '127.0.0.1', isActive: true },
    create: {
      id: 'seed-ip-local',
      counterId: counter.id,
      cidr: '127.0.0.1',
      label: 'Localhost',
    },
  });

  const addMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const demoProducts: {
    barcode: string;
    sku: string;
    name: string;
    sellingPrice: number;
    batches: {
      batchNumber: string;
      stockQty: number;
      mrp: number;
      sellingPrice: number;
      monthsUntilExpiry: number;
      discountPercent?: number;
      discountPerUnit?: number;
    }[];
  }[] = [
    {
      barcode: '8901000000001',
      sku: 'PCM500',
      name: 'Paracetamol 500mg',
      sellingPrice: 25,
      batches: [
        { batchNumber: 'PCM-2024-A', stockQty: 120, mrp: 32, sellingPrice: 25, monthsUntilExpiry: 10 },
        { batchNumber: 'PCM-2024-B', stockQty: 85, mrp: 30, sellingPrice: 24, monthsUntilExpiry: 6 },
        { batchNumber: 'PCM-2025-C', stockQty: 200, mrp: 28, sellingPrice: 22, monthsUntilExpiry: 18 },
        {
          batchNumber: 'PCM-NEAR-EXP',
          stockQty: 40,
          mrp: 26,
          sellingPrice: 20,
          monthsUntilExpiry: 2,
          discountPercent: 10,
        },
        { batchNumber: 'PCM-OLD-D', stockQty: 15, mrp: 24, sellingPrice: 18, monthsUntilExpiry: 14 },
      ],
    },
    {
      barcode: '8901000000002',
      sku: 'DOLO650',
      name: 'Dolo 650mg',
      sellingPrice: 32,
      batches: [
        { batchNumber: 'DOLO-B001', stockQty: 90, mrp: 38, sellingPrice: 32, monthsUntilExpiry: 12 },
        { batchNumber: 'DOLO-B002', stockQty: 60, mrp: 36, sellingPrice: 30, monthsUntilExpiry: 8 },
        { batchNumber: 'DOLO-B003', stockQty: 150, mrp: 35, sellingPrice: 29, monthsUntilExpiry: 20 },
        {
          batchNumber: 'DOLO-B004',
          stockQty: 25,
          mrp: 34,
          sellingPrice: 28,
          monthsUntilExpiry: 3,
          discountPerUnit: 2,
        },
      ],
    },
    {
      barcode: '8901000000003',
      sku: 'AMOX250',
      name: 'Amoxicillin 250mg',
      sellingPrice: 45,
      batches: [
        { batchNumber: 'AMX-LOT-11', stockQty: 70, mrp: 55, sellingPrice: 45, monthsUntilExpiry: 9 },
        { batchNumber: 'AMX-LOT-12', stockQty: 110, mrp: 52, sellingPrice: 42, monthsUntilExpiry: 15 },
        { batchNumber: 'AMX-LOT-13', stockQty: 35, mrp: 50, sellingPrice: 40, monthsUntilExpiry: 5 },
      ],
    },
    {
      barcode: '8901000000004',
      sku: 'CETI10',
      name: 'Cetirizine 10mg',
      sellingPrice: 18,
      batches: [
        { batchNumber: 'CET-A1', stockQty: 180, mrp: 22, sellingPrice: 18, monthsUntilExpiry: 16 },
        { batchNumber: 'CET-A2', stockQty: 95, mrp: 21, sellingPrice: 17, monthsUntilExpiry: 11 },
        { batchNumber: 'CET-A3', stockQty: 50, mrp: 20, sellingPrice: 16, monthsUntilExpiry: 7 },
        { batchNumber: 'CET-A4', stockQty: 12, mrp: 19, sellingPrice: 15, monthsUntilExpiry: 2 },
      ],
    },
    {
      barcode: '8901000000005',
      sku: 'CROCIN',
      name: 'Crocin Advance',
      sellingPrice: 38,
      batches: [
        { batchNumber: 'CRN-2401', stockQty: 75, mrp: 45, sellingPrice: 38, monthsUntilExpiry: 13 },
        { batchNumber: 'CRN-2402', stockQty: 100, mrp: 44, sellingPrice: 36, monthsUntilExpiry: 22 },
        { batchNumber: 'CRN-2403', stockQty: 30, mrp: 42, sellingPrice: 35, monthsUntilExpiry: 4 },
      ],
    },
    {
      barcode: '8901000000006',
      sku: 'VITC500',
      name: 'Vitamin C 500mg',
      sellingPrice: 15,
      batches: [
        { batchNumber: 'VTC-01', stockQty: 250, mrp: 20, sellingPrice: 15, monthsUntilExpiry: 24 },
        { batchNumber: 'VTC-02', stockQty: 80, mrp: 18, sellingPrice: 14, monthsUntilExpiry: 10 },
      ],
    },
  ];

  for (const demo of demoProducts) {
    const product = await prisma.product.upsert({
      where: { barcode: demo.barcode },
      update: {
        name: demo.name,
        sku: demo.sku,
        sellingPrice: demo.sellingPrice,
        taxMasterId: tax.id,
        isActive: true,
        batchEnabled: true,
      },
      create: {
        name: demo.name,
        barcode: demo.barcode,
        sku: demo.sku,
        hsnCode: '30049099',
        taxMasterId: tax.id,
        sellingPrice: demo.sellingPrice,
        batchEnabled: true,
      },
    });

    for (const b of demo.batches) {
      await prisma.batchStock.upsert({
        where: {
          productId_batchNumber: { productId: product.id, batchNumber: b.batchNumber },
        },
        update: {
          stockQty: b.stockQty,
          mrp: b.mrp,
          sellingPrice: b.sellingPrice,
          discountPercent: b.discountPercent ?? 0,
          discountPerUnit: b.discountPerUnit ?? 0,
          expiryDate: addMonths(b.monthsUntilExpiry),
          isActive: true,
        },
        create: {
          productId: product.id,
          batchNumber: b.batchNumber,
          mrp: b.mrp,
          sellingPrice: b.sellingPrice,
          discountPercent: b.discountPercent ?? 0,
          discountPerUnit: b.discountPerUnit ?? 0,
          stockQty: b.stockQty,
          expiryDate: addMonths(b.monthsUntilExpiry),
        },
      });
    }
  }

  // Merge duplicate product masters (same SKU from old + new seed runs)
  const withSku = await prisma.product.findMany({
    where: { isActive: true, sku: { not: null } },
    include: { batches: { where: { isActive: true } } },
  });
  const skuGroups = new Map<string, typeof withSku>();
  for (const p of withSku) {
    const key = p.sku!.toUpperCase();
    const g = skuGroups.get(key) ?? [];
    g.push(p);
    skuGroups.set(key, g);
  }
  for (const group of skuGroups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => b.batches.length - a.batches.length);
    const keep = group[0]!;
    for (let i = 1; i < group.length; i++) {
      const drop = group[i]!;
      for (const batch of drop.batches) {
        const clash = await prisma.batchStock.findUnique({
          where: {
            productId_batchNumber: { productId: keep.id, batchNumber: batch.batchNumber },
          },
        });
        if (clash) {
          await prisma.batchStock.update({
            where: { id: batch.id },
            data: { isActive: false, stockQty: 0 },
          });
        } else {
          await prisma.batchStock.update({
            where: { id: batch.id },
            data: { productId: keep.id },
          });
        }
      }
      await prisma.product.update({
        where: { id: drop.id },
        data: { isActive: false },
      });
    }
  }

  await prisma.customer.upsert({
    where: { id: 'seed-walkin' },
    update: { name: 'Walk-in Customer', customerType: CustomerType.WALK_IN },
    create: {
      id: 'seed-walkin',
      name: 'Walk-in Customer',
      customerType: CustomerType.WALK_IN,
    },
  });

  console.log('Seed complete:');
  console.log('  admin / Admin@123 (SUPER_ADMIN)');
  console.log('  cashier1 / Cashier@123 (CASHIER → Counter 1)');
  console.log('  Demo products: Paracetamol, Dolo, Amoxicillin, Cetirizine, Crocin, Vitamin C (multi-batch)');
  console.log('  IP allowlist: 127.0.0.1 on Counter 1 (set IP_ALLOWLIST_ENFORCED=true to enforce)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
