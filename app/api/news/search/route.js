import { NextResponse } from "next/server";

import { createClient } from "../../../lib/supabase/server";
export async function GET(request) {
  try {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || !query.trim()) {
      return NextResponse.json({
        success: true,
        news: [],
      });
    }

    const cleanQuery = query.trim();

    const { data, error } = await supabase
      .from("news")
      .select(
        "id,title,link,content,summary,audio_url,status,published_at,created_at"
      )
      .or(
        `title.ilike.%${cleanQuery}%,content.ilike.%${cleanQuery}%,summary.ilike.%${cleanQuery}%`
      )
      .order("published_at", {
        ascending: false,
      })
      .limit(30);

    if (error) {
      console.error("Supabase search error:", error);

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
      news: data || [],
    });
  } catch (error) {
    console.error("Search API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Search failed",
      },
      { status: 500 }
    );
  }
}