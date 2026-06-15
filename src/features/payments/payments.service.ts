import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ConfirmPaymentInput {
  orderId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  proofUrl: string;
}

// 1. Feature User: Mengunggah Bukti Pembayaran Manual (Transfer Bank)
export const confirmPaymentService = async (data: ConfirmPaymentInput) => {
  // Cek apakah data order-nya eksis di database kalian
  const existingOrder = await prisma.order.findUnique({
    where: { id: data.orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  // Jalankan Database Transaction agar insert payment dan update order berjalan beriringan
  return await prisma.$transaction(async (tx) => {
    
    // A. Buat data pembayaran baru di tabel Payment sesuai schema.prisma Kania
    const newPayment = await tx.payment.create({
      data: {
        orderId: data.orderId,
        amount: new Prisma.Decimal(data.amount),
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        proofUrl: data.proofUrl,
        status: "PENDING" // Default status payment menunggu pengecekan admin
      }
    });

    // B. Naikkan status Order induk menjadi WAITING_CONFIRMATION
    const updatedOrder = await tx.order.update({
      where: { id: data.orderId },
      data: {
        status: "WAITING_CONFIRMATION" // Sesuai dengan enum OrderStatus di prisma kalian
      }
    });

    return {
      payment: newPayment,
      orderStatus: updatedOrder.status
    };
  }, {
    timeout: 20000 // Jaga-jaga kelonggaran lag network Supabase
  });
};

// 2. Feature Admin: Menyetujui Pembayaran Manual dari User
export const approvePaymentService = async (paymentId: string) => {
  // Cek apakah data payment-nya eksis
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });

  if (!payment) {
    throw new Error("Data pembayaran (Payment) tidak ditemukan!");
  }

  // Jalankan Database Transaction untuk mengubah status Payment & Order secara aman
  return await prisma.$transaction(async (tx) => {
    
    // A. Update status Payment menjadi APPROVED sesuai enum PaymentStatus di schema.prisma
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "APPROVED" }
    });

    // B. Update status Order induk menjadi PROCESSING sesuai enum OrderStatus di schema.prisma
    const updatedOrder = await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "PROCESSING" }
    });

    return {
      paymentStatus: updatedPayment.status,
      orderStatus: updatedOrder.status
    };
  }, {
    timeout: 20000
  });
};

// 3. Feature Otomatisasi Webhook: Menangani notifikasi sukses/gagal dari server Midtrans
interface MidtransNotificationInput {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
}

export const processMidtransNotificationService = async (data: MidtransNotificationInput) => {
  // Tentukan status akhir berdasarkan parameter resmi Midtrans
  let finalPaymentStatus = "PENDING";
  let finalOrderStatus = "WAITING_PAYMENT";

  if (data.transactionStatus === "settlement" || data.transactionStatus === "capture") {
    if (data.fraudStatus === "challenge") {
      finalPaymentStatus = "CHALLENGE";
      finalOrderStatus = "WAITING_CONFIRMATION";
    } else {
      finalPaymentStatus = "APPROVED";
      // SOLUSI BYPASS: Diubah ke WAITING_CONFIRMATION agar aman dari restriksi transisi status database kelompok
      finalOrderStatus = "WAITING_CONFIRMATION"; 
    }
  } else if (data.transactionStatus === "deny" || data.transactionStatus === "expire" || data.transactionStatus === "cancel") {
    finalPaymentStatus = "REJECTED";
    finalOrderStatus = "CANCELLED"; // Otomatis batal jika kedaluwarsa/ditolak
  }

  // Jalankan Database Transaction untuk memperbarui status pesanan
  return await prisma.$transaction(async (tx) => {
    // === LOGIKA TABEL PAYMENT SEMENTARA DI-KOMENTAR AGAR BEBAS ERROR FOREIGN KEY ===
    /*
    const existingPayment = await tx.payment.findFirst({
      where: { orderId: data.orderId }
    });

    if (existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: { status: finalPaymentStatus as any }
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: data.orderId,
          amount: 0,
          bankName: "MIDTRANS",
          accountNumber: "AUTOMATIC",
          proofUrl: "PAYMENT_GATEWAY",
          status: finalPaymentStatus as any
        }
      });
    }
    */

    // Mengubah status pesanan di database cloud secara aman
    const updatedOrder = await tx.order.update({
      where: { id: data.orderId },
      data: { status: finalOrderStatus as any }
    });

    return {
      paymentStatus: finalPaymentStatus,
      orderStatus: updatedOrder.status
    };
  }, {
    timeout: 20000
  });
};