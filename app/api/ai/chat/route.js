import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    const news = body?.news || null;
    const history = Array.isArray(body?.history)
      ? body.history
      : [];

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Message is required",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is missing in .env.local",
        },
        { status: 500 }
      );
    }

    /*
      General-purpose AI assistant.
      News context is optional — the AI can discuss any topic.
    */

    const systemPrompt = `
तिमी "आज के छ?" app भित्रको General AI Assistant हौ।

तिमी केवल समाचारमा सीमित छैनौ।
प्रयोगकर्ताले जुनसुकै विषयमा प्रश्न सोध्न सक्छ:
- सामान्य ज्ञान
- शिक्षा
- विज्ञान
- technology
- programming
- business
- travel
- writing
- translation
- mathematics
- ideas
- career
- entertainment
- दैनिक जीवन
- casual conversation
- अन्य सामान्य विषयहरू

नियम:
1. प्रयोगकर्ताले जुन भाषामा सोध्छ, सकेसम्म त्यही भाषामा उत्तर देऊ।
2. नेपालीमा सोधिए नेपालीमा उत्तर देऊ।
3. English मा सोधिए English मा उत्तर देऊ।
4. नेपाली र English मिसाएर सोधिए प्राकृतिक Nepali-English मा उत्तर दिन सक्छौ।
5. थाहा नभएको कुरा बनाइदिएर तथ्य जस्तो नलेख।
6. प्रश्न अस्पष्ट भए आवश्यक clarification माग।
7. Coding प्रश्नमा आवश्यक code स्पष्ट रूपमा देऊ।
8. गणितमा आवश्यक calculation सही रूपमा गर।
9. उत्तर उपयोगी, प्राकृतिक र conversational बनाऊ।
10. सामान्य प्रश्नमा अनावश्यक लामो उत्तर नदेऊ।
11. प्रयोगकर्ताले विस्तारमा मागेमा विस्तारमा बुझाऊ।
12. राजनीतिक विषयमा तथ्य र विभिन्न documented positions neutral रूपमा प्रस्तुत गर; कसलाई समर्थन गर्ने भनेर निर्देशन नदेऊ।
13. स्वास्थ्य, कानुन वा वित्तजस्ता high-stakes विषयमा सामान्य जानकारी दिँदा professional advice को आवश्यकता हुन सक्ने कुरा स्पष्ट गर।
14. आफूलाई "आज के छ?" को AI assistant भनेर बुझ, तर news-only assistant होइनौ।

यदि Latest News Context उपलब्ध छ भने त्यो केवल समाचारसम्बन्धी प्रश्नमा उपयोग गर।
अन्य विषयमा त्यसलाई जबरजस्ती प्रयोग नगर।
`;

    const latestNewsContext = news
      ? `
Latest News Context (optional):
Title: ${news.title || "उपलब्ध छैन"}
Summary: ${news.summary || "उपलब्ध छैन"}
`
      : "";

    const contents = [];

    /*
      Keep recent conversation history so the AI remembers
      what the user was talking about in the current chat.
    */

    for (const item of history.slice(-12)) {
      if (
        !item ||
        typeof item.text !== "string" ||
        !item.text.trim()
      ) {
        continue;
      }

      const role =
        item.role === "assistant"
          ? "model"
          : "user";

      contents.push({
        role,
        parts: [
          {
            text: item.text.trim(),
          },
        ],
      });
    }

    /*
      Add the current user message.
    */

    contents.push({
      role: "user",
      parts: [
        {
          text: `${systemPrompt}

${latestNewsContext}

Current user message:
${message}`,
        },
      ],
    });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            "Gemini request failed",
        },
        { status: 500 }
      );
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          success: false,
          error: "AI returned an empty response",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error(
      "AI chat route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Something went wrong with AI chat",
      },
      { status: 500 }
    );
  }
}