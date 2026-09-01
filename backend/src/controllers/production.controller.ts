import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { parsePaginationParams, buildPaginatedResponse } from '../lib/pagination';
import { generateNextCode } from '../lib/sequence';

const recipeItemSchema = z.object({
  materialId: z.string().min(1, 'El material/insumo es requerido'),
  quantity: z.number().positive('La cantidad requerida debe ser mayor a 0'),
  notes: z.string().optional(),
});

const createOrUpdateRecipeSchema = z.object({
  productId: z.string().min(1, 'El producto a fabricar es requerido'),
  name: z.string().min(2, 'El nombre de la receta es requerido'),
  description: z.string().optional(),
  laborCost: z.number().min(0).default(0),
  otherCost: z.number().min(0).default(0),
  items: z.array(recipeItemSchema).min(1, 'La receta debe contener al menos 1 material o insumo'),
});

const createProductionOrderSchema = z.object({
  productId: z.string().min(1, 'El producto a fabricar es requerido'),
  quantity: z.number().int().positive('La cantidad a fabricar debe ser mayor a 0'),
  locationId: z.string().optional(),
  notes: z.string().optional(),
  autoComplete: z.boolean().optional().default(false),
});

// ============================================================================
// RECETAS / BOM (LISTA DE MATERIALES)
// ============================================================================

export async function getRecipes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const recipes = await prisma.productRecipe.findMany({
      where: { isActive: true },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            costPrice: true,
            salePrice: true,
            currentStock: true,
            unit: { select: { symbol: true, name: true } },
          },
        },
        items: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                currentStock: true,
                unit: { select: { symbol: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedRecipes = recipes.map((r) => {
      const materialsCost = r.items.reduce(
        (acc, item) => acc + Number(item.material.costPrice) * Number(item.quantity),
        0
      );
      const totalEstimatedUnitCost = materialsCost + Number(r.laborCost) + Number(r.otherCost);

      return {
        ...r,
        materialsCost,
        totalEstimatedUnitCost,
      };
    });

    res.json({ success: true, data: enrichedRecipes });
  } catch (error) {
    next(error);
  }
}

export async function getRecipeByProductId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId } = req.params;

    const recipe = await prisma.productRecipe.findUnique({
      where: { productId },
      include: {
        product: {
          select: { id: true, sku: true, name: true, costPrice: true, salePrice: true, currentStock: true },
        },
        items: {
          include: {
            material: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                currentStock: true,
                unit: { select: { symbol: true } },
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      res.status(404).json({ success: false, message: 'El producto no tiene una receta configurada' });
      return;
    }

    res.json({ success: true, data: recipe });
  } catch (error) {
    next(error);
  }
}

export async function createOrUpdateRecipe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createOrUpdateRecipeSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      res.status(404).json({ success: false, message: 'Producto final no encontrado' });
      return;
    }

    // Validar que el producto final no esté incluido dentro de sus propios materiales
    const hasSelfMaterial = data.items.some((it) => it.materialId === data.productId);
    if (hasSelfMaterial) {
      res.status(400).json({ success: false, message: 'Un producto no puede ser material de su propia receta' });
      return;
    }

    const recipe = await prisma.$transaction(async (tx) => {
      const existing = await tx.productRecipe.findUnique({
        where: { productId: data.productId },
      });

      if (existing) {
        // Eliminar items anteriores
        await tx.productRecipeItem.deleteMany({
          where: { recipeId: existing.id },
        });

        // Actualizar receta
        return await tx.productRecipe.update({
          where: { id: existing.id },
          data: {
            name: data.name.trim(),
            description: data.description?.trim() || null,
            laborCost: data.laborCost,
            otherCost: data.otherCost,
            items: {
              create: data.items.map((item) => ({
                materialId: item.materialId,
                quantity: item.quantity,
                notes: item.notes?.trim() || null,
              })),
            },
          },
          include: {
            items: { include: { material: true } },
          },
        });
      } else {
        // Crear nueva receta
        return await tx.productRecipe.create({
          data: {
            productId: data.productId,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            laborCost: data.laborCost,
            otherCost: data.otherCost,
            items: {
              create: data.items.map((item) => ({
                materialId: item.materialId,
                quantity: item.quantity,
                notes: item.notes?.trim() || null,
              })),
            },
          },
          include: {
            items: { include: { material: true } },
          },
        });
      }
    });

    res.status(201).json({
      success: true,
      message: 'Receta de materiales guardada exitosamente',
      data: recipe,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos de receta inválidos' });
      return;
    }
    next(error);
  }
}

export async function deleteRecipe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const recipe = await prisma.productRecipe.findUnique({
      where: { id },
      include: {
        productionOrders: {
          where: { status: { in: ['PLANIFICADA', 'EN_PROCESO'] } },
        },
      },
    });

    if (!recipe) {
      res.status(404).json({ success: false, message: 'Receta no encontrada' });
      return;
    }

    if (recipe.productionOrders.length > 0) {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar la receta porque tiene órdenes de producción activas',
      });
      return;
    }

    await prisma.productRecipe.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Receta eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ÓRDENES DE FABRICACIÓN / PRODUCCIÓN
// ============================================================================

export async function getProductionOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 50);
    const status = req.query.status as string | undefined;

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (params.search) {
      whereClause.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { product: { name: { contains: params.search, mode: 'insensitive' } } },
        { product: { sku: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.productionOrder.count({ where: whereClause }),
      prisma.productionOrder.findMany({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              currentStock: true,
              unit: { select: { symbol: true } },
            },
          },
          recipe: {
            select: { id: true, name: true },
          },
          location: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              material: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  currentStock: true,
                  unit: { select: { symbol: true } },
                },
              },
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
      ...buildPaginatedResponse(orders, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductionOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createProductionOrderSchema.parse(req.body);

    const recipe = await prisma.productRecipe.findUnique({
      where: { productId: data.productId },
      include: {
        items: {
          include: { material: true },
        },
      },
    });

    if (!recipe) {
      res.status(400).json({
        success: false,
        message: 'El producto seleccionado no tiene una receta de fabricación definida. Crea la receta primero.',
      });
      return;
    }

    // Determinar ubicación de stock
    let locationId = data.locationId;
    if (!locationId) {
      let defaultLoc = await prisma.stockLocation.findFirst({ where: { isDefault: true } });
      if (!defaultLoc) {
        defaultLoc = await prisma.stockLocation.findFirst();
      }
      if (!defaultLoc) {
        defaultLoc = await prisma.stockLocation.create({
          data: { name: 'Depósito Central', isDefault: true },
        });
      }
      locationId = defaultLoc.id;
    }

    // Validar usuario
    let validUserId: string | null = null;
    if (req.user?.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (userExists) validUserId = userExists.id;
    }

    // Calcular costos e insumos
    let totalMaterialsCost = 0;
    const orderItemsData = recipe.items.map((item) => {
      const requiredQty = Number(item.quantity) * data.quantity;
      const unitCost = Number(item.material.costPrice);
      const totalCost = unitCost * requiredQty;
      totalMaterialsCost += totalCost;

      return {
        materialId: item.materialId,
        quantityRequired: requiredQty,
        quantityConsumed: data.autoComplete ? requiredQty : 0,
        unitCost,
        totalCost,
      };
    });

    const totalOrderCost =
      totalMaterialsCost + (Number(recipe.laborCost) + Number(recipe.otherCost)) * data.quantity;
    const unitOrderCost = totalOrderCost / data.quantity;

    // Si se solicitó autocompletar / fabricar de inmediato, verificar stock previo
    if (data.autoComplete) {
      for (const item of recipe.items) {
        const requiredQty = Number(item.quantity) * data.quantity;
        if (item.material.currentStock < requiredQty) {
          res.status(400).json({
            success: false,
            message: `Stock insuficiente del material "${item.material.name}". Requerido: ${requiredQty}, Disponible: ${item.material.currentStock}`,
          });
          return;
        }
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const orderCode = await generateNextCode(tx, 'PRODUCTION_ORDER');

      const createdOrder = await tx.productionOrder.create({
        data: {
          code: orderCode,
          recipeId: recipe.id,
          productId: data.productId,
          quantity: data.quantity,
          status: data.autoComplete ? 'COMPLETADA' : 'PLANIFICADA',
          startDate: data.autoComplete ? new Date() : null,
          completedDate: data.autoComplete ? new Date() : null,
          totalCost: totalOrderCost,
          unitCost: unitOrderCost,
          locationId,
          userId: validUserId,
          notes: data.notes?.trim() || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          product: true,
          items: { include: { material: true } },
        },
      });

      // Si es autocompletada, procesar descuentos e ingresos de stock
      if (data.autoComplete) {
        // 1. Descontar materiales
        for (const item of recipe.items) {
          const requiredQty = Number(item.quantity) * data.quantity;

          // Descontar en Product
          await tx.product.update({
            where: { id: item.materialId },
            data: { currentStock: { decrement: requiredQty } },
          });

          // Descontar en LocationStock
          await tx.locationStock.upsert({
            where: {
              productId_locationId: {
                productId: item.materialId,
                locationId,
              },
            },
            update: { quantity: { decrement: requiredQty } },
            create: {
              productId: item.materialId,
              locationId,
              quantity: -requiredQty,
            },
          });

          // Registrar movimiento de salida por producción
          const movCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
          await tx.stockMovement.create({
            data: {
              code: movCode,
              type: 'CONSUMO_PRODUCCION',
              originLocationId: locationId,
              reference: `Orden ${createdOrder.code}`,
              notes: `Consumo de material para fabricar ${data.quantity} u. de ${createdOrder.product.name}`,
              userId: validUserId,
              items: {
                create: {
                  productId: item.materialId,
                  quantity: requiredQty,
                  unitCost: Number(item.material.costPrice),
                },
              },
            },
          });
        }

        // 2. Incrementar producto final fabricado
        await tx.product.update({
          where: { id: data.productId },
          data: {
            currentStock: { increment: data.quantity },
            costPrice: unitOrderCost > 0 ? unitOrderCost : undefined,
          },
        });

        await tx.locationStock.upsert({
          where: {
            productId_locationId: {
              productId: data.productId,
              locationId,
            },
          },
          update: { quantity: { increment: data.quantity } },
          create: {
            productId: data.productId,
            locationId,
            quantity: data.quantity,
          },
        });

        // Registrar movimiento de entrada por producción
        const movEntryCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
        await tx.stockMovement.create({
          data: {
            code: movEntryCode,
            type: 'ENTRADA_PRODUCCION',
            destLocationId: locationId,
            reference: `Orden ${createdOrder.code}`,
            notes: `Ingreso de ${data.quantity} u. fabricadas de ${createdOrder.product.name}`,
            userId: validUserId,
            items: {
              create: {
                productId: data.productId,
                quantity: data.quantity,
                unitCost: unitOrderCost,
              },
            },
          },
        });
      }

      return createdOrder;
    });

    res.status(201).json({
      success: true,
      message: data.autoComplete
        ? `Orden ${order.code} completada y stock actualizado exitosamente`
        : `Orden de fabricación ${order.code} registrada con éxito`,
      data: order,
    });
  } catch (error: any) {
    console.error('Error en createProductionOrder:', error);
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos de orden inválidos' });
      return;
    }
    next(error);
  }
}

export async function completeProductionOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        items: { include: { material: true } },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Orden de fabricación no encontrada' });
      return;
    }

    if (order.status === 'COMPLETADA') {
      res.status(400).json({ success: false, message: 'Esta orden ya fue completada previamente' });
      return;
    }
    if (order.status === 'CANCELADA') {
      res.status(400).json({ success: false, message: 'No se puede completar una orden cancelada' });
      return;
    }

    // Validar disponibilidad de stock de todos los materiales
    for (const item of order.items) {
      const required = Number(item.quantityRequired);
      if (item.material.currentStock < required) {
        res.status(400).json({
          success: false,
          message: `Stock insuficiente de "${item.material.name}". Requerido: ${required}, Disponible: ${item.material.currentStock}`,
        });
        return;
      }
    }

    const locationId =
      order.locationId ||
      (await prisma.stockLocation.findFirst({ where: { isDefault: true } }))?.id ||
      (await prisma.stockLocation.findFirst())?.id;

    if (!locationId) {
      res.status(400).json({ success: false, message: 'No se encontró un depósito de stock válido' });
      return;
    }

    let validUserId: string | null = null;
    if (req.user?.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (userExists) validUserId = userExists.id;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Descontar materiales
      for (const item of order.items) {
        const qty = Number(item.quantityRequired);

        await tx.product.update({
          where: { id: item.materialId },
          data: { currentStock: { decrement: qty } },
        });

        await tx.locationStock.upsert({
          where: {
            productId_locationId: {
              productId: item.materialId,
              locationId,
            },
          },
          update: { quantity: { decrement: qty } },
          create: {
            productId: item.materialId,
            locationId,
            quantity: -qty,
          },
        });

        // Registrar consumo en kárdex
        const movCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
        await tx.stockMovement.create({
          data: {
            code: movCode,
            type: 'CONSUMO_PRODUCCION',
            originLocationId: locationId,
            reference: `Orden ${order.code}`,
            notes: `Consumo para fabricar ${order.quantity} u. de ${order.product.name}`,
            userId: validUserId,
            items: {
              create: {
                productId: item.materialId,
                quantity: qty,
                unitCost: Number(item.unitCost),
              },
            },
          },
        });

        // Actualizar item de orden como consumido
        await tx.productionOrderItem.update({
          where: { id: item.id },
          data: { quantityConsumed: qty },
        });
      }

      // 2. Incrementar producto final
      await tx.product.update({
        where: { id: order.productId },
        data: {
          currentStock: { increment: order.quantity },
          costPrice: Number(order.unitCost) > 0 ? order.unitCost : undefined,
        },
      });

      await tx.locationStock.upsert({
        where: {
          productId_locationId: {
            productId: order.productId,
            locationId,
          },
        },
        update: { quantity: { increment: order.quantity } },
        create: {
          productId: order.productId,
          locationId,
          quantity: order.quantity,
        },
      });

      // Registrar entrada en kárdex
      const movEntryCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
      await tx.stockMovement.create({
        data: {
          code: movEntryCode,
          type: 'ENTRADA_PRODUCCION',
          destLocationId: locationId,
          reference: `Orden ${order.code}`,
          notes: `Ingreso de ${order.quantity} u. fabricadas de ${order.product.name}`,
          userId: validUserId,
          items: {
            create: {
              productId: order.productId,
              quantity: order.quantity,
              unitCost: order.unitCost,
            },
          },
        },
      });

      // 3. Finalizar orden
      await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETADA',
          completedDate: new Date(),
        },
      });
    });

    res.json({
      success: true,
      message: `Fabricación de orden ${order.code} completada. Stocks de materiales e inventario final actualizados.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelProductionOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Orden de producción no encontrada' });
      return;
    }

    if (order.status === 'COMPLETADA') {
      res.status(400).json({ success: false, message: 'No se puede cancelar una orden ya completada' });
      return;
    }

    await prisma.productionOrder.update({
      where: { id },
      data: { status: 'CANCELADA' },
    });

    res.json({ success: true, message: `Orden ${order.code} cancelada exitosamente` });
  } catch (error) {
    next(error);
  }
}
