import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('Admin123!'); // cámbialo
  const user = await prisma.user.create({
    data: { email: 'admin@demo.com', name: 'Admin', passwordHash }
  });

  const tenant = await prisma.tenant.create({
    data: { name: 'Mi Negocio', adminUserId: user.id }
  });

  await prisma.channel.create({
    data: {
      tenantId: tenant.id,
      waPhoneNumberId: 'TO-DO',
      waBusinessId: 'TO-DO',
      displayName: 'Principal',
      status: 'active'
    }
  });

  await prisma.employee.createMany({
    data: [
      { tenantId: tenant.id, name: 'Empleado 1', active: true, position: 1 },
      { tenantId: tenant.id, name: 'Empleado 2', active: true, position: 2 },
    ]
  });

  await prisma.slaPolicy.create({
    data: {
      tenantId: tenant.id,
      name: 'Default',
      firstResponseSecs: 600,
      nextResponseSecs: 600,
      businessHours: { days: [1,2,3,4,5], start: '09:00', end: '18:00' }
    }
  });

  console.log('Seed listo:', { user: user.email, tenant: tenant.name });
}

main().finally(() => prisma.$disconnect());
