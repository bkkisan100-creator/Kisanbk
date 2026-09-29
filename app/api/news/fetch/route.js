import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("SUPABASE URL:", supabaseUrl);
    console.log(
      "SUPABASE KEY:",
      supabaseAnonKey ? "SET" : "MISSING"
    );

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
    }

    if (!supabaseAnonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey
    );

    const { data, error } = await supabase
      .from("news")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("SUPABASE NEWS ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    console.log("NEWS COUNT:", data?.length || 0);

    return NextResponse.json(
      {
        success: true,
        count: data?.length || 0,
        data: data || [],
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("FETCH ROUTE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
        stack: process.env.NODE_ENV === "development"
          ? error?.stack
          : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}