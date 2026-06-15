import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BITESHIP_KEY = process.env.BITESHIP_API_KEY;
const BITESHIP_URL = 'https://api.biteship.com/v1/rates/couriers';

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface ShippingRequest {
  destLat: number;
  destLng: number;
  userId: string;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface StoreBranch {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// ==========================================
// ALGORITMA MATEMATIKA HAVERSINE (HITUNG JARAK)
// ==========================================
const calculateDistance = (coords1: Coordinate, coords2: Coordinate): number => {
  const EARTH_RADIUS_KM = 6371; // Jari-jari bumi

  const dLat = (coords2.latitude - coords1.latitude) * (Math.PI / 180);
  const dLng = (coords2.longitude - coords1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.latitude * (Math.PI / 180)) *
      Math.cos(coords2.latitude * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c; // Hasil akhir dalam Kilometer (KM)
};

// Fungsi menyisir daftar toko untuk mencari yang paling dekat
const findNearestStore = (userCoords: Coordinate, stores: StoreBranch[]): StoreBranch | null => {
  if (stores.length === 0) return null;

  let nearestStore: StoreBranch | null = null;
  let shortestDistance = Infinity;

  stores.forEach((store) => {
    const distance = calculateDistance(userCoords, {
      latitude: store.latitude,
      longitude: store.longitude,
    });

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestStore = store;
    }
  });

  return nearestStore;
};

// ==========================================
// CORE SHIPPING SERVICE
// ==========================================
export const getBiteshipRates = async (data: ShippingRequest) => {
  
  // 1. AMBIL DATA TOKO FISIK ASLI LANGSUNG DARI DATABASE POSTGRESQL/SUPABASE
  const dbStores = await prisma.store.findMany();

  // Mapping data dari DB agar tipenya cocok dengan parameter algoritma Haversine
  const storesForHaversine: StoreBranch[] = dbStores.map(store => ({
    id: store.id,
    name: store.name,
    latitude: Number(store.latitude),
    longitude: Number(store.longitude)
  }));

  // 2. JALANKAN RUMUS HAVERSINE: Otomatis cari toko terdekat dari lokasi koordinat tujuan customer
  const userLocation: Coordinate = { latitude: Number(data.destLat), longitude: Number(data.destLng) };
  const nearestStore = findNearestStore(userLocation, storesForHaversine);

  // Fallback koordinat jika database mendadak kosong (menggunakan titik default Cabang Tangerang Kania: -6.222, 106.649)
  const originLat = nearestStore ? nearestStore.latitude : -6.222;
  const originLng = nearestStore ? nearestStore.longitude : 106.649;

  if (nearestStore) {
    console.log(`🎯 [DATABASE HAVERSINE SUCCESS] Menemukan cabang terdekat langsung dari DB: ${nearestStore.name}`);
  } else {
    console.log(`⚠️ [HAVERSINE WARNING] Tidak ada toko ditemukan di database. Menggunakan koordinat fallback default.`);
  }

  // 3. AMBIL DATA KERANJANG USER UNTUK MENGAKUMULASIKAN BERAT DAN HARGA SNAPSHOT
  const userCart = await prisma.cart.findFirst({
    where: { userId: data.userId },
    include: { items: { include: { product: true } } }
  });

  let itemPayloads: any[] = [];

  if (userCart && userCart.items.length > 0) {
    userCart.items.forEach((item: any) => {
      const itemWeight = (item.product as any).weight || 200; 
      
      itemPayloads.push({
        name: item.product.name,
        description: item.product.description || 'Grocery Item',
        category: 'groceries',
        value: Number(item.priceSnapshot) || 25000, 
        weight: Number(itemWeight) / 1000, // Konversi gram ke KG karena aturan resmi dokumen Biteship
        length: 10,                        
        width: 10,
        height: 10,
        quantity: Number(item.quantity)
      });
    });
  } else {
    // Jalur Fallback Utama saat dites langsung di Postman (Simulasi keranjang kosong)
    itemPayloads.push({
      name: 'Apel Segar',
      description: 'Grocery Items',
      category: 'groceries',
      value: 50000,
      weight: 1, // 1 KG
      length: 20,
      width: 10,
      height: 10,
      quantity: 1
    });
  }

  // 4. RAKIT INTEGRASI PAYLOAD KE BITESHIP (Titik Keberangkatan / Origin dinamis dari hasil database Haversine)
  const payload = {
    origin_latitude: Number(originLat),
    origin_longitude: Number(originLng),
    destination_latitude: Number(data.destLat),
    destination_longitude: Number(data.destLng),
    couriers: 'gojek,grab,jne,sicepat,anteraja',
    items: itemPayloads
  };

  try {
    const cleanToken = String(BITESHIP_KEY).trim();
    const response = await axios.post(BITESHIP_URL, payload, {
      headers: { 
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json' 
      }
    });

    const results = response.data.results || [];

    // Jaring pengaman jika server sandbox lancar terkoneksi namun mengembalikan array kosong
    if (results.length === 0) {
      console.log("⚠️ [WARNING] Server Biteship Sandbox mengembalikan array kosong. Mengaktifkan data Mocking...");
      return [
        { company: "gojek", name: "GOJEK - Instant", type: "instant", rate: 21000, description: "Instant service for on demand needs.", duration: "1-2 HOURS" },
        { company: "grab", name: "GRAB - Instant", type: "instant", rate: 19000, description: "Instant service for on demand needs.", duration: "1-3 HOURS" },
        { company: "jne", name: "JNE Regular", type: "reg", rate: 10000, description: "Layanan reguler", duration: "1-2 DAYS" }
      ];
    }

    return results;

  } catch (error: any) {
    console.log("⚠️ [ERROR AXIOS] Terjadi kendala API. Mengaktifkan data Mocking lokal...");
    return [
      { company: "gojek", name: "GOJEK - Instant", type: "instant", rate: 21000, description: "Instant service for on demand needs.", duration: "1-2 HOURS" },
      { company: "grab", name: "GRAB - Instant", type: "instant", rate: 19000, description: "Instant service for on demand needs.", duration: "1-3 HOURS" },
      { company: "jne", name: "JNE Regular", type: "reg", rate: 10000, description: "Layanan reguler", duration: "1-2 DAYS" }
    ];
  }
};

// Feature Admin: Menyerahkan barang ke kurir & memasukkan nomor resi resmi
interface ShipOrderInput {
  orderId: string;
  resi: string;
}

export const shipOrderService = async (data: ShipOrderInput) => {
  // 1. Cek apakah data ordernya eksis di database
  const existingOrder = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { shipping: true }
  });

  if (!existingOrder) {
    throw new Error("Data pesanan (Order) tidak ditemukan!");
  }

  if (existingOrder.status !== "PROCESSING") {
    throw new Error("Pesanan tidak dapat dikirim karena belum diproses gudang atau sudah dikirim!");
  }

  // 2. Jalankan Database Transaction untuk update resi & naikkan status orderan
  return await prisma.$transaction(async (tx) => {
    
    // A. Update nomor resi dan status kurir lokal di tabel Shipping
    const updatedShipping = await tx.shipping.update({
      where: { orderId: data.orderId },
      data: {
        resi: data.resi,
        status: "SHIPPED" 
      }
    });

    // B. Naikkan status Order induk menjadi SHIPPED sesuai enum OrderStatus di prisma kalian
    const updatedOrder = await tx.order.update({
      where: { id: data.orderId },
      data: {
        status: "SHIPPED"
      }
    });

    return {
      orderStatus: updatedOrder.status,
      resi: updatedShipping.resi,
      shippingStatus: updatedShipping.status
    };
  }, {
    timeout: 20000
  });
};