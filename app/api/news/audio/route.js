import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ======================================================
// SETTINGS
// ======================================================

const TEXT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
];

const TTS_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
];

const MAX_NEWS = 40;
const MAX_BULLETIN_STORIES = 12;

const AUDIO_BUCKET = "audio";
const SAMPLE_RATE = 24000;

// ======================================================
// HELPERS
// ======================================================

function cleanText(value) {
  if (!value) return "";

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNewsText(item) {
  return cleanText(
    item.summary ||
      item.content ||
      item.description ||
      item.title ||
      ""
  );
}

function normalizeTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSource(item) {
  const link = item.url || item.link || "";

  if (!link) {
    return cleanText(item.source || "");
  }

  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return cleanText(item.source || "");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryGeminiError(error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes("503") ||
    message.includes("429") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand") ||
    message.toLowerCase().includes("overloaded") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("temporarily")
  );
}

// ======================================================
// PCM -> WAV
// ======================================================

function pcmToWav(
  pcmBuffer,
  sampleRate = 24000,
  channels = 1
) {
  const bitsPerSample = 16;

  const byteRate =
    sampleRate *
    channels *
    (bitsPerSample / 8);

  const blockAlign =
    channels *
    (bitsPerSample / 8);

  const wav = Buffer.alloc(
    44 + pcmBuffer.length
  );

  wav.write("RIFF", 0);

  wav.writeUInt32LE(
    36 + pcmBuffer.length,
    4
  );

  wav.write("WAVE", 8);

  wav.write("fmt ", 12);

  wav.writeUInt32LE(16, 16);

  wav.writeUInt16LE(1, 20);

  wav.writeUInt16LE(
    channels,
    22
  );

  wav.writeUInt32LE(
    sampleRate,
    24
  );

  wav.writeUInt32LE(
    byteRate,
    28
  );

  wav.writeUInt16LE(
    blockAlign,
    32
  );

  wav.writeUInt16LE(
    bitsPerSample,
    34
  );

  wav.write("data", 36);

  wav.writeUInt32LE(
    pcmBuffer.length,
    40
  );

  pcmBuffer.copy(wav, 44);

  return wav;
}

// ======================================================
// GEMINI TEXT GENERATION
// ======================================================

async function generateNewsScript(ai, prompt) {
  let lastError = null;

  for (const model of TEXT_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Gemini text attempt ${attempt}/3 using ${model}...`
        );

        const response =
          await ai.models.generateContent({
            model,
            contents: prompt,
          });

        const text = cleanText(
          response?.text || ""
        );

        if (!text) {
          throw new Error(
            `Gemini ${model} ले खाली response दियो`
          );
        }

        console.log(
          `Gemini text success using ${model}`
        );

        return text;
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini ${model} attempt ${attempt} failed:`,
          error instanceof Error
            ? error.message
            : String(error)
        );

        if (
          !isTemporaryGeminiError(error)
        ) {
          throw error;
        }

        if (attempt < 3) {
          const delay =
            attempt === 1
              ? 5000
              : 10000;

          console.log(
            `Temporary Gemini error. Waiting ${delay / 1000}s...`
          );

          await sleep(delay);
        }
      }
    }

    console.log(
      `Model ${model} unavailable after retries. Trying fallback model...`
    );
  }

  throw (
    lastError ||
    new Error(
      "कुनै पनि Gemini text model ले response दिएन"
    )
  );
}

// ======================================================
// GEMINI TTS
// ======================================================

async function generateSpeech(ai, script) {
  let lastError = null;

  for (const model of TTS_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Gemini TTS attempt ${attempt}/3 using ${model}...`
        );

        const response =
          await ai.interactions.create({
            model,

            input: [
              {
                type: "user_input",
                content: [
                  {
                    type: "text",
                    text: script,
                    annotations: [
                      {
                        type: "speech_metadata",
                        style:
                          "professional Nepali radio news presenter, clear, natural, calm, warm, energetic but not dramatic",
                      },
                    ],
                  },
                ],
              },
            ],

            response_format: {
              type: "audio",
              mime_type: "audio/l16",
              sample_rate: SAMPLE_RATE,
            },

            generation_config: {
              speech_config: [
                {
                  voice: "Kore",
                },
              ],
            },
          });

        const audioData =
          response?.output_audio?.data;

        if (!audioData) {
          throw new Error(
            `Gemini TTS ${model} ले audio data दिएन`
          );
        }

        console.log(
          `Gemini TTS success using ${model}`
        );

        return Buffer.from(
          audioData,
          "base64"
        );
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini TTS ${model} attempt ${attempt} failed:`,
          error instanceof Error
            ? error.message
            : String(error)
        );

        if (
          !isTemporaryGeminiError(error)
        ) {
          throw error;
        }

        if (attempt < 3) {
          const delay =
            attempt === 1
              ? 5000
              : 10000;

          console.log(
            `Temporary TTS error. Waiting ${delay / 1000}s...`
          );

          await sleep(delay);
        }
      }
    }

    console.log(
      `TTS model ${model} unavailable. Trying fallback...`
    );
  }

  throw (
    lastError ||
    new Error(
      "कुनै पनि Gemini TTS model ले audio दिएन"
    )
  );
}

// ======================================================
// MAIN
// ======================================================

async function createAudioBulletin() {
  let step = "start";

  try {
    // --------------------------------------------------
    // ENV
    // --------------------------------------------------

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const geminiKey =
      process.env.GEMINI_API_KEY;

    if (!supabaseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is missing"
      );
    }

    if (!supabaseKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"
      );
    }

    if (!geminiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing"
      );
    }

    console.log(
      "Environment variables: OK"
    );

    // --------------------------------------------------
    // CLIENTS
    // --------------------------------------------------

    step = "supabase-client";

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey
      );

    const ai =
      new GoogleGenAI({
        apiKey: geminiKey,
      });

    console.log(
      "Supabase client: OK"
    );

    console.log(
      "Gemini client: OK"
    );

    // --------------------------------------------------
    // 1. FETCH NEWS
    // --------------------------------------------------

    step = "fetch-news";

    console.log(
      `Fetching latest ${MAX_NEWS} news items...`
    );

    const {
      data: news,
      error: newsError,
    } = await supabase
      .from("news")
      .select("*")
      .order("published_at", {
        ascending: false,
      })
      .limit(MAX_NEWS);

    if (newsError) {
      throw new Error(
        `Supabase news error: ${newsError.message}`
      );
    }

    if (!news || news.length === 0) {
      throw new Error(
        "news table मा कुनै news भेटिएन"
      );
    }

    console.log(
      `Fetched ${news.length} news items`
    );

    // --------------------------------------------------
    // 2. REMOVE DUPLICATES
    // --------------------------------------------------

    step = "dedupe";

    const seenTitles = new Set();
    const uniqueNews = [];

    for (const item of news) {
      const title = cleanText(
        item.title
      );

      if (!title) continue;

      const key =
        normalizeTitle(title);

      if (!key) continue;

      if (seenTitles.has(key)) {
        continue;
      }

      seenTitles.add(key);

      uniqueNews.push(item);
    }

    console.log(
      `Selected ${uniqueNews.length} unique stories from ${news.length} fetched stories`
    );

    if (uniqueNews.length === 0) {
      throw new Error(
        "Valid news भेटिएन"
      );
    }

    // --------------------------------------------------
    // 3. LIMIT STORIES
    // --------------------------------------------------

    const selectedNews =
      uniqueNews.slice(
        0,
        MAX_BULLETIN_STORIES
      );

    // --------------------------------------------------
    // 4. PREPARE NEWS FOR GEMINI
    // --------------------------------------------------

    step = "prepare-news";

    const newsForAI =
      selectedNews
        .map((item, index) => {
          const title =
            cleanText(item.title);

          const content =
            getNewsText(item)
              .slice(0, 700);

          const source =
            getSource(item);

          return `
समाचार ${index + 1}

शीर्षक: ${title}

विवरण: ${content}

स्रोत: ${source}
`;
        })
        .join("\n");

    // --------------------------------------------------
    // 5. GEMINI EDITOR
    // --------------------------------------------------

    step = "gemini-summary";

    console.log(
      "Generating Nepali news script..."
    );

    const summaryPrompt = `
तपाईं "आज के छ?" नामको नेपाली hourly audio news bulletin का मुख्य समाचार सम्पादक हुनुहुन्छ।

तल विभिन्न नेपाली तथा अन्तर्राष्ट्रिय समाचार स्रोतबाट आएका समाचारहरू छन्।

यी समाचारका उपलब्ध तथ्यका आधारमा करिब ३ मिनेटको प्राकृतिक नेपाली audio news bulletin तयार गर्नुहोस्।

मुख्य category:

१. राजनीति
२. समाज
३. प्रविधि
४. वातावरण
५. विश्व

समाचार छनोट गर्दा:

नेपालका महत्वपूर्ण राष्ट्रिय समाचारलाई प्राथमिकता दिनुहोस्।

राजनीतिमा:
नेपाल सरकारका महत्वपूर्ण निर्णय, प्रधानमन्त्री तथा मन्त्रिपरिषद्का निर्णय, संसद्, निर्वाचनसम्बन्धी महत्वपूर्ण घटनाक्रम, प्रमुख राजनीतिक घटनाक्रम, संविधान, सर्वोच्च अदालत तथा राज्य व्यवस्थासँग सम्बन्धित महत्वपूर्ण विषय समेट्नुहोस्।

समाजमा:
जनजीवन, शिक्षा, स्वास्थ्य, अपराध तथा सुरक्षा, दुर्घटना, विपद् र जनहितका महत्वपूर्ण विषय समेट्नुहोस्।

प्रविधिमा:
AI, नयाँ technology, cybersecurity, digital services, mobile/internet तथा महत्वपूर्ण innovation समेट्नुहोस्।

वातावरणमा:
मौसम, बाढी, पहिरो, जलवायु, प्रदूषण, वन तथा वातावरण र प्राकृतिक विपद्का महत्वपूर्ण विषय समेट्नुहोस्।

विश्वमा:
अन्तर्राष्ट्रिय राजनीति, कूटनीति, युद्ध, विश्व अर्थतन्त्र र महत्वपूर्ण अन्तर्राष्ट्रिय घटनाहरू समेट्नुहोस्।

अत्यन्त महत्वपूर्ण नियम:

- तथ्यमा आधारित र पूर्ण रूपमा neutral रहनुहोस्।
- कुनै राजनीतिक दल, नेता, उम्मेदवार वा विचारधाराको पक्ष वा विपक्षमा नलेख्नुहोस्।
- आरोप र पुष्टि भएको तथ्यलाई फरक रूपमा प्रस्तुत गर्नुहोस्।
- उपलब्ध सामग्रीमा नभएको तथ्य नबनाउनुहोस्।
- अनुमान वा speculation नगर्नुहोस्।
- एउटै घटनाको duplicate समाचार नदोहोऱ्याउनुहोस्।
- source article को exact wording copy नगर्नुहोस्।
- आफ्नै छोटो र प्राकृतिक नेपाली भाषामा पुनर्लेखन गर्नुहोस्।
- प्रत्येक समाचारको मुख्य तथ्य र यसको महत्व छोटकरीमा बताउनुहोस्।
- सबैभन्दा महत्वपूर्ण समाचारबाट bulletin सुरु गर्नुहोस्।
- कम महत्वपूर्ण समाचार हटाउनुहोस्।
- उपलब्ध तथ्यअनुसार लगभग ८ देखि १२ वटा महत्वपूर्ण समाचार समेट्नुहोस्।
- politics लाई प्राथमिकता दिए पनि अन्य महत्वपूर्ण categories लाई पनि समेट्नुहोस्।
- कुनै category मा महत्वपूर्ण समाचार छैन भने जबर्जस्ती समाचार नबनाउनुहोस्।
- अन्त्यमा छोटो closing राख्नुहोस्।
- script radio presenter ले पढ्ने जस्तो प्राकृतिक हुनुपर्छ।
- अत्यधिक dramatic भाषा प्रयोग नगर्नुहोस्।
- English नाम वा technical term आवश्यक भए सामान्य रूपमा प्रयोग गर्न सकिन्छ।
- Markdown प्रयोग नगर्नुहोस्।
- bullet points प्रयोग नगर्नुहोस्।
- headings प्रयोग नगर्नुहोस्।
- JSON नदिनुहोस्।
- explanation नदिनुहोस्।
- केवल final spoken Nepali news script दिनुहोस्।

समाचारहरू:

${newsForAI}
`;

    const script =
      await generateNewsScript(
        ai,
        summaryPrompt
      );

    console.log(
      `SCRIPT LENGTH: ${script.length}`
    );

    // --------------------------------------------------
    // 6. GEMINI TTS
    // --------------------------------------------------

    step = "gemini-tts";

    console.log(
      "Generating Nepali voice..."
    );

    const pcmBuffer =
      await generateSpeech(
        ai,
        script
      );

    if (
      !pcmBuffer ||
      !pcmBuffer.length
    ) {
      throw new Error(
        "Audio buffer empty छ"
      );
    }

    console.log(
      `PCM AUDIO SIZE: ${pcmBuffer.length} bytes`
    );

    // --------------------------------------------------
    // 7. PCM -> WAV
    // --------------------------------------------------

    step = "convert-audio";

    const wavBuffer =
      pcmToWav(
        pcmBuffer,
        SAMPLE_RATE,
        1
      );

    console.log(
      `WAV SIZE: ${wavBuffer.length} bytes`
    );

    // --------------------------------------------------
    // 8. UPLOAD
    // --------------------------------------------------

    step = "upload-supabase";

    const fileName =
      `bulletin-${Date.now()}.wav`;

    console.log(
      `Uploading ${fileName}...`
    );

    const {
      error: uploadError,
    } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(
        fileName,
        wavBuffer,
        {
          contentType: "audio/wav",
          cacheControl: "3600",
          upsert: true,
        }
      );

    if (uploadError) {
      throw new Error(
        `Supabase audio upload error: ${uploadError.message}`
      );
    }

    // --------------------------------------------------
    // 9. PUBLIC URL
    // --------------------------------------------------

    step = "public-url";

    const {
      data: publicUrlData,
    } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(fileName);

    const audioUrl =
      publicUrlData?.publicUrl;

    if (!audioUrl) {
      throw new Error(
        "Audio public URL बन्न सकेन"
      );
    }

    console.log(
      "Audio URL created:"
    );

    console.log(audioUrl);

    // --------------------------------------------------
    // 10. SAVE AUDIO URL
    // --------------------------------------------------

    step = "save-news-audio";

    const firstNewsId =
      selectedNews[0]?.id;

    if (firstNewsId) {
      const {
        error: updateError,
      } = await supabase
        .from("news")
        .update({
          audio_url: audioUrl,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          firstNewsId
        );

      if (updateError) {
        console.warn(
          "News audio_url update warning:",
          updateError.message
        );
      }
    }

    // --------------------------------------------------
    // COMPLETE
    // --------------------------------------------------

    step = "complete";

    console.log(
      "================================"
    );

    console.log(
      "AI AUDIO BULLETIN COMPLETE"
    );

    console.log(
      "================================"
    );

    return {
      success: true,

      message:
        "Nepali AI audio bulletin तयार भयो",

      audio_url:
        audioUrl,

      file:
        fileName,

      news_count:
        selectedNews.length,

      script_length:
        script.length,

      script,
    };
  } catch (error) {
    console.error(
      "NEWS AUDIO ERROR:",
      error
    );

    return {
      success: false,

      step,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

// ======================================================
// POST
// ======================================================

export async function POST() {
  const result =
    await createAudioBulletin();

  return NextResponse.json(
    result,
    {
      status:
        result.success
          ? 200
          : 500,
    }
  );
}

// ======================================================
// GET
// ======================================================

export async function GET() {
  const result =
    await createAudioBulletin();

  return NextResponse.json(
    result,
    {
      status:
        result.success
          ? 200
          : 500,
    }
  );
}