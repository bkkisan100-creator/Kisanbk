import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "NEXT_PUBLIC_SUPABASE_URL is missing",
        },
        { status: 500 }
      );
    }

    if (!supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase key is missing",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data, error } = await supabase
      .from("bulletins")
      .select(
        "id,title,summary,script,audio_url,audio_file,story_count,published_at,created_at"
      )
      .not("audio_url", "is", null)
      .order("published_at", {
        ascending: false,
      })
      .limit(24);

    if (error) {
      console.error("BULLETIN HISTORY SUPABASE ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bulletins: data || [],
    });
  } catch (error) {
    console.error("BULLETIN HISTORY API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}