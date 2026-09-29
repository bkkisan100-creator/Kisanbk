import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    // --------------------------------------------------
    // 1. CHECK ENVIRONMENT VARIABLES
    // --------------------------------------------------

    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing from .env.local"
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local"
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from .env.local"
      );
    }

    // --------------------------------------------------
    // 2. GET PENDING NEWS FROM SUPABASE
    // --------------------------------------------------

    const { data: news, error: newsError } = await supabase
      .from("news")
      .select(
        "id, title, source, content, published_at, status"
      )
      .eq("status", "pending")
      .order("published_at", {
        ascending: false,
      })
      .limit(30);

    if (newsError) {
      throw new Error(
        `Supabase news error: ${newsError.message}`
      );
    }

    // --------------------------------------------------
    // 3. NO NEWS FOUND
    // --------------------------------------------------

    if (!news || news.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending news found",
        count: 0,
      });
    }

    console.log(
      `Found ${news.length} pending news items`
    );

    // --------------------------------------------------
    // 4. PREPARE NEWS FOR GEMINI
    // --------------------------------------------------

    const newsText = news
      .map(
        (item, index) => `
========================
NEWS ${index + 1}
========================

ID:
${item.id}

SOURCE:
${item.source || "Unknown"}

TITLE:
${item.title || ""}

CONTENT:
${item.content || ""}

PUBLISHED:
${item.published_at || ""}
`
      )
      .join("\n");

    // --------------------------------------------------
    // 5. GEMINI PROMPT
    // --------------------------------------------------

    const systemInstruction = `
तिमी "आज के छ?" नामको नेपाली AI news bulletin का
professional news editor हौ।

तिम्रो काम उपलब्ध समाचारबाट प्रत्येक घण्टाको
करिब 3 मिनेटको नेपाली audio news bulletin तयार गर्नु हो।

नियमहरू:

1. सबै समाचार ध्यानपूर्वक पढ।
2. एउटै घटना भएका duplicate समाचार पहिचान गर।
3. duplicate समाचारमध्ये बढी स्पष्ट वा विश्वसनीय source भएको
   समाचारलाई प्राथमिकता देऊ।
4. धेरै पुराना, कमजोर वा कम महत्वपूर्ण समाचार हटाऊ।
5. महत्वपूर्ण समाचारलाई प्राथमिकता देऊ।
6. राजनीति, अर्थतन्त्र, समाज, मौसम, दुर्घटना,
   अन्तर्राष्ट्रिय, खेलकुद आदि विषयमा आवश्यक विविधता राख।
7. उपलब्ध समाचारमा नभएको कुनै तथ्य नबनाऊ।
8. अनुमान वा speculation नगर।
9. समाचारको मूल wording copy नगर।
10. आफ्नै सरल र प्राकृतिक नेपाली भाषामा script लेख।
11. script radio/news presenter ले सजिलै पढ्न मिल्ने हुनुपर्छ।
12. sensational वा clickbait भाषा प्रयोग नगर।
13. आवश्यक ठाउँमा source attribution गर।
14. headline मात्र होइन, मुख्य तथ्य पनि समेट।
15. कुल bulletin script करिब 350-450 नेपाली शब्दको बनाऊ।
16. 8 देखि 12 वटा महत्वपूर्ण समाचार छान्ने प्रयास गर।
17. प्रत्येक selected news को 2-3 वाक्यको छोटो summary पनि देऊ।
18. सबै selected news को summary तथ्यमा आधारित हुनुपर्छ।
19. selected_news_ids मा उपलब्ध NEWS को वास्तविक ID मात्र प्रयोग गर।
`;

    const userPrompt = `
यी अहिले उपलब्ध pending news हुन्:

${newsText}

अब:

- duplicate हटाऊ
- कमजोर/कम महत्वपूर्ण news हटाऊ
- 8 देखि 12 वटा महत्वपूर्ण news छान
- प्रत्येक selected news को छोटो नेपाली summary बनाऊ
- सबै selected news लाई मिलाएर करिब 3 मिनेटको
  natural Nepali audio bulletin script बनाऊ।

Bulletin सुरु गर्दा presenter-style opening राख्न सकिन्छ।

उदाहरण:

"नमस्कार, आज के छ? मा तपाईंलाई स्वागत छ।
अब सुन्नुहोस् आजका मुख्य समाचार।"

तर यो उदाहरण जस्ताको तस्तै copy गर्न आवश्यक छैन।

JSON schema अनुसार मात्र response देऊ।
`;

    // --------------------------------------------------
    // 6. GEMINI STRUCTURED OUTPUT
    // --------------------------------------------------

    const response = await gemini.models.generateContent({
     model: "gemini-3.5-flash-lite",

      contents: userPrompt,

      config: {
        systemInstruction,

        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,

          properties: {
            selected_news_ids: {
              type: Type.ARRAY,

              items: {
                type: Type.STRING,
              },

              description:
                "IDs of the selected news items",
            },

            bulletin_title: {
              type: Type.STRING,

              description:
                "Title of the bulletin",
            },

            script: {
              type: Type.STRING,

              description:
                "Approximately 3-minute Nepali news bulletin script",
            },

            summaries: {
              type: Type.ARRAY,

              items: {
                type: Type.OBJECT,

                properties: {
                  news_id: {
                    type: Type.STRING,
                  },

                  summary: {
                    type: Type.STRING,
                  },
                },

                required: [
                  "news_id",
                  "summary",
                ],
              },
            },
          },

          required: [
            "selected_news_ids",
            "bulletin_title",
            "script",
            "summaries",
          ],
        },
      },
    });

    // --------------------------------------------------
    // 7. READ GEMINI RESPONSE
    // --------------------------------------------------

    const aiText = response.text?.trim();

    if (!aiText) {
      throw new Error(
        "Gemini returned an empty response"
      );
    }

    console.log(
      "GEMINI RESPONSE:",
      aiText
    );

    // --------------------------------------------------
    // 8. PARSE JSON
    // --------------------------------------------------

    let result;

    try {
      result = JSON.parse(aiText);
    } catch (error) {
      console.error(
        "GEMINI RAW RESPONSE:",
        aiText
      );

      throw new Error(
        "Gemini returned invalid JSON"
      );
    }

    // --------------------------------------------------
    // 9. VALIDATE RESPONSE
    // --------------------------------------------------

    if (
      !Array.isArray(
        result.selected_news_ids
      )
    ) {
      throw new Error(
        "Gemini response missing selected_news_ids"
      );
    }

    if (!result.script) {
      throw new Error(
        "Gemini response missing script"
      );
    }

    if (
      !Array.isArray(
        result.summaries
      )
    ) {
      throw new Error(
        "Gemini response missing summaries"
      );
    }

    // --------------------------------------------------
// 10. NORMALIZE IDs
// --------------------------------------------------

const selectedIds = [
  ...new Set(
    result.selected_news_ids.map(String)
  ),
];

    // --------------------------------------------------
    // 11. UPDATE SELECTED NEWS
    // --------------------------------------------------

    for (const summaryItem of result.summaries) {
      const newsId =
        String(summaryItem.news_id);

      // Make sure Gemini didn't invent an ID
      const originalNews =
        news.find(
          (item) =>
            String(item.id) === newsId
        );

      if (!originalNews) {
        console.warn(
          "Ignoring unknown news ID:",
          newsId
        );

        continue;
      }

      const summary =
        String(
          summaryItem.summary || ""
        ).trim();

      const { error: updateError } =
        await supabase
          .from("news")
          .update({
            summary,
            status: "summarized",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", originalNews.id);

      if (updateError) {
        throw new Error(
          `Failed to update news ${newsId}: ${updateError.message}`
        );
      }
    }

    // --------------------------------------------------
    // 12. MARK NON-SELECTED NEWS AS PROCESSED
    // --------------------------------------------------

    for (const item of news) {
      const itemId =
        String(item.id);

      if (
        !selectedIds.includes(itemId)
      ) {
        const { error: processError } =
          await supabase
            .from("news")
            .update({
              status: "processed",
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", item.id);

        if (processError) {
          console.error(
            `Failed to process news ${item.id}:`,
            processError.message
          );
        }
      }
    }

    // --------------------------------------------------
    // 13. RETURN BULLETIN
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Gemini news summarization completed",

      count: news.length,

      selectedCount:
        selectedIds.length,

      selectedNewsIds:
        selectedIds,

      bulletinTitle:
        result.bulletin_title ||
        "आजका मुख्य समाचार",

      script:
        result.script,

      summaries:
        result.summaries,
    });

  } catch (error) {
    // --------------------------------------------------
    // ERROR HANDLING
    // --------------------------------------------------

    console.error(
      "GEMINI SUMMARIZE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unknown server error",
      },
      {
        status: 500,
      }
    );
  }
}