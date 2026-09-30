import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_NEWS = 40;
const MAX_BULLETIN_STORIES = 12;
const AUDIO_BUCKET = "audio";
const SAMPLE_RATE = 24000;

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSource(item) {
  return cleanText(
    item?.source ||
      item?.source_name ||
      item?.publisher ||
      item?.site_name ||
      "समाचार स्रोत"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryGeminiError(error) {
  const message =
    error instanceof Error ? error.message : String(error);

  return (
    /429|rate.?limit|quota|resource.?exhausted|503|500|overloaded|temporar/i.test(
      message
    )
  );
}

/* =========================================================
   GEMINI TEXT GENERATION
========================================================= */

async function generateTextWithRetry(ai, prompt) {
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
  ];

  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Gemini text attempt ${attempt}/3 using ${model}...`
        );

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text =
          response?.text ||
          response?.candidates?.[0]?.content?.parts
            ?.map((part) => part?.text || "")
            .join("") ||
          "";

        if (!text.trim()) {
          throw new Error("Gemini returned empty text");
        }

        console.log(
          `Gemini text success using ${model}`
        );

        return text.trim();
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini text failed using ${model}, attempt ${attempt}:`,
          error
        );

        if (!isTemporaryGeminiError(error)) {
          break;
        }

        await sleep(1500 * attempt);
      }
    }
  }

  throw lastError || new Error("Gemini text generation failed");
}

/* =========================================================
   CLEAN GENERATED SCRIPT
========================================================= */

function cleanGeneratedScript(text) {
  let script = String(text || "");

  script = script
    .replace(/^```[\s\S]*?\n/, "")
    .replace(/```$/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Remove accidental meta instructions if Gemini puts them in output.
  const forbiddenStarts = [
    "यहाँ तपाईंले",
    "निर्देशन अनुसार",
    "यसरी पढ्नुहोस्",
    "शान्त भएर पढ्नुहोस्",
    "व्यावसायिक रूपमा पढ्नुहोस्",
    "professional voice",
    "director's notes",
    "audio profile",
    "transcript:",
  ];

  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();

      return !forbiddenStarts.some((item) =>
        lower.startsWith(item.toLowerCase())
      );
    });

  script = lines.join(" ");

  return script.trim();
}

/* =========================================================
   FETCH NEWS
========================================================= */

async function fetchNews(supabase) {
  console.log(
    `Fetching latest ${MAX_NEWS} news items...`
  );

  const { data, error } = await supabase
    .from("news")
    .select(
      "id,title,source,url,content,summary,audio_url,status,published_at,created_at,updated_at"
    )
    .order("published_at", {
      ascending: false,
    })
    .limit(MAX_NEWS);

  if (error) {
    throw new Error(
      `Supabase news error: ${error.message}`
    );
  }

  const news = Array.isArray(data) ? data : [];

  console.log(
    `Fetched ${news.length} news items`
  );

  return news;
}

/* =========================================================
   DEDUPLICATE NEWS
========================================================= */

function selectUniqueNews(news) {
  const seen = new Set();
  const unique = [];

  for (const item of news) {
    const title = normalizeTitle(item?.title);

    if (!title) continue;

    if (seen.has(title)) {
      continue;
    }

    seen.add(title);
    unique.push(item);
  }

  return unique;
}

/* =========================================================
   BUILD NEWS INPUT
========================================================= */

function buildNewsInput(news) {
  return news
    .map((item, index) => {
      const title = cleanText(item?.title);
      const source = getSource(item);

      const description =
        cleanText(item?.summary) ||
        cleanText(item?.content);

      const publishedAt =
        item?.published_at
          ? new Date(item.published_at).toISOString()
          : "";

      return `
NEWS ${index + 1}
Title: ${title}
Source: ${source}
Published: ${publishedAt}
Details: ${description.slice(0, 1800)}
`;
    })
    .join("\n");
}

/* =========================================================
   GENERATE PROFESSIONAL NEPALI SCRIPT
========================================================= */

async function generateNewsScript(ai, news) {
  console.log(
    "Generating professional Nepali news script..."
  );

  const newsInput = buildNewsInput(news);

  const prompt = `
You are the senior editor of a professional Nepali television and radio newsroom.

Create a polished hourly Nepali news bulletin from the supplied news items.

IMPORTANT EDITORIAL RULES:

1. Write in natural, modern, standard Nepali.
2. The bulletin must sound like a professional Nepali news broadcast.
3. Be factual, neutral and concise.
4. Do not invent facts.
5. Do not exaggerate.
6. Do not use sensational language.
7. Do not give personal opinions.
8. Do not favor or attack any political party, politician, country, organization or person.
9. If a claim is attributed to a person or organization, preserve that attribution.
10. Do not copy source articles word-for-word.
11. Rewrite information naturally in your own words.
12. Remove duplicate stories.
13. Select approximately 8 to 12 important stories.
14. Prioritize important Nepal news, followed by economy, society, infrastructure, technology, environment, culture/sports and international news when available.
15. Use short sentences that are easy for a Nepali news presenter to speak.
16. Use natural Nepali punctuation and sentence breaks.
17. Write numbers in natural Nepali spoken form whenever practical.
18. Avoid unnecessary English words.
19. Do not use markdown.
20. Do not use bullet points.
21. Do not use headings.
22. Do not include analysis or commentary.
23. Do not mention these instructions.
24. Do not write stage directions.
25. Do not write things such as "(pause)", "[pause]", "(music)", "[music]", "read slowly", "professional voice", or "calmly".
26. Do not include a separate "script" label.
27. Do not include a conclusion explaining what you did.

OPENING:

Start naturally with:

"नमस्कार, आज के छ? मा तपाईंलाई स्वागत छ। अब सुन्नुहोस् आजका प्रमुख समाचार।"

Then move naturally into the most important stories.

TRANSITIONS:

Use natural broadcast transitions such as:
"अब अर्को समाचार..."
"यसैबीच..."
"यता..."
"उता..."
"यसै क्रममा..."
"अब अन्तर्राष्ट्रिय समाचारतर्फ..."
"अब अन्य समाचार..."
Only use them where they sound natural. Do not overuse them.

ENDING:

End naturally with:

"आजका समाचार यहीं सकिन्छ। आज के छ? का साथमा म अर्को बुलेटिनमा पुनः उपस्थित हुनेछु। तबसम्मका लागि नमस्कार।"

TARGET LENGTH:

Approximately 2.5 to 3.5 minutes when spoken at a calm professional broadcast pace.

NEWS DATA:
${newsInput}
`;

  const rawScript = await generateTextWithRetry(
    ai,
    prompt
  );

  const script = cleanGeneratedScript(rawScript);

  if (!script) {
    throw new Error(
      "Generated news script is empty"
    );
  }

  console.log(
    "SCRIPT LENGTH:",
    script.length
  );

  return script;
}

/* =========================================================
   PCM → WAV
========================================================= */

function pcmToWav(
  pcmBuffer,
  sampleRate = SAMPLE_RATE,
  channels = 1,
  bitsPerSample = 16
) {
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(
    headerSize + dataSize
  );

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(
    36 + dataSize,
    4
  );
  wavBuffer.write("WAVE", 8);

  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(
    sampleRate,
    24
  );

  const byteRate =
    sampleRate *
    channels *
    (bitsPerSample / 8);

  wavBuffer.writeUInt32LE(
    byteRate,
    28
  );

  const blockAlign =
    channels *
    (bitsPerSample / 8);

  wavBuffer.writeUInt16LE(
    blockAlign,
    32
  );

  wavBuffer.writeUInt16LE(
    bitsPerSample,
    34
  );

  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(
    dataSize,
    40
  );

  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

/* =========================================================
   EXTRACT AUDIO DATA
========================================================= */

function extractPcmFromResponse(response) {
  const part =
    response?.candidates?.[0]?.content?.parts?.find(
      (p) => p?.inlineData?.data
    );

  if (!part?.inlineData?.data) {
    throw new Error(
      "Gemini TTS returned no audio data"
    );
  }

  return Buffer.from(
    part.inlineData.data,
    "base64"
  );
}

/* =========================================================
   GEMINI TTS
========================================================= */

async function generateVoiceWithRetry(ai, script) {
  console.log(
    "Generating professional Nepali voice..."
  );

  const models = [
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
  ];

  let lastError = null;

  /*
    IMPORTANT:
    The instruction is separate from the transcript.
    We explicitly tell Gemini not to speak the instructions.
  */

  const voiceInstruction = `
You are a professional Nepali television and radio news presenter.

DELIVERY PROFILE:
- Calm
- Professional
- Neutral
- Trustworthy
- Warm but authoritative
- Natural human broadcast delivery
- Clear Nepali pronunciation
- Medium speaking speed
- Smooth rhythm
- Controlled breathing
- Short natural pauses between sentences
- Slightly longer natural pauses between different news topics
- Subtle emphasis on important names, places, numbers and key facts
- Serious but not dramatic
- Relaxed but not sleepy
- Never rushed
- Never exaggerated

BROADCAST STYLE:
Speak like an experienced Nepali news anchor presenting an hourly national news bulletin from a modern broadcast studio.

Do not sound like:
- an advertisement
- a motivational speaker
- an audiobook narrator
- a casual conversation
- a dramatic movie narrator
- a robotic text reader

Do not add emotion that is not present in the news.

Do not add words.

Do not change facts.

Do not repeat sentences.

Do not announce or read these delivery instructions.

Only speak the transcript supplied below.
`;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Gemini TTS attempt ${attempt}/3 using ${model}...`
        );

        const response =
          await ai.models.generateContent({
            model,

            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${voiceInstruction}

TRANSCRIPT TO SPEAK:
${script}`,
                  },
                ],
              },
            ],

            config: {
              responseModalities: ["AUDIO"],

              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Kore",
                  },
                },
              },
            },
          });

        const pcmBuffer =
          extractPcmFromResponse(response);

        if (!pcmBuffer.length) {
          throw new Error(
            "Generated PCM audio is empty"
          );
        }

        console.log(
          `Gemini TTS success using ${model}`
        );

        return pcmBuffer;
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini TTS failed using ${model}, attempt ${attempt}:`,
          error
        );

        if (!isTemporaryGeminiError(error)) {
          break;
        }

        await sleep(1500 * attempt);
      }
    }
  }

  throw (
    lastError ||
    new Error("Gemini TTS generation failed")
  );
}

/* =========================================================
   CREATE AUDIO BULLETIN
========================================================= */

async function createAudioBulletin() {
  console.log("================================");
  console.log("AI AUDIO BULLETIN START");
  console.log("================================");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const geminiApiKey =
    process.env.GEMINI_API_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing"
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "Supabase key is missing"
    );
  }

  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  console.log(
    "Environment variables: OK"
  );

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

  console.log(
    "Supabase client: OK"
  );

  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
  });

  console.log(
    "Gemini client: OK"
  );

  /* -----------------------------------------
     FETCH
  ----------------------------------------- */

  const news = await fetchNews(
    supabase
  );

  if (!news.length) {
    throw new Error(
      "No news items found in news table"
    );
  }

  /* -----------------------------------------
     DEDUPE
  ----------------------------------------- */

  const uniqueNews =
    selectUniqueNews(news);

  console.log(
    `Selected ${uniqueNews.length} unique stories from ${news.length} fetched stories`
  );

  const selectedNews =
    uniqueNews.slice(
      0,
      MAX_BULLETIN_STORIES
    );

  if (!selectedNews.length) {
    throw new Error(
      "No usable news stories found"
    );
  }

  console.log(
    `Using ${selectedNews.length} stories for bulletin`
  );

  /* -----------------------------------------
     SCRIPT
  ----------------------------------------- */

  const script =
    await generateNewsScript(
      ai,
      selectedNews
    );

  /* -----------------------------------------
     TTS
  ----------------------------------------- */

  const pcmBuffer =
    await generateVoiceWithRetry(
      ai,
      script
    );

  console.log(
    "PCM AUDIO SIZE:",
    pcmBuffer.length,
    "bytes"
  );

  const wavBuffer =
    pcmToWav(
      pcmBuffer,
      SAMPLE_RATE,
      1,
      16
    );

  console.log(
    "WAV SIZE:",
    wavBuffer.length,
    "bytes"
  );

  /* -----------------------------------------
     STORAGE
  ----------------------------------------- */

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
        upsert: false,
      }
    );

  if (uploadError) {
    throw new Error(
      `Audio upload error: ${uploadError.message}`
    );
  }

  const {
    data: publicUrlData,
  } =
    supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(fileName);

  const audioUrl =
    publicUrlData?.publicUrl;

  if (!audioUrl) {
    throw new Error(
      "Could not create public audio URL"
    );
  }

  console.log(
    "Audio URL created:"
  );

  console.log(audioUrl);

  /* -----------------------------------------
     SAVE BULLETIN
  ----------------------------------------- */

  console.log(
    "Saving new bulletin to Supabase..."
  );

  const bulletinTitle =
    "आजका मुख्य समाचार";

  const bulletinSummary =
    `आजका ${selectedNews.length} प्रमुख समाचार समेटिएको AI audio bulletin।`;

  const {
    data: bulletin,
    error: bulletinError,
  } = await supabase
    .from("bulletins")
    .insert({
      title: bulletinTitle,
      summary: bulletinSummary,
      script: script,
      audio_url: audioUrl,
      audio_file: fileName,
      story_count:
        selectedNews.length,
      published_at:
        new Date().toISOString(),
    })
    .select(
      "id,title,summary,script,audio_url,audio_file,story_count,published_at,created_at"
    )
    .single();

  if (bulletinError) {
    console.error(
      "BULLETIN INSERT ERROR:",
      bulletinError
    );

    throw new Error(
      `Supabase bulletin error: ${bulletinError.message}`
    );
  }

  console.log(
    "NEW BULLETIN CREATED:"
  );

  console.log(bulletin);

  /*
    We intentionally skip bulletin_stories here because
    the exact schema of that table is not required for
    audio playback and has not been confirmed.
  */

  console.log(
    "Bulletin story linking skipped."
  );

  console.log("================================");
  console.log(
    "AI AUDIO BULLETIN COMPLETE"
  );
  console.log("================================");

  return {
    success: true,
    message:
      "Professional Nepali AI audio bulletin तयार भयो",
    bulletin_id: bulletin.id,
    bulletin,
    audio_url: audioUrl,
    file: fileName,
    news_count:
      selectedNews.length,
    script_length:
      script.length,
    script,
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST() {
  try {
    const result =
      await createAudioBulletin();

    return NextResponse.json(
      result,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "AI AUDIO BULLETIN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown audio generation error",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    const result =
      await createAudioBulletin();

    return NextResponse.json(
      result,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "AI AUDIO BULLETIN GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown audio generation error",
      },
      { status: 500 }
    );
  }
}