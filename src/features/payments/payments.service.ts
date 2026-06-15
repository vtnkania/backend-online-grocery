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
  const existingOrder = await prisma.order.findUnique({
    where: { id: data.orderId }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  return await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
      data: {
        orderId: data.orderId,
        amount: new Prisma.Decimal(data.amount),
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        proofUrl: data.proofUrl,
        status: "PENDING"
      }
    });

    const updatedOrder = await tx.order.update({
      where: { id: data.orderId },
      data: {
        status: "WAITING_CONFIRMATION"
      }
    });

    return {
      payment: newPayment,
      orderStatus: updatedOrder.status
    };
  }, {
    timeout: 20000
  });
};

// 2. Feature Admin: Menyetujui Pembayaran Manual dari User
export const approvePaymentService = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });

  if (!payment) {
    throw new Error("Data pembayaran (Payment) tidak ditemukan!");
  }

  return await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "APPROVED" }
    });

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
  let finalPaymentStatus = "PENDING";
  let finalOrderStatus = "WAITING_PAYMENT";

  if (data.transactionStatus === "settlement" || data.transactionStatus === "capture") {
    if (data.fraudStatus === "challenge") {
      finalPaymentStatus = "CHALLENGE";
      finalOrderStatus = "WAITING_CONFIRMATION";
    } else {
      finalPaymentStatus = "APPROVED";
      finalOrderStatus = "WAITING_CONFIRMATION"; 
    }
  } else if (data.transactionStatus === "deny" || data.transactionStatus === "expire" || data.transactionStatus === "cancel") {
    finalPaymentStatus = "REJECTED";
    finalOrderStatus = "CANCELLED";
  }

  return await prisma.$transaction(async (tx) => {
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

// 4. SOLUSI FIX AMAN: Tembak Langsung Menggunakan Native HTTP Fetch ke Snap API
export const createMidtransQrisService = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new Error("Data pesanan tidak ditemukan di database!");
  }

  // Parameter transaksi Snap
  const parameter = {
    transaction_details: {
      order_id: order.id,
      gross_amount: Number(order.totalAmount || 64000)
    },
    // Membatasi opsi pembayaran di lembar Snap agar langsung memuat metode QRIS & GoPay
    enabled_payments: ["gopay", "qris"]
  };

  // Menggunakan teks murni yang sudah terverifikasi dari dashboard sandbox kalian
  const serverKey = "Mid-server-v6kWx9SfNwHP92N4LjwhFI49";
  
  // Enkripsi otomatis menggunakan template literal bawaan Node.js
  const base64AuthToken = Buffer.from(`${serverKey}:`).toString('base64');

  // Request langsung menggunakan fetch bawaan Node.js
  const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64AuthToken}`
    },
    body: JSON.stringify(parameter)
  });

  const transaction: any = await response.json();

  // Tangani jika ada pesan error dari response Snap
  if (transaction.error_messages) {
    throw new Error(`Snap API Error: ${transaction.error_messages[0]}`);
  }

  return {
    transactionId: order.id,
    // Mengembalikan properti redirect_url bawaan Snap
    qrUrl: transaction.redirect_url,
    status: "pending"
  };
};