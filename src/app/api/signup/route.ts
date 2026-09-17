import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { name, email, password, managerEmail } = body ?? {};

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  let managerId: string | null = null;
  if (managerEmail) {
    const manager = await getUserByEmail(String(managerEmail).toLowerCase().trim());
    if (!manager) {
      return NextResponse.json(
        { error: "No account found for that manager's email. Ask them to sign up first, or leave it blank." },
        { status: 400 }
      );
    }
    managerId = manager.id;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await createUser({ name, email: normalizedEmail, passwordHash, managerId });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
