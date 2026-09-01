import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { parsePaginationParams, buildPaginatedResponse } from '../lib/pagination';
import { generateNextCode } from '../lib/sequence';

const createProductSchema = z.object({
  sku: z.string().min(2, 'El SKU es requerido'),
  barcode: z.string().optional(),
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  iva: z.number().min(0).default(21),
  supplierIds: z.array(z.string()).optional(),
  minStock: z.number().int().min(0).default(5),
  idealStock: z.number().int().min(0).default(20),
  initialStock: z.number().int().min(0).default(0),
  locationId: z.string().optional(),
});

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 50);
    const categoryId = req.query.categoryId as string | undefined;

    const whereConditions: any[] = [{ isActive: true }];

    if (categoryId && categoryId !== 'ALL') {
      whereConditions.push({
        OR: [
          { categoryId: categoryId },
          { subcategoryId: categoryId },
        ],
      });
    }

    if (params.search) {
      whereConditions.push({
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { sku: { contains: params.search, mode: 'insensitive' } },
          { barcode: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
          { location: { contains: params.search, mode: 'insensitive' } },
        ],
      });
    }

    const whereClause = { AND: whereConditions };

    const [total, products] = await Promise.all([
      prisma.product.count({ where: whereClause }),
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
          suppliers: { select: { id: true, companyName: true, code: true } },
          locationStocks: {
            include: { location: { select: { name: true } } },
          },
        },
        orderBy: params.sortBy
          ? { [params.sortBy]: params.sortOrder }
          : { name: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(products, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createProductSchema.parse(req.body);

    const existingSku = await prisma.product.findUnique({
      where: { sku: data.sku.trim() },
    });
    if (existingSku) {
      res.status(400).json({ success: false, message: `El SKU "${data.sku}" ya existe en el sistema` });
      return;
    }

    const cleanBarcode =
      data.barcode && data.barcode.trim() !== '' && data.barcode.trim() !== '-'
        ? data.barcode.trim()
        : null;

    if (cleanBarcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: cleanBarcode },
      });
      if (existingBarcode) {
        res.status(400).json({
          success: false,
          message: `El código de barras "${cleanBarcode}" ya está registrado en otro producto`,
        });
        return;
      }
    }

    // Asegurar ubicación de stock
    let locationId = data.locationId;
    if (!locationId) {
      let defaultLoc = await prisma.stockLocation.findFirst({ where: { isDefault: true } });
      if (!defaultLoc) {
        defaultLoc = await prisma.stockLocation.findFirst();
      }
      if (!defaultLoc) {
        defaultLoc = await prisma.stockLocation.create({
          data: {
            name: 'Depósito Central',
            isDefault: true,
          },
        });
      }
      locationId = defaultLoc.id;
    }

    // Validar si el userId existe en la base de datos para no violar Foreign Key
    let validUserId: string | null = null;
    if (req.user?.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          sku: data.sku.trim(),
          barcode: cleanBarcode,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          location: data.location?.trim() || null,
          categoryId: data.categoryId || null,
          subcategoryId: data.subcategoryId || null,
          brandId: data.brandId || null,
          unitId: data.unitId || null,
          costPrice: data.costPrice,
          salePrice: data.salePrice,
          iva: data.iva,
          minStock: data.minStock,
          idealStock: data.idealStock,
          currentStock: data.initialStock,
          suppliers:
            data.supplierIds && data.supplierIds.length > 0
              ? { connect: data.supplierIds.map((id) => ({ id })) }
              : undefined,
        },
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
          suppliers: { select: { id: true, companyName: true, code: true } },
        },
      });

      if (locationId && data.initialStock > 0) {
        await tx.locationStock.create({
          data: {
            productId: p.id,
            locationId,
            quantity: data.initialStock,
          },
        });

        const movementCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
        await tx.stockMovement.create({
          data: {
            code: movementCode,
            type: 'AJUSTE_POSITIVO',
            destLocationId: locationId,
            reference: 'Stock Inicial',
            notes: 'Carga de stock inicial de producto',
            userId: validUserId,
            items: {
              create: {
                productId: p.id,
                quantity: data.initialStock,
                unitCost: data.costPrice,
              },
            },
          },
        });
      }

      return p;
    });

    res.status(201).json({ success: true, message: 'Producto creado exitosamente', data: product });
  } catch (error: any) {
    console.error('Error en createProduct:', error);
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Error interno al crear el producto',
    });
  }
}

const updateProductSchema = z.object({
  sku: z.string().min(2, 'El SKU debe tener al menos 2 caracteres').optional(),
  barcode: z.string().optional().nullable(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  subcategoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  costPrice: z.number().min(0, 'El precio de costo no puede ser negativo').optional(),
  salePrice: z.number().min(0, 'El precio de venta no puede ser negativo').optional(),
  iva: z.number().min(0, 'La alícuota de IVA no puede ser negativa').optional(),
  supplierIds: z.array(z.string()).optional(),
  minStock: z.number().int().min(0).optional(),
  idealStock: z.number().int().min(0).optional(),
});

export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateProductSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    if (data.sku && data.sku.trim() !== product.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: data.sku.trim(), id: { not: id } },
      });
      if (existingSku) {
        res.status(400).json({ success: false, message: `El SKU "${data.sku}" ya está registrado en otro producto` });
        return;
      }
    }

    const cleanBarcode =
      data.barcode && data.barcode.trim() !== '' && data.barcode.trim() !== '-'
        ? data.barcode.trim()
        : null;

    if (cleanBarcode && cleanBarcode !== product.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode: cleanBarcode, id: { not: id } },
      });
      if (existingBarcode) {
        res.status(400).json({
          success: false,
          message: `El código de barras "${cleanBarcode}" ya está registrado en otro producto`,
        });
        return;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: data.sku ? data.sku.trim() : undefined,
        barcode: data.barcode !== undefined ? cleanBarcode : undefined,
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        location: data.location !== undefined ? (data.location?.trim() || null) : undefined,
        categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
        subcategoryId: data.subcategoryId !== undefined ? (data.subcategoryId || null) : undefined,
        brandId: data.brandId !== undefined ? (data.brandId || null) : undefined,
        unitId: data.unitId !== undefined ? (data.unitId || null) : undefined,
        costPrice: data.costPrice !== undefined ? data.costPrice : undefined,
        salePrice: data.salePrice !== undefined ? data.salePrice : undefined,
        iva: data.iva !== undefined ? data.iva : undefined,
        minStock: data.minStock !== undefined ? data.minStock : undefined,
        idealStock: data.idealStock !== undefined ? data.idealStock : undefined,
        suppliers:
          data.supplierIds !== undefined
            ? { set: data.supplierIds.map((sId) => ({ id: sId })) }
            : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, symbol: true } },
        suppliers: { select: { id: true, companyName: true, code: true } },
      },
    });

    res.json({ success: true, message: `Producto "${updated.name}" actualizado exitosamente`, data: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos de actualización inválidos' });
      return;
    }
    next(error);
  }
}

export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        recipeItemsAsMaterial: true,
      },
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    if (product.recipeItemsAsMaterial.length > 0) {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar este producto porque forma parte de la receta de fabricación de otro producto',
      });
      return;
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: `Producto "${product.name}" eliminado del catálogo` });
  } catch (error) {
    next(error);
  }
}

export async function getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { isActive: true },
          include: {
            _count: { select: { products: true, subProducts: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: true, subProducts: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

const createCategorySchema = z.object({
  name: z.string().min(2, 'El nombre de la categoría debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
});

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createCategorySchema.parse(req.body);
    const trimmedName = data.name.trim();
    const parentId = data.parentId ? data.parentId.trim() : null;

    if (parentId) {
      const parentCat = await prisma.category.findFirst({
        where: { id: parentId, isActive: true },
      });
      if (!parentCat) {
        res.status(400).json({ success: false, message: 'La categoría principal seleccionada no existe o no está activa' });
        return;
      }
    }

    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        parentId: parentId,
      },
    });

    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.category.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            description: data.description?.trim() || existing.description,
          },
        });
        res.status(200).json({
          success: true,
          message: parentId ? 'Subcategoría reactivada exitosamente' : 'Categoría reactivada exitosamente',
          data: updated,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: parentId
          ? `Ya existe una subcategoría con el nombre "${trimmedName}" en esta categoría`
          : `Ya existe una categoría principal con el nombre "${trimmedName}"`,
      });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        description: data.description?.trim() || null,
        parentId: parentId,
        isActive: true,
      },
      include: {
        parent: { select: { id: true, name: true } },
        children: { where: { isActive: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: parentId ? 'Subcategoría creada exitosamente' : 'Categoría creada exitosamente',
      data: category,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
      return;
    }
    next(error);
  }
}

const updateCategorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);

    const category = await prisma.category.findUnique({
      where: { id },
      include: { children: { where: { isActive: true } } },
    });

    if (!category || !category.isActive) {
      res.status(404).json({ success: false, message: 'Categoría no encontrada' });
      return;
    }

    const trimmedName = data.name !== undefined ? data.name.trim() : category.name;
    const parentId = data.parentId !== undefined ? (data.parentId ? data.parentId.trim() : null) : category.parentId;

    if (parentId && parentId === id) {
      res.status(400).json({ success: false, message: 'Una categoría no puede ser subcategoría de sí misma' });
      return;
    }

    if (parentId && category.children.length > 0) {
      res.status(400).json({ success: false, message: 'Una categoría con subcategorías no puede convertirse en subcategoría' });
      return;
    }

    if (trimmedName !== category.name || parentId !== category.parentId) {
      const duplicate = await prisma.category.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          parentId: parentId,
          id: { not: id },
          isActive: true,
        },
      });
      if (duplicate) {
        res.status(400).json({
          success: false,
          message: `Ya existe una categoría/subcategoría con el nombre "${trimmedName}"`,
        });
        return;
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: trimmedName,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        parentId: parentId,
      },
      include: {
        parent: { select: { id: true, name: true } },
        children: { where: { isActive: true } },
      },
    });

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: updated,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
      return;
    }
    next(error);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, subProducts: true } },
        children: {
          where: { isActive: true },
          include: {
            _count: { select: { products: true, subProducts: true } },
          },
        },
      },
    });

    if (!category) {
      res.status(404).json({ success: false, message: 'Categoría no encontrada' });
      return;
    }

    const totalDirectProducts = (category._count?.products || 0) + (category._count?.subProducts || 0);
    if (totalDirectProducts > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar "${category.name}" porque tiene ${totalDirectProducts} producto(s) vinculado(s).`,
      });
      return;
    }

    const activeChildren = category.children || [];
    const childrenWithProducts = activeChildren.filter(
      (c) => (c._count?.products || 0) + (c._count?.subProducts || 0) > 0
    );

    if (childrenWithProducts.length > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar "${category.name}" porque tiene subcategorías con productos vinculados.`,
      });
      return;
    }

    // Soft delete de la categoría y sus subcategorías activas
    await prisma.$transaction(async (tx) => {
      if (activeChildren.length > 0) {
        await tx.category.updateMany({
          where: { parentId: id, isActive: true },
          data: { isActive: false },
        });
      }
      await tx.category.update({
        where: { id },
        data: { isActive: false },
      });
    });

    res.json({
      success: true,
      message: `"${category.name}" eliminada exitosamente`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const criticalProducts: any[] = await prisma.$queryRaw`
      SELECT p.id, p.sku, p.name, p.location, p."costPrice", p."salePrice", p."minStock", p."idealStock", p."currentStock",
             c.name as "categoryName", u.symbol as "unitSymbol"
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c.id
      LEFT JOIN units_of_measure u ON p."unitId" = u.id
      WHERE p."isActive" = true AND p."currentStock" <= p."minStock"
      ORDER BY p."currentStock" ASC
    `;

    res.json({ success: true, data: criticalProducts });
  } catch (error) {
    next(error);
  }
}

export async function getStockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count(),
      prisma.stockMovement.findMany({
        include: {
          originLocation: { select: { name: true } },
          destLocation: { select: { name: true } },
          user: { select: { fullName: true } },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(movements, total, params),
    });
  } catch (error) {
    next(error);
  }
}
