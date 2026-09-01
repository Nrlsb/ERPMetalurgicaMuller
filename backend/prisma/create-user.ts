import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  // Parámetros por consola:
  // npx tsx prisma/create-user.ts <usuario_o_email> <password> <fullName> [roleName] [phone]
  const usernameOrEmail = args[0] || 'BenitezLucas';
  const password = args[1] || 'Admin123!';
  const fullName = args[2] || (usernameOrEmail === 'BenitezLucas' ? 'Lucas Benitez' : usernameOrEmail);
  const roleName = (args[3] || 'ADMIN').toUpperCase();
  const phone = args[4] || null;

  console.log(`👤 Creando/actualizando usuario: ${usernameOrEmail} (${fullName})...`);

  // 1. Buscar o crear el rol si no existe
  let role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    console.log(`ℹ️ El rol '${roleName}' no existía. Creándolo...`);
    role = await prisma.role.create({
      data: {
        name: roleName,
        description: `Rol de ${roleName}`,
        isSystem: roleName === 'ADMIN',
      },
    });
  }

  // 2. Hashear contraseña
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 3. Upsert del usuario buscando por email / usuario o nombre
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: usernameOrEmail, mode: 'insensitive' } },
        { fullName: { equals: fullName, mode: 'insensitive' } },
      ],
    },
  });

  let user;
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: usernameOrEmail,
        fullName,
        passwordHash,
        roleId: role.id,
        phone,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
      include: { role: true },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: usernameOrEmail,
        fullName,
        passwordHash,
        roleId: role.id,
        phone,
        isActive: true,
      },
      include: { role: true },
    });
  }

  console.log('✅ ¡Usuario guardado exitosamente en la base de datos de Supabase!');
  console.log('----------------------------------------------------');
  console.log(`ID:       ${user.id}`);
  console.log(`Usuario:  ${user.email}`);
  console.log(`Nombre:   ${user.fullName}`);
  console.log(`Rol:      ${user.role.name}`);
  console.log(`Estado:   ${user.isActive ? 'Activo' : 'Inactivo'}`);
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Error al crear usuario:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
