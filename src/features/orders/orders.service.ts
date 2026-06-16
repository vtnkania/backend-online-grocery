import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateOrderInput {
  userId: string;
  courierCompany: string;
  courierName: string;
  shippingCost: number;
}

export const createOrderService = async (data: CreateOrderInput) => {
  // 1. Ambil data keranjang user beserta item-item di dalamnya
  const userCart = await prisma.cart.findFirst({
    where: { userId: data.userId },
    include: { 
      items: { 
        include: { 
          product: {
            select: { name: true }
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
    totalProductPrice += Number(item.priceSnapshot) * item.quantity;
  });

  // 4. Hitung Grand Total (Subtotal + Ongkir)
  const grandTotal = totalProductPrice + Number(data.shippingCost);

  // 5. Jalankan Database Transaction secara mandiri
  return await prisma.$transaction(async (tx) => {
    
    // Suplai data finansial + Operator Connect User, Address, dan Store demi meloloskan validasi database!
    const coreOrderData: any = {
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
    };

    // A. Buat data induk Order terlebih dahulu
    const newOrder = await tx.order.create({
      data: coreOrderData
    });

    // B. Buat data Shipping terpisah (DENGAN CONNECT ORDER RESMI!)
    await tx.shipping.create({
      data: {
        // KUNCI UTAMA: Hubungkan secara resmi menggunakan properti objek 'order' lewat connect!
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
      } as any
    });

    // C. Buat semua data OrderItem secara terpisah
    const orderItemsData = userCart.items.map((item: any) => {
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

    // Ambil data order lengkap beserta relasinya untuk dikembalikan ke Postman
    return await tx.order.findUnique({
      where: { id: newOrder.id },
      include: { items: true, shipping: true }
    });
  }, {
    timeout: 20000 // <--- SELIPKAN DI SINI, BAGUS!
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
      items: true,    // Sertakan daftar barang yang dibeli
      shipping: true, // Sertakan status pengiriman kurir
    },
    orderBy: {
      createdAt: 'desc' // Urutkan dari pesanan yang paling terbaru
    }
  });
};

// Feature Customer: Mengonfirmasi bahwa barang telah sampai di tangan pembeli
export const completeOrderService = async (orderId: string) => {
  // 1. Cek apakah data ordernya eksis
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  if (existingOrder.status !== "SHIPPED") {
    throw new Error("Pesanan tidak dapat diselesaikan karena statusnya belum dikirim kurir!");
  }

  // 2. Update status Order langsung menjadi DELIVERED sesuai enum OrderStatus Kania
  return await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "DELIVERED"
    }
  });
};

// Feature Customer: Membalkan pesanan secara mandiri (Hanya jika belum bayar!)
export const cancelOrderService = async (orderId: string) => {
  // 1. Cek apakah data ordernya eksis
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  // 2. Validasi bisnis: Jangan sampai admin rugi karena user nge-cancel pesanan yang sudah diproses/dikirim!
  if (existingOrder.status !== "WAITING_PAYMENT") {
    throw new Error("Pesanan tidak dapat dibatalkan karena pembayaran telah diverifikasi atau barang sedang diproses!");
  }

  // 3. Update status Order langsung menjadi CANCELLED sesuai enum OrderStatus Kania
  return await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED"
    }
  });
};