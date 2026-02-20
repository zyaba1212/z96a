/**
 * Авторизация по подписи Solana: POST с pubkey, message, signature (base58).
 * Проверка через nacl.sign.detached.verify; при успехе — upsert пользователя в БД.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pubkey, message, signature } = body;
    if (!pubkey || !message || !signature) {
      return NextResponse.json({ error: "pubkey, message, signature required" }, { status: 400 });
    }
    const key = bs58.decode(pubkey);
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    if (!nacl.sign.detached.verify(msg, sig, key)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    await prisma.user.upsert({
      where: { pubkey },
      update: { updatedAt: new Date() },
      create: { pubkey },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/auth]", e);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
