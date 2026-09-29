import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");

    const secret = process.env.CRON_SECRET;

    if (secret) {
      const expected = `Bearer ${secret}`;

      if (authHeader !== expected) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
          },
          { status: 401 }
        );
      }
    }

    const origin = new URL(request.url).origin;

    console.log("HOURLY NEWS CRON STARTED");

    // 1. First collect fresh news
    const collectResponse = await fetch(
      `${origin}/api/news/collect-news`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const collectText = await collectResponse.text();

    let collectData;

    try {
      collectData = JSON.parse(collectText);
    } catch {
      collectData = {
        success: false,
        error: collectText,
      };
    }

    console.log("NEWS COLLECTION RESULT:", collectData);

    if (!collectResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "collect-news",
          collect: collectData,
        },
        { status: 500 }
      );
    }

    // 2. Then generate fresh AI audio bulletin
    const audioResponse = await fetch(
      `${origin}/api/news/audio`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const audioText = await audioResponse.text();

    let audioData;

    try {
      audioData = JSON.parse(audioText);
    } catch {
      audioData = {
        success: false,
        error: audioText,
      };
    }

    console.log("AUDIO RESULT:", audioData);

    if (!audioResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "audio",
          collect: collectData,
          audio: audioData,
        },
        { status: 500 }
      );
    }

    console.log("HOURLY NEWS CRON COMPLETED");

    return NextResponse.json({
      success: true,
      message: "Hourly news pipeline completed.",
      collected: collectData,
      audio: audioData,
    });
  } catch (error) {
    console.error("HOURLY CRON ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Hourly news cron failed.",
      },
      { status: 500 }
    );
  }
}