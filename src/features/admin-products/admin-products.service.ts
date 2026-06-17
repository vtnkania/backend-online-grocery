import slugify from 'slugify';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { assertAdminUser, resolveReadableStores } from '@/features/admin/admin-access';
import { uploadProductImages } from './admin-product-upload';
import type { ProductBodyInput, ProductListInput, ProductUpdateInput } from './admin-products.validation';

type UserPayload = { id: string; role: string };

const includeProduct = {
  category: true,
  productImages: { orderBy: { createdAt: 'asc' as const } },
  inventories: { include: { store: true }, orderBy: { updatedAt: 'desc' as const } },
};

export const listProducts = async (rawUser: UserPayload | undefined, query: ProductListInput) => {
  const user = assertAdminUser(rawUser);
  const storeIds = await resolveReadableStores(user, query.storeId);
  const where = productWhere(query, storeIds);
  const products = await getProductPage(where, query);
  const total = await productTotal(where);
  return { data: products.map(mapProduct), meta: meta(query, total) };
};

export const getProduct = async (rawUser: UserPayload | undefined, id: string) => {
  const user = assertAdminUser(rawUser);
  const storeIds = await resolveReadableStores(user);
  const product = await prisma.product.findFirst({ where: productDetailWhere(id, storeIds), include: includeProduct });
  if (!product) throw new ResponseError(StatusCodes.NOT_FOUND, 'Product not found.');
  return mapProduct(product);
};

export const createProduct = async (input: ProductBodyInput, files: Express.Multer.File[]) => {
  if (!files.length) throw new ResponseError(StatusCodes.BAD_REQUEST, 'At least one product image is required.');
  await ensureUniqueName(input.name);
  const urls = await uploadProductImages(files);
  return prisma.product.create({ data: createData(input, urls), include: includeProduct }).then(mapProduct);
};

export const updateProduct = async (id: string, input: ProductUpdateInput, files: Express.Multer.File[]) => {
  await ensureProductExists(id);
  if (input.name) await ensureUniqueName(input.name, id);
  const urls = await uploadProductImages(files);
  await addImages(id, urls);
  return prisma.product.update({ where: { id }, data: updateData(input), include: includeProduct }).then(mapProduct);
};

export const deleteProduct = async (id: string) => {
  await ensureProductExists(id);
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return { message: 'Product deleted.' };
};

export const getProductOptions = async () => {
  const [categories, stores] = await prisma.$transaction([
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.store.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
  ]);
  return { categories, stores };
};

const productWhere = (query: ProductListInput, storeIds?: string[]): Prisma.ProductWhereInput => ({
  deletedAt: null,
  ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  ...inventoryScope(storeIds, query.stockStatus),
});

const productDetailWhere = (id: string, storeIds?: string[]): Prisma.ProductWhereInput => ({
  id,
  deletedAt: null,
  ...(storeIds ? { inventories: { some: { storeId: { in: storeIds } } } } : {}),
});

const inventoryScope = (storeIds?: string[], stockStatus = 'all'): Prisma.ProductWhereInput => {
  const stock = stockFilter(stockStatus);
  if (!storeIds && !stock) return {};
  if (storeIds?.length === 0) return { id: '__no_access__' };
  return { inventories: { some: { ...(storeIds ? { storeId: { in: storeIds } } : {}), ...stock } } };
};

const stockFilter = (status: string): Prisma.InventoryWhereInput => {
  if (status === 'in') return { stock: { gt: 20 } };
  if (status === 'low') return { stock: { gt: 0, lte: 20 } };
  if (status === 'out') return { stock: 0 };
  return {};
};

const getProductPage = async (where: Prisma.ProductWhereInput, query: ProductListInput) => {
  if (query.sortBy === 'stock') return getStockSortedProducts(where, query);
  return prisma.product.findMany({
    where,
    include: includeProduct,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    orderBy: productOrder(query),
  });
};

const getStockSortedProducts = async (where: Prisma.ProductWhereInput, query: ProductListInput) => {
  const products = await prisma.product.findMany({ where, include: includeProduct });
  const sorted = products.sort((a, b) => stockOrder(a, b, query.sortOrder));
  return sorted.slice((query.page - 1) * query.limit, query.page * query.limit);
};

const stockOrder = (a: ProductRecord, b: ProductRecord, order: 'asc' | 'desc') => {
  const diff = totalStock(a) - totalStock(b);
  return order === 'asc' ? diff : -diff;
};

const productTotal = (where: Prisma.ProductWhereInput) => prisma.product.count({ where });

const productOrder = (query: ProductListInput): Prisma.ProductOrderByWithRelationInput => {
  if (query.sortBy === 'name') return { name: query.sortOrder };
  if (query.sortBy === 'price') return { price: query.sortOrder };
  return { createdAt: query.sortOrder };
};

const ensureUniqueName = async (name: string, excludeId?: string) => {
  const product = await prisma.product.findFirst({ where: uniqueNameWhere(name, excludeId) });
  if (product) throw new ResponseError(StatusCodes.CONFLICT, 'Product name already exists.');
};

const uniqueNameWhere = (name: string, excludeId?: string): Prisma.ProductWhereInput => ({
  name: { equals: name, mode: 'insensitive' },
  deletedAt: null,
  ...(excludeId ? { id: { not: excludeId } } : {}),
});

const ensureProductExists = async (id: string) => {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new ResponseError(StatusCodes.NOT_FOUND, 'Product not found.');
};

const createData = (input: ProductBodyInput, urls: string[]): Prisma.ProductCreateInput => ({
  category: { connect: { id: input.categoryId } },
  name: input.name,
  slug: slugify(input.name, { lower: true, strict: true }),
  description: input.description || null,
  price: new Prisma.Decimal(input.price),
  isActive: input.isActive,
  productImages: { create: urls.map((url) => ({ url })) },
});

const updateData = (input: ProductUpdateInput): Prisma.ProductUpdateInput => ({
  ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
  ...(input.name ? { name: input.name, slug: slugify(input.name, { lower: true, strict: true }) } : {}),
  ...(input.description !== undefined ? { description: input.description || null } : {}),
  ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
  ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
});

const addImages = async (productId: string, urls: string[]) => {
  if (!urls.length) return;
  await prisma.productImage.createMany({ data: urls.map((url) => ({ productId, url })) });
};

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof includeProduct }>;

const mapProduct = (product: ProductRecord) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price.toString(),
  isActive: product.isActive,
  category: { id: product.category.id, name: product.category.name },
  images: product.productImages.map((image) => ({ id: image.id, url: image.url })),
  stores: product.inventories.map(mapInventoryStore),
  totalStock: totalStock(product),
});

const mapInventoryStore = (inventory: ProductRecord['inventories'][number]) => ({
  inventoryId: inventory.id,
  storeId: inventory.storeId,
  storeName: inventory.store.name,
  stock: inventory.stock,
});

const totalStock = (product: ProductRecord) => product.inventories.reduce((sum, item) => sum + item.stock, 0);

const meta = (query: ProductListInput, total: number) => ({
  page: query.page,
  limit: query.limit,
  total,
  totalPages: Math.ceil(total / query.limit),
});
