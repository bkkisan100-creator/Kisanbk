import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase environment variables missing",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    const { data, error } = await supabase
      .from("news")
      .select(
        "id,title,summary,audio_url,status,published_at,created_at"
      )
      .not("audio_url", "is", null)
      .order("published_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Latest bulletin error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        audio_url: null,
        title: "आजका मुख्य समाचार",
        story_count: 0,
        message: "अहिले audio bulletin उपलब्ध छैन",
      });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      title: data.title || "आजका मुख्य समाचार",
      summary: data.summary || "",
      audio_url: data.audio_url,
      status: data.status || "published",
      published_at:
        data.published_at || data.created_at,
      story_count: 1,
    });
  } catch (error) {
    console.error("Bulletin API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}