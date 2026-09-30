import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    console.log("================================");
    console.log("HOURLY NEWS CRON STARTED");
    console.log("================================");

    // --------------------------------
    // 1. CRON SECURITY
    // --------------------------------
    const secret = process.env.CRON_SECRET;

    if (secret) {
      const authHeader = request.headers.get("authorization");
      const expected = `Bearer ${secret}`;

      if (authHeader !== expected) {
        console.error("CRON UNAUTHORIZED");

        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
          },
          { status: 401 }
        );
      }
    }

    // --------------------------------
    // 2. CHECK REQUIRED ENV VARIABLES
    // --------------------------------
    const requiredEnv = [
      "CRON_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
    ];

    const missingEnv = requiredEnv.filter(
      (key) => !process.env[key]
    );

    if (missingEnv.length > 0) {
      console.error(
        "MISSING ENV VARIABLES:",
        missingEnv
      );

      return NextResponse.json(
        {
          success: false,
          step: "environment",
          error: "Required environment variables are missing.",
          missing: missingEnv,
        },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;

    // --------------------------------
    // 3. COLLECT NEWS
    // --------------------------------
    console.log("STEP 1: COLLECTING NEWS");

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

    console.log(
      "NEWS COLLECTION RESULT:",
      collectData
    );

    if (!collectResponse.ok) {
      console.error("NEWS COLLECTION FAILED");

      return NextResponse.json(
        {
          success: false,
          step: "collect-news",
          collect: collectData,
        },
        { status: 500 }
      );
    }

    console.log("NEWS COLLECTION SUCCESS");

    // --------------------------------
    // 4. GENERATE AI AUDIO
    // --------------------------------
    console.log("STEP 2: GENERATING AI AUDIO");

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

    console.log(
      "AUDIO RESULT:",
      audioData
    );

    if (!audioResponse.ok) {
      console.error("AI AUDIO GENERATION FAILED");

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

    console.log("AI AUDIO GENERATION SUCCESS");

    // --------------------------------
    // 5. COMPLETE
    // --------------------------------
    console.log("================================");
    console.log("HOURLY NEWS CRON COMPLETED");
    console.log("================================");

    return NextResponse.json({
      success: true,
      message: "Hourly news pipeline completed successfully.",
      collected: collectData,
      audio: audioData,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "HOURLY CRON ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        step: "unexpected",
        error:
          error?.message ||
          "Hourly news cron failed.",
      },
      { status: 500 }
    );
  }
}
