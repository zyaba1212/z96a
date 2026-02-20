/**
 * Верификация входа по подписи Solana: POST с publicKey, message, signature.
 * Используется фронтом (AuthBlock) после signMessage; при успехе — upsert в БД.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, signature, publicKey } = body;
    if (!publicKey || !message || !signature) {
      return NextResponse.json({ error: "publicKey, message, signature required" }, { status: 400 });
    }
    const pubkey = typeof publicKey === "string" ? publicKey : publicKey;
    const key = bs58.decode(pubkey);
    const sig = typeof signature === "string" ? bs58.decode(signature) : signature;
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
    console.error("[api/auth/verify]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(e) : "Verification failed" },
      { status: 500 }
    );
  }
}
