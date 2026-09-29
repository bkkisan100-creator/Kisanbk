import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// --------------------------------------------------
// BASIC TEXT CLEANING
// --------------------------------------------------

function cleanText(value) {
  if (!value) return "";

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// NEWS TEXT
// --------------------------------------------------

function getNewsText(item) {
  return cleanText(
    item.summary ||
      item.content ||
      item.description ||
      item.title ||
      ""
  );
}

// --------------------------------------------------
// TITLE NORMALIZATION
// --------------------------------------------------

function normalizeTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// SOURCE
// --------------------------------------------------

function getSource(link) {
  if (!link) return "";

  try {
    return new URL(link)
      .hostname
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

// --------------------------------------------------
// PCM -> WAV
// --------------------------------------------------

function pcmToWav(
  pcmBuffer,
  sampleRate = SAMPLE_RATE,
  channels = CHANNELS
) {
  const bitsPerSample = BITS_PER_SAMPLE;

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

  wav.writeUInt32LE(
    16,
    16
  );

  wav.writeUInt16LE(
    1,
    20
  );

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

  pcmBuffer.copy(
    wav,
    44
  );

  return wav;
}

// --------------------------------------------------
// WAV PARSER
// Supports PCM 16-bit WAV
// --------------------------------------------------

function parseWav(buffer) {
  if (
    !buffer ||
    buffer.length < 44
  ) {
    throw new Error(
      "Background music WAV file is invalid."
    );
  }

  const riff =
    buffer.toString(
      "ascii",
      0,
      4
    );

  const wave =
    buffer.toString(
      "ascii",
      8,
      12
    );

  if (
    riff !== "RIFF" ||
    wave !== "WAVE"
  ) {
    throw new Error(
      "Background music must be a valid WAV file."
    );
  }

  let offset = 12;

  let audioFormat = null;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let dataStart = null;
  let dataSize = null;

  while (
    offset + 8 <= buffer.length
  ) {
    const chunkId =
      buffer.toString(
        "ascii",
        offset,
        offset + 4
      );

    const chunkSize =
      buffer.readUInt32LE(
        offset + 4
      );

    const chunkStart =
      offset + 8;

    if (
      chunkId === "fmt "
    ) {
      audioFormat =
        buffer.readUInt16LE(
          chunkStart
        );

      channels =
        buffer.readUInt16LE(
          chunkStart + 2
        );

      sampleRate =
        buffer.readUInt32LE(
          chunkStart + 4
        );

      bitsPerSample =
        buffer.readUInt16LE(
          chunkStart + 14
        );
    }

    if (
      chunkId === "data"
    ) {
      dataStart =
        chunkStart;

      dataSize =
        Math.min(
          chunkSize,
          buffer.length -
            chunkStart
        );

      break;
    }

    offset =
      chunkStart +
      chunkSize;

    // WAV chunks are normally word aligned.
    if (
      offset % 2 !== 0
    ) {
      offset++;
    }
  }

  if (
    audioFormat !== 1 ||
    !channels ||
    !sampleRate ||
    bitsPerSample !== 16 ||
    dataStart === null ||
    !dataSize
  ) {
    throw new Error(
      "Background music must be PCM 16-bit WAV."
    );
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    pcm: buffer.subarray(
      dataStart,
      dataStart + dataSize
    ),
  };
}

// --------------------------------------------------
// WAV PCM -> MONO FLOAT SAMPLES
// --------------------------------------------------

function wavToMonoSamples(wav) {
  const {
    channels,
    pcm,
  } = wav;

  const bytesPerSample = 2;

  const frameSize =
    channels *
    bytesPerSample;

  const frames =
    Math.floor(
      pcm.length /
        frameSize
    );

  const samples =
    new Float32Array(
      frames
    );

  for (
    let i = 0;
    i < frames;
    i++
  ) {
    let total = 0;

    for (
      let ch = 0;
      ch < channels;
      ch++
    ) {
      const index =
        i * frameSize +
        ch * 2;

      total +=
        pcm.readInt16LE(
          index
        ) / 32768;
    }

    samples[i] =
      total / channels;
  }

  return samples;
}

// --------------------------------------------------
// SIMPLE RESAMPLER
// --------------------------------------------------

function resampleSamples(
  input,
  inputRate,
  outputRate
) {
  if (
    inputRate ===
    outputRate
  ) {
    return input;
  }

  const outputLength =
    Math.max(
      1,
      Math.round(
        input.length *
          outputRate /
          inputRate
      )
    );

  const output =
    new Float32Array(
      outputLength
    );

  const ratio =
    inputRate /
    outputRate;

  for (
    let i = 0;
    i < outputLength;
    i++
  ) {
    const position =
      i * ratio;

    const index =
      Math.floor(
        position
      );

    const next =
      Math.min(
        index + 1,
        input.length - 1
      );

    const fraction =
      position - index;

    const a =
      input[
        Math.max(
          0,
          Math.min(
            index,
            input.length - 1
          )
        )
      ];

    const b =
      input[next];

    output[i] =
      a +
      (b - a) *
        fraction;
  }

  return output;
}

// --------------------------------------------------
// MIX BACKGROUND MUSIC
//
// Voice remains dominant.
// Music:
// - fade in
// - low volume during news
// - fade out at end
// --------------------------------------------------

function mixBackgroundMusic(
  voicePcmBuffer,
  musicSamples,
  musicSampleRate
) {
  const voiceSamplesCount =
    Math.floor(
      voicePcmBuffer.length /
        2
    );

  if (
    voiceSamplesCount <= 0 ||
    !musicSamples ||
    musicSamples.length === 0
  ) {
    return voicePcmBuffer;
  }

  const music =
    resampleSamples(
      musicSamples,
      musicSampleRate,
      SAMPLE_RATE
    );

  const output =
    Buffer.alloc(
      voiceSamplesCount * 2
    );

  const voiceFadeInSeconds = 1.5;
  const voiceFadeOutSeconds = 4;

  const fadeInSamples =
    Math.floor(
      SAMPLE_RATE *
        voiceFadeInSeconds
    );

  const fadeOutSamples =
    Math.floor(
      SAMPLE_RATE *
        voiceFadeOutSeconds
    );

  const musicVolume = 0.09;

  for (
    let i = 0;
    i < voiceSamplesCount;
    i++
  ) {
    const voice =
      voicePcmBuffer.readInt16LE(
        i * 2
      ) / 32768;

    // Loop background music.
    const musicIndex =
      i % music.length;

    let musicValue =
      music[musicIndex] ||
      0;

    // Fade music in.
    let fadeIn = 1;

    if (
      i < fadeInSamples
    ) {
      fadeIn =
        i /
        fadeInSamples;
    }

    // Fade music out.
    let fadeOut = 1;

    if (
      i >
      voiceSamplesCount -
        fadeOutSamples
    ) {
      fadeOut =
        Math.max(
          0,
          (voiceSamplesCount -
            i) /
            fadeOutSamples
        );
    }

    const finalMusicVolume =
      musicVolume *
      fadeIn *
      fadeOut;

    musicValue *=
      finalMusicVolume;

    // Keep voice dominant.
    let mixed =
      voice +
      musicValue;

    // Soft limiter.
    if (mixed > 0.98) {
      mixed = 0.98;
    }

    if (mixed < -0.98) {
      mixed = -0.98;
    }

    output.writeInt16LE(
      Math.round(
        mixed * 32767
      ),
      i * 2
    );
  }

  return output;
}

// --------------------------------------------------
// LOAD BACKGROUND MUSIC
// --------------------------------------------------

async function loadBackgroundMusic() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL;

    if (!baseUrl) {
      console.warn(
        "NEXT_PUBLIC_SITE_URL not configured. Background music skipped."
      );

      return null;
    }

    const musicUrl =
      `${baseUrl.replace(
        /\/$/,
        ""
      )}/background-music.wav`;

    console.log(
      "LOADING BACKGROUND MUSIC:",
      musicUrl
    );

    const response =
      await fetch(
        musicUrl,
        {
          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      console.warn(
        "Background music not found. Voice-only audio will be generated."
      );

      return null;
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    const wav =
      parseWav(buffer);

    const samples =
      wavToMonoSamples(
        wav
      );

    return {
      samples,
      sampleRate:
        wav.sampleRate,
    };
  } catch (error) {
    console.warn(
      "Background music loading failed:",
      error?.message ||
        String(error)
    );

    return null;
  }
}

// --------------------------------------------------
// CREATE AUDIO BULLETIN
// --------------------------------------------------

async function createAudioBulletin() {
  let step = "start";

  try {
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

    step =
      "supabase-client";

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey
      );

    const ai =
      new GoogleGenAI({
        apiKey:
          geminiKey,
      });

    // --------------------------------------------------
    // 1. FETCH NEWS
    // --------------------------------------------------

    step =
      "fetch-news";

    const {
      data: news,
      error: newsError,
    } =
      await supabase
        .from("news")
        .select("*")
        .order(
          "published_at",
          {
            ascending: false,
          }
        )
        .limit(40);

    if (newsError) {
      throw new Error(
        `Supabase news error: ${newsError.message}`
      );
    }

    if (
      !news ||
      news.length === 0
    ) {
      throw new Error(
        "news table मा कुनै news भेटिएन"
      );
    }

    // --------------------------------------------------
    // 2. REMOVE DUPLICATES
    // --------------------------------------------------

    step =
      "dedupe";

    const seenTitles =
      new Set();

    const uniqueNews =
      [];

    for (
      const item of news
    ) {
      const title =
        cleanText(
          item.title
        );

      if (!title) {
        continue;
      }

      const key =
        normalizeTitle(
          title
        );

      if (!key) {
        continue;
      }

      if (
        seenTitles.has(
          key
        )
      ) {
        continue;
      }

      seenTitles.add(
        key
      );

      uniqueNews.push(
        item
      );
    }

    if (
      uniqueNews.length ===
      0
    ) {
      throw new Error(
        "Valid news भेटिएन"
      );
    }

    console.log(
      `AI NEWS INPUT: ${uniqueNews.length}`
    );

    // --------------------------------------------------
    // 3. PREPARE NEWS
    // --------------------------------------------------

    step =
      "prepare-news";

    const newsForAI =
      uniqueNews
        .map(
          (item, index) => {
            const title =
              cleanText(
                item.title
              );

            const content =
              getNewsText(
                item
              ).slice(
                0,
                700
              );

            const source =
              getSource(
                item.link
              );

            return `
समाचार ${index + 1}

शीर्षक: ${title}

विवरण: ${content}

स्रोत: ${source}
`;
          }
        )
        .join("\n");

    // --------------------------------------------------
    // 4. GEMINI EDITOR
    // --------------------------------------------------

    step =
      "gemini-summary";

    const summaryPrompt = `
तपाईं "आज के छ?" नामको नेपाली hourly audio news bulletin का मुख्य समाचार सम्पादक हुनुहुन्छ।

हरेक bulletin को सुरुवात ठ्याक्कै यस भावबाट हुनुपर्छ:

"नमस्कार, आज के छ? मा यहाँहरूलाई हार्दिक स्वागत छ। अब सुन्नुहोस् आजका मुख्य समाचारहरू।"

त्यसपछि समाचार सुरु गर्नुहोस्।

तल विभिन्न नेपाली तथा अन्तर्राष्ट्रिय समाचार पोर्टलबाट आएका समाचारहरू छन्।

तपाईंले यी समाचारबाट तथ्यमा आधारित, निष्पक्ष र प्राकृतिक नेपाली भाषामा करिब ३ मिनेटको audio news bulletin तयार गर्नुपर्छ।

मुख्य category:

१. राजनीति
२. समाज
३. प्रविधि
४. वातावरण
५. विश्व

समाचार छनोटको प्राथमिकता:

पहिलो: राजनीति
- नेपाल सरकारका महत्वपूर्ण निर्णय
- प्रधानमन्त्री तथा मन्त्रिपरिषद्का महत्वपूर्ण निर्णय
- संसद्
- निर्वाचनसम्बन्धी महत्वपूर्ण घटनाक्रम
- प्रमुख राजनीतिक दलसँग सम्बन्धित महत्वपूर्ण घटनाक्रम
- संविधान, सर्वोच्च अदालत वा राज्य व्यवस्थासँग सम्बन्धित महत्वपूर्ण घटनाक्रम
- प्रमुख राजनीतिक नेताका महत्वपूर्ण सार्वजनिक गतिविधि वा अभिव्यक्ति

दोस्रो: समाज
- जनजीवन
- शिक्षा
- स्वास्थ्य
- अपराध तथा सुरक्षा
- दुर्घटना
- विपद्
- जनहितका महत्वपूर्ण घटनाहरू

तेस्रो: प्रविधि
- AI
- नयाँ technology
- cybersecurity
- digital services
- mobile/internet
- महत्वपूर्ण technology company वा innovation

चौथो: वातावरण
- मौसम
- बाढी
- पहिरो
- जलवायु
- प्रदूषण
- वन तथा वातावरण
- प्राकृतिक विपद्

पाँचौँ: विश्व
- अन्तर्राष्ट्रिय राजनीति
- युद्ध तथा कूटनीति
- विश्व अर्थतन्त्रका महत्वपूर्ण घटनाहरू
- अन्तर्राष्ट्रिय संकट
- महत्वपूर्ण विश्व घटनाहरू

महत्वपूर्ण editorial नियम:

- नेपालका महत्वपूर्ण राजनीतिक समाचारलाई प्राथमिकता दिनुहोस्।
- तर महत्वपूर्ण नयाँ राजनीतिक समाचार छैन भने जबर्जस्ती राजनीतिक समाचार नबनाउनुहोस्।
- कुनै राजनीतिक दल, नेता, उम्मेदवार वा विचारधाराको पक्ष वा विपक्षमा नलेख्नुहोस्।
- भाषा factual र neutral राख्नुहोस्।
- आरोप, दाबी र पुष्टि भएको तथ्यलाई स्पष्ट रूपमा अलग गर्नुहोस्।
- उपलब्ध समाचारमा नभएको घटना नबनाउनुहोस्।
- अनुमान वा fabricated information नथप्नुहोस्।
- एउटै घटनाको duplicate समाचार हटाउनुहोस्।
- एउटै घटनालाई फरक portal बाट आएको भन्दै दोहोर्याएर नपढ्नुहोस्।
- source article को wording copy नगर्नुहोस्।
- आफ्नै छोटो नेपाली भाषामा पुनर्लेखन गर्नुहोस्।
- मुख्य तथ्य, कसलाई असर गर्छ र किन महत्वपूर्ण छ भन्ने कुरा छोटकरीमा बताउनुहोस्।
- करिब १० देखि १२ वटा महत्वपूर्ण समाचार समेट्नुहोस्।
- सबैभन्दा महत्वपूर्ण समाचारबाट सुरु गर्नुहोस्।
- politics लाई priority दिए पनि समाज, प्रविधि, वातावरण र विश्वका महत्वपूर्ण समाचार समेट्नुहोस्।
- कुनै category मा महत्वपूर्ण समाचार नभए अर्को category का वास्तविक समाचार लिनुहोस्।
- अत्यधिक dramatic भाषा प्रयोग नगर्नुहोस्।
- radio presenter ले पढ्ने जस्तो प्राकृतिक भाषा प्रयोग गर्नुहोस्।
- English नाम वा technical term आवश्यक भए सामान्य रूपमा प्रयोग गर्न सकिन्छ।
- प्रत्येक समाचारलाई छोटो र स्पष्ट राख्नुहोस्।
- अन्त्यमा ठ्याक्कै यस भावको छोटो closing राख्नुहोस्:

"आजका लागि आज के छ? को समाचार यति नै। नयाँ अपडेटका लागि फेरि सुन्दै गर्नुहोला। नमस्कार।"

Output:
- केवल final spoken Nepali script।
- Markdown नदिनुहोस्।
- bullet points नदिनुहोस्।
- headings नदिनुहोस्।
- JSON नदिनुहोस्।
- explanation नदिनुहोस्।

समाचारहरू:

${newsForAI}
`;

    const summaryResponse =
      await ai.models.generateContent(
        {
          model:
            "gemini-3.5-flash-lite",
          contents:
            summaryPrompt,
        }
      );

    const script =
      cleanText(
        summaryResponse.text
      );

    if (!script) {
      throw new Error(
        "Gemini ले summary/script दिएन"
      );
    }

    console.log(
      `SCRIPT LENGTH: ${script.length}`
    );

    // --------------------------------------------------
    // 5. GEMINI TTS
    // --------------------------------------------------

    step =
      "gemini-tts";

    const ttsResponse =
      await ai.interactions.create(
        {
          model:
            "gemini-3.8-flash-tts",

          input: [
            {
              type:
                "user_input",

              content: [
                {
                  type:
                    "text",

                  text:
                    script,

                  annotations: [
                    {
                      type:
                        "speech_metadata",

                      style:
                        "professional Nepali radio news presenter, clear, natural, calm, warm, confident, energetic but not dramatic, smooth radio delivery",
                    },
                  ],
                },
              ],
            },
          ],

          response_format: {
            type:
              "audio",

            mime_type:
              "audio/l16",

            sample_rate:
              SAMPLE_RATE,
          },

          generation_config: {
            speech_config: [
              {
                voice:
                  "Kore",
              },
            ],
          },
        }
      );

    if (
      !ttsResponse ||
      !ttsResponse.output_audio ||
      !ttsResponse.output_audio.data
    ) {
      throw new Error(
        "Gemini TTS ले audio data दिएन"
      );
    }

    // --------------------------------------------------
    // 6. PCM BUFFER
    // --------------------------------------------------

    step =
      "convert-audio";

    const voicePcm =
      Buffer.from(
        ttsResponse
          .output_audio
          .data,
        "base64"
      );

    if (
      !voicePcm.length
    ) {
      throw new Error(
        "Audio buffer empty छ"
      );
    }

    // --------------------------------------------------
    // 7. BACKGROUND MUSIC MIX
    // --------------------------------------------------

    step =
      "background-music";

    let finalPcm =
      voicePcm;

    const backgroundMusic =
      await loadBackgroundMusic();

    if (backgroundMusic) {
      console.log(
        "BACKGROUND MUSIC MIXING STARTED"
      );

      finalPcm =
        mixBackgroundMusic(
          voicePcm,
          backgroundMusic.samples,
          backgroundMusic.sampleRate
        );

      console.log(
        "BACKGROUND MUSIC MIXING COMPLETED"
      );
    } else {
      console.log(
        "BACKGROUND MUSIC NOT AVAILABLE - USING VOICE ONLY"
      );
    }

    // --------------------------------------------------
    // 8. PCM -> WAV
    // --------------------------------------------------

    step =
      "pcm-to-wav";

    const wavBuffer =
      pcmToWav(
        finalPcm,
        SAMPLE_RATE,
        CHANNELS
      );

    // --------------------------------------------------
    // 9. UPLOAD SUPABASE
    // --------------------------------------------------

    step =
      "upload-supabase";

    const fileName =
      `bulletin-${Date.now()}.wav`;

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from("audio")
        .upload(
          fileName,
          wavBuffer,
          {
            contentType:
              "audio/wav",

            cacheControl:
              "3600",

            upsert:
              true,
          }
        );

    if (
      uploadError
    ) {
      throw new Error(
        `Supabase audio upload error: ${uploadError.message}`
      );
    }

    // --------------------------------------------------
    // 10. PUBLIC AUDIO URL
    // --------------------------------------------------

    step =
      "public-url";

    const {
      data:
        publicUrlData,
    } =
      supabase.storage
        .from("audio")
        .getPublicUrl(
          fileName
        );

    const audioUrl =
      publicUrlData?.publicUrl;

    if (!audioUrl) {
      throw new Error(
        "Audio public URL बन्न सकेन"
      );
    }

    // --------------------------------------------------
    // 11. SAVE AUDIO URL
    // --------------------------------------------------

    step =
      "save-news-audio";

    const firstNewsId =
      uniqueNews[0]?.id;

    if (
      firstNewsId
    ) {
      const {
        error:
          updateError,
      } =
        await supabase
          .from("news")
          .update(
            {
              audio_url:
                audioUrl,

              updated_at:
                new Date().toISOString(),
            }
          )
          .eq(
            "id",
            firstNewsId
          );

      if (
        updateError
      ) {
        console.warn(
          "News audio_url update warning:",
          updateError.message
        );
      }
    }

    // --------------------------------------------------
    // 12. COMPLETE
    // --------------------------------------------------

    step =
      "complete";

    return {
      success:
        true,

      message:
        "Nepali AI audio bulletin तयार भयो",

      audio_url:
        audioUrl,

      file:
        fileName,

      news_count:
        uniqueNews.length,

      script_length:
        script.length,

      background_music:
        Boolean(
          backgroundMusic
        ),

      script,
    };
  } catch (error) {
    console.error(
      "NEWS AUDIO ERROR:",
      error
    );

    return {
      success:
        false,

      step,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

// --------------------------------------------------
// POST
// --------------------------------------------------

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

// --------------------------------------------------
// GET
// --------------------------------------------------

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