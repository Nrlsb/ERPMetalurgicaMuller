import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos iniciales (Seed)...');

  // 1. Crear Configuración de Empresa
  const company = await prisma.companySetting.upsert({
    where: { id: 'company-muller' },
    update: {},
    create: {
      id: 'company-muller',
      businessName: 'Muller Juan ERP',
      legalName: 'Muller Juan - Soluciones & Servicios',
      taxId: '20-35894123-9',
      address: 'Av. Central 1234, Buenos Aires',
      phone: '+54 11 4567-8900',
      email: 'contacto@mullerjuan.com',
      currencySymbol: '$',
      currencyCode: 'ARS',
    },
  });
  console.log('✅ Empresa configurada:', company.businessName);

  // 2. Roles
  const rolesData = [
    { name: 'ADMIN', description: 'Acceso total y administración del sistema', isSystem: true },
    { name: 'OPERADOR', description: 'Gestión operativa, inventario y movimientos', isSystem: false },
    { name: 'VENTAS', description: 'Cotizaciones, pedidos, facturación y clientes', isSystem: false },
    { name: 'COMPRAS', description: 'Órdenes de compra, proveedores e ingresos', isSystem: false },
    { name: 'FINANZAS', description: 'Cajas, bancos, tesorería y cuentas por pagar/cobrar', isSystem: false },
  ];

  const createdRoles: Record<string, any> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
    createdRoles[r.name] = role;
  }
  console.log('✅ Roles iniciales creados:', Object.keys(createdRoles).join(', '));

  // 3. Permisos
  const permissionsData = [
    // Auth & Users
    { code: 'users:read', name: 'Ver Usuarios', module: 'USUARIOS' },
    { code: 'users:write', name: 'Crear/Editar Usuarios', module: 'USUARIOS' },
    { code: 'roles:manage', name: 'Gestionar Roles y Permisos', module: 'USUARIOS' },
    // Inventory
    { code: 'inventory:read', name: 'Ver Inventario y Stock', module: 'INVENTARIO' },
    { code: 'inventory:write', name: 'Crear/Editar Productos y Movimientos', module: 'INVENTARIO' },
    { code: 'inventory:adjust', name: 'Realizar Ajustes de Stock', module: 'INVENTARIO' },
    // Sales
    { code: 'sales:read', name: 'Ver Cotizaciones y Ventas', module: 'VENTAS' },
    { code: 'sales:write', name: 'Emitir Cotizaciones y Facturas', module: 'VENTAS' },
    { code: 'customers:manage', name: 'Gestionar Clientes', module: 'VENTAS' },
    // Purchases
    { code: 'purchases:read', name: 'Ver Compras y Proveedores', module: 'COMPRAS' },
    { code: 'purchases:write', name: 'Crear Órdenes de Compra y Recepciones', module: 'COMPRAS' },
    { code: 'suppliers:manage', name: 'Gestionar Proveedores', module: 'COMPRAS' },
    // Finance
    { code: 'finance:read', name: 'Ver Cajas, Bancos y Reportes Financieros', module: 'FINANZAS' },
    { code: 'finance:write', name: 'Operar Cajas, Gastos y Cobros/Pagos', module: 'FINANZAS' },
    // Dashboard
    { code: 'dashboard:view', name: 'Ver Métricas y KPIs del Dashboard', module: 'DASHBOARD' },
  ];

  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });

    // Asignar todos los permisos al rol ADMIN
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles['ADMIN'].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles['ADMIN'].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ Permisos creados y asignados al rol ADMIN');

  // 4. Usuario Administrador Inicial
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin123!', salt);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@erpmuller.com' },
    update: {},
    create: {
      email: 'admin@erpmuller.com',
      fullName: 'Administrador Principal',
      passwordHash,
      phone: '+54 11 9999-8888',
      roleId: createdRoles['ADMIN'].id,
      isActive: true,
    },
  });
  console.log('✅ Usuario Administrador creado: admin@erpmuller.com (Password: Admin123!)');

  // 5. Unidades de Medida
  const units = [
    { name: 'Unidad', symbol: 'u' },
    { name: 'Metro', symbol: 'm' },
    { name: 'Kilogramo', symbol: 'kg' },
    { name: 'Litro', symbol: 'l' },
    { name: 'Caja', symbol: 'cja' },
  ];
  for (const u of units) {
    await prisma.unitOfMeasure.upsert({
      where: { symbol: u.symbol },
      update: {},
      create: u,
    });
  }

  // 6. Depósito / Ubicación de Stock por Defecto
  await prisma.stockLocation.upsert({
    where: { name: 'Depósito Central' },
    update: {},
    create: {
      name: 'Depósito Central',
      address: 'Casa Central - Almacén Principal',
      isDefault: true,
    },
  });

  // 7. Caja Principal por Defecto
  const defaultCash = await prisma.cashRegister.findFirst({
    where: { name: 'Caja Mostrador Principal' },
  });
  if (!defaultCash) {
    await prisma.cashRegister.create({
      data: {
        name: 'Caja Mostrador Principal',
        balance: 0,
        isOpen: true,
      },
    });
  }

  // 8. Categorías de Gastos
  const expenseCats = ['Alquiler', 'Servicios Públicos', 'Sueldos y Cargas', 'Impuestos', 'Mantenimiento e Insumos'];
  for (const cat of expenseCats) {
    await prisma.expenseCategory.upsert({
      where: { name: cat },
      update: {},
      create: { name: cat },
    });
  }

  // 9. Categorías de Productos de Inventario
  const productCats = [
    { name: 'Filtros y Aceites', description: 'Filtros de aceite, aire, combustible y lubricantes' },
    { name: 'Motor y Distribución', description: 'Correas, tensores, juntas, bombas de agua y componentes de motor' },
    { name: 'Frenos y Suspensión', description: 'Pastillas, discos, amortiguadores y extremos' },
    { name: 'Electricidad e Iluminación', description: 'Baterías, lámparas, fusibles, alternadores y sensores' },
    { name: 'Herramientas e Insumos', description: 'Herramientas de taller, aerosoles, selladores y consumibles' },
  ];
  for (const pCat of productCats) {
    const existing = await prisma.category.findFirst({
      where: { name: pCat.name, parentId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: pCat.name,
          description: pCat.description,
          isActive: true,
        },
      });
    }
  }

  console.log('🎉 Seed finalizado con éxito!');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
