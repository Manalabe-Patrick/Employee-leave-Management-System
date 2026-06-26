import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, firstName, lastName } = body;

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const hashedPassword = await hash(password, 10);

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
    },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    { status: 201 }
  );
}
