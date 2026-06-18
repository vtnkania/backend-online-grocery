import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateOrderInput {
  userId: string;
  courierCompany: string;
  courierName: string;
  shippingCost: number;
}

// Feature Customer: Membuat Pesanan Baru Berdasarkan Isi Keranjang Belanja (100% Dinamis)
export const createOrderService = async (data: CreateOrderInput) => {
  // 1. Ambil data keranjang user beserta item-item di dalamnya lengkap dengan gambar asli
  const userCart = await prisma.cart.findFirst({
    where: { userId: data.userId },
    include: { 
      items: { 
        include: { 
          product: {
            include: {
              productImages: true // 👈 Menyertakan relasi gambar Cloudinary yang sukses kita perbaiki
            }
          } 
        } 
      } 
    }
  });

  if (!userCart || userCart.items.length === 0) {
    throw new Error("Keranjang belanja kosong, tidak bisa membuat pesanan!");
  }

  // Ambil storeId dari item pertama di dalam keranjang belanja user
  const targetStoreId = userCart.items[0].storeId;

  // 2. Ambil alamat utama (isPrimary) user untuk direlasikan ke order
  const primaryAddress = await prisma.address.findFirst({
    where: { 
      userId: data.userId,
      isPrimary: true,
      deletedAt: null
    }
  });

  if (!primaryAddress) {
    throw new Error("Gagal membuat pesanan. User belum memiliki alamat utama!");
  }

  // 3. Hitung total harga produk murni (SUB TOTAL)
  let totalProductPrice = 0;
  userCart.items.forEach((item) => {
    const currentPrice = Number(item.priceSnapshot) || Number(item.product.price);
    totalProductPrice += currentPrice * item.quantity;
  });

  // 4. Hitung Grand Total (Subtotal + Ongkir)
  const grandTotal = totalProductPrice + Number(data.shippingCost);

  // 5. Jalankan Database Transaction secara aman
  return await prisma.$transaction(async (tx) => {
    
    // A. Buat data induk Order terlebih dahulu (Sesuai skema relasi database asli timmu)
    const newOrder = await tx.order.create({
      data: {
        user: {
          connect: { id: data.userId }
        },
        address: {
          connect: { id: primaryAddress.id }
        },
        store: {
          connect: { id: targetStoreId }
        },
        subtotal: new Prisma.Decimal(totalProductPrice),
        shippingCost: new Prisma.Decimal(data.shippingCost),
        totalAmount: new Prisma.Decimal(grandTotal)
      }
    });

    // B. Buat data Shipping terpisah (Menggunakan data kurir dari frontend)
    await tx.shipping.create({
      data: {
        order: {
          connect: { id: newOrder.id }
        },
        courier: data.courierCompany,
        service: data.courierName,
        shippingCost: new Prisma.Decimal(data.shippingCost),
        originStore: {
          connect: { id: targetStoreId }
        },
        destinationAddress: {
          connect: { id: primaryAddress.id }
        }
      }
    });

    // C. Persiapkan item data untuk dipindahkan ke tabel OrderItem
    const orderItemsData = userCart.items.map((item) => {
      const itemPrice = Number(item.priceSnapshot);
      const itemSubtotal = itemPrice * item.quantity;
      
      return {
        orderId: newOrder.id,
        productId: item.productId,
        productName: item.product?.name || "Grocery Item",
        quantity: item.quantity,
        priceSnapshot: new Prisma.Decimal(itemPrice),
        subtotal: new Prisma.Decimal(itemSubtotal)
      };
    });

    // Eksekusi insert batch ke tabel orderItem
    await tx.orderItem.createMany({
      data: orderItemsData
    });

    // 6. Kosongkan item keranjang belanja user setelah sukses order
    await tx.cartItem.deleteMany({
      where: { cartId: userCart.id }
    });

    // Ambil data order lengkap beserta relasinya untuk dilempar balik ke frontend
    return await tx.order.findUnique({
      where: { id: newOrder.id },
      include: { items: true, shipping: true }
    });
  }, {
    timeout: 20000
  });
};

// Feature: Ambil Semua Riwayat Order milik User tertentu
export const getUserOrdersHistoryService = async (userId: string) => {
  if (!userId) {
    throw new Error("userId wajib disertakan untuk melihat riwayat!");
  }

  return await prisma.order.findMany({
    where: { userId },
    include: {
      items: true,    
      shipping: true, 
    },
    orderBy: {
      createdAt: 'desc' 
    }
  });
};

// Feature Customer: Mengonfirmasi bahwa barang telah sampai di tangan pembeli
export const completeOrderService = async (orderId: string) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  if (existingOrder.status !== "SHIPPED") {
    throw new Error("Pesanan tidak dapat diselesaikan karena statusnya belum dikirim kurir!");
  }

  return await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "DELIVERED"
    }
  });
};

// Feature Customer: Membatalkan pesanan secara mandiri (Hanya jika belum bayar!)
export const cancelOrderService = async (orderId: string) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  if (existingOrder.status !== "WAITING_PAYMENT") {
    throw new Error("Pesanan tidak dapat dibatalkan karena pembayaran telah diverifikasi atau barang sedang diproses!");
  }

  return await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED"
    }
  });
};