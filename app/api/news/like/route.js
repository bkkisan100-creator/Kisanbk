import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      bulletinId: body.bulletinId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}