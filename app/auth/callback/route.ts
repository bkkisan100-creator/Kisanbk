import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code");

  const next = url.searchParams.get("next") || "/";

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";

  if (!code) {
    if (errorCode === "otp_expired") {
      return NextResponse.redirect(
        new URL(
          "/forgot-password?error=expired",
          url.origin
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        "/login?error=missing_code",
        url.origin
      )
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "Auth callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/forgot-password?error=expired",
        url.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(safeNext, url.origin)
  );
}
