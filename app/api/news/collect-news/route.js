import { supabase } from "@/app/lib/supabase";
import Parser from "rss-parser";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
  timeout: 10000,
});

const RSS_SOURCES = [
  // Nepal
  {
    name: "Onlinekhabar",
    url: "https://www.onlinekhabar.com/feed",
  },
  {
    name: "Ratopati",
    url: "https://www.ratopati.com/feed",
  },
  {
    name: "Setopati",
    url: "https://www.setopati.com/feed",
  },
  {
    name: "Khabarhub",
    url: "https://www.khabarhub.com/feed/",
  },
  {
    name: "Pahilopost",
    url: "https://pahilopost.com/feed/",
  },
  {
    name: "Hamro Patro",
    url: "https://www.hamropatro.com/news/rss",
  },

  // International / Nepali
  {
    name: "BBC Nepali",
    url: "https://feeds.bbci.co.uk/nepali/rss.xml",
  },
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },

  // CNN feed can occasionally return malformed XML.
  {
    name: "CNN World",
    url: "http://rss.cnn.com/rss/edition.rss",
  },
];

function cleanText(value) {
  if (!value) return "";

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validLink(link) {
  if (!link) return false;

  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    console.log("NEWS COLLECTION STARTED");

    const fetchPromises = RSS_SOURCES.map(async (source) => {
      try {
        console.log(`FETCHING RSS: ${source.name}`);

        const feed = await parser.parseURL(source.url);

        if (!feed || !Array.isArray(feed.items)) {
          console.warn(
            `RSS EMPTY: ${source.name}`
          );

          return [];
        }

        const articles = feed.items
          .slice(0, 8)
          .map((item) => {
            const title = cleanText(
              item.title || "समाचार शीर्षक उपलब्ध छैन"
            );

            const content = cleanText(
              item.contentSnippet ||
                item.content ||
                item.summary ||
                item.title ||
                ""
            );

            const link = cleanText(
              item.link || item.guid || ""
            );

            let publishedAt =
              new Date().toISOString();

            if (item.pubDate) {
              const date = new Date(item.pubDate);

              if (!Number.isNaN(date.getTime())) {
                publishedAt = date.toISOString();
              }
            }

            return {
              title,
              content,
              link,
              published_at: publishedAt,
              status: "pending",
            };
          })
          .filter((item) => {
            return (
              item.title &&
              validLink(item.link)
            );
          });

        console.log(
          `RSS SUCCESS: ${source.name} = ${articles.length}`
        );

        return articles;
      } catch (error) {
        console.warn(
          `RSS SKIPPED: ${source.name} -> ${
            error?.message || String(error)
          }`
        );

        return [];
      }
    });

    const results =
      await Promise.all(fetchPromises);

    const allArticles =
      results.flat();

    if (allArticles.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            "कुनै पनि पोर्टलबाट समाचार प्राप्त भएन।",
        },
        { status: 404 }
      );
    }

    // Duplicate links हटाउने
    const linkMap = new Map();

    for (const article of allArticles) {
      if (!linkMap.has(article.link)) {
        linkMap.set(
          article.link,
          article
        );
      }
    }

    const uniqueArticles =
      Array.from(linkMap.values());

    console.log(
      `UNIQUE NEWS: ${uniqueArticles.length}`
    );

    // Supabase
    const { error } = await supabase
      .from("news")
      .upsert(uniqueArticles, {
        onConflict: "link",
      });

    if (error) {
      console.error(
        "SUPABASE NEWS ERROR:",
        error.message
      );

      return Response.json(
        {
          success: false,
          error: `Supabase Error: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      total_collected:
        uniqueArticles.length,
      message: `${uniqueArticles.length} वटा समाचार विभिन्न पोर्टलहरूबाट सफलतापूर्वक कलेक्ट भयो!`,
    });
  } catch (error) {
    console.error(
      "NEWS COLLECTION GENERAL ERROR:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "News collection failed.",
      },
      { status: 500 }
    );
  }
}