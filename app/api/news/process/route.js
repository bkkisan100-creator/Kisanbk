import { NextResponse } from "next/server";

async function runAudio(request) {
  try {
    const origin = new URL(request.url).origin;

    const response = await fetch(`${origin}/api/news/audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Process route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "News processing failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return runAudio(request);
}

export async function POST(request) {
  return runAudio(request);
}