import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Bersihkan sisa data lama agar tidak duplikat/bentrok
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Buat User Contoh (ID disamakan dengan controller frontend/backend)
  const user = await prisma.user.create({
    data: {
      id: "c2ab071d-03b2-4343-a842-210d4e208d89",
      name: "Bagus Tester",
      email: "bagus@example.com",
      password: "password123",
      role: "CUSTOMER"
    }
  });

  // 3. Buat Alamat Utama User
  await prisma.address.create({
    data: {
      userId: user.id,
      label: "Rumah Utama",
      receiver: "Bagus",
      phone: "08123456789",
      address: "Jl. Merdeka No. 45, RT 01/RW 02",
      province: "Banten",
      city: "Tangerang Kota",
      district: "Cipondoh",
      latitude: -6.225,
      longitude: 106.671,
      isPrimary: true
    }
  });

  // 4. Buat Contoh Toko Cabang Terdekat
  const store = await prisma.store.create({
    data: {
      name: "Toko Cabang Tangerang",
      address: "Jl. Grand Serpong No. 12, Tangerang",
      latitude: -6.222,
      longitude: 106.649
    }
  });

  // 5. Buat Kategori Produk
  const category = await prisma.category.create({
    data: { name: "Bahan Makanan Segar" }
  });

  // 6. Buat 2 Produk Contoh (Satu Ada Stok, Satu Habis)
  const produk1 = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: "Apel Fuji Segar 1kg",
      slug: "apel-fuji-segar-1kg",
      price: 45000,
      isActive: true
    }
  });

  const produk2 = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: "Susu UHT Full Cream 1L",
      slug: "susu-uht-full-cream-1l",
      price: 19500,
      isActive: true
    }
  });

  // 7. Isikan Stok ke Inventory Toko
  await prisma.inventory.create({
    data: { storeId: store.id, productId: produk1.id, stock: 15 }
  });

  await prisma.inventory.create({
    data: { storeId: store.id, productId: produk2.id, stock: 0 }
  });

  console.log("🌱 Database Seeding Komplit: User, Alamat, Toko, & Produk Siap Digunakan!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });