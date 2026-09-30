import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { YoutubeTranscript, YoutubeTranscriptNotAvailableLanguageError } from "youtube-transcript";

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const aiApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

app.use(express.json({ limit: "16kb" }));
app.use(express.static("."));

function getVideoId(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const id = hostname === "youtu.be"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : (hostname === "youtube.com" || hostname.endsWith(".youtube.com"))
        ? parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop()
        : null;
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  } catch { return null; }
}

function requireConfig() {
  if (!process.env.YOUTUBE_API_KEY || !aiApiKey) {
    throw new Error("서버 환경변수에 YOUTUBE_API_KEY와 OPENROUTER_API_KEY를 설정해주세요.");
  }
}

async function fetchVideo(videoId) {
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.search = new URLSearchParams({ part: "snippet", id: videoId, key: process.env.YOUTUBE_API_KEY });
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("YouTube 영상 정보를 불러오지 못했습니다.");
  const { items } = await response.json();
  if (!items?.length) throw new Error("공개된 유효한 YouTube 영상을 찾지 못했습니다.");
  const snippet = items[0].snippet;
  return {
    title: snippet.title,
    channelId: snippet.channelId,
    thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url
  };
}

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "servings", "cookingTime", "ingredients", "steps"],
  properties: {
    title: { type: "string" },
    servings: { type: "string" },
    cookingTime: { type: "string" },
    ingredients: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "amount"], properties: { name: { type: "string" }, amount: { type: "string" } } } },
    steps: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "description", "tip"], properties: { title: { type: "string" }, description: { type: "string" }, tip: { type: "string" } } } }
  }
};

function parseRecipe(content) {
  const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonObject = content.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse((fencedJson || jsonObject || content).trim());
}

function validateRecipe(recipe) {
  const validIngredient = (item) => item && typeof item.name === "string" && typeof item.amount === "string";
  const validStep = (step) => step && typeof step.title === "string" && typeof step.description === "string" && typeof step.tip === "string";
  if (!recipe || typeof recipe.title !== "string" || typeof recipe.servings !== "string" || typeof recipe.cookingTime !== "string" || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps) || !recipe.ingredients.every(validIngredient) || !recipe.steps.every(validStep) || recipe.steps.length === 0) {
    throw new Error("AI가 완성된 레시피 형식으로 응답하지 않았습니다. 다시 시도해주세요.");
  }
  return recipe;
}

async function fetchTranscript(videoId) {
  try {
    return await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
  } catch (error) {
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
      return YoutubeTranscript.fetchTranscript(videoId);
    }
    throw error;
  }
}

async function fetchRecipeComments(videoId, uploaderChannelId) {
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  endpoint.search = new URLSearchParams({
    part: "snippet,replies",
    videoId,
    maxResults: "30",
    order: "relevance",
    textFormat: "plainText",
    key: process.env.YOUTUBE_API_KEY
  });
  const response = await fetch(endpoint);
  if (!response.ok) return [];
  const { items = [] } = await response.json();
  const comments = items.flatMap((thread) => [
    thread.snippet?.topLevelComment?.snippet,
    ...(thread.replies?.comments || []).map((reply) => reply.snippet)
  ]).filter(Boolean).map((comment) => ({
    text: comment.textDisplay,
    likes: comment.likeCount || 0,
    isUploader: comment.authorChannelId?.value === uploaderChannelId
  })).filter((comment) => comment.text?.trim());
  const recipeWords = /재료|레시피|만들|조리|소스|g\b|ml\b|스푼|큰술|작은술|컵|분/g;
  return comments.sort((a, b) => {
    const score = (comment) => (comment.isUploader ? 10000 : 0) + (comment.text.match(recipeWords)?.length || 0) * 100 + comment.likes;
    return score(b) - score(a);
  }).slice(0, 25);
}

async function fetchRecipeSource(videoId, video) {
  try {
    const transcript = await fetchTranscript(videoId);
    const text = transcript.map(({ text }) => text).join(" ").slice(0, 24000);
    if (text) return { type: "영상 자막", text };
  } catch (transcriptError) {
    const comments = await fetchRecipeComments(videoId, video.channelId);
    if (comments.length) {
      const text = comments.map((comment, index) => `${index + 1}. ${comment.isUploader ? "[영상 업로더 댓글] " : ""}${comment.text}`).join("\n").slice(0, 16000);
      return { type: "영상 댓글", text };
    }
    throw transcriptError;
  }
  throw new Error("영상 자막과 댓글에서 레시피 정보를 찾지 못했습니다.");
}

function getPublicError(error) {
  if (error?.status === 401) return "OpenRouter API 키를 다시 확인해주세요.";
  if (error?.status === 402) return "OpenRouter 크레딧이 부족합니다. 잔액 또는 토큰 한도를 확인해주세요.";
  if (error?.status === 429) return "요청이 많습니다. 잠시 후 다시 시도해주세요.";
  if (error?.name === "YoutubeTranscriptDisabledError") return "이 영상은 자막이 꺼져 있어 레시피를 만들 수 없습니다. 자막이 있는 영상을 선택해주세요.";
  if (error?.name === "YoutubeTranscriptTooManyRequestError") return "YouTube 자막 요청이 잠시 제한되었습니다. 조금 뒤 다시 시도해주세요.";
  if (error?.message?.startsWith("AI가 완성된 레시피")) return error.message;
  return "레시피를 만드는 중 문제가 발생했습니다. 다른 자막 영상을 시도해주세요.";
}

app.post("/api/recipes", async (req, res) => {
  try {
    requireConfig();
    const videoId = getVideoId(req.body?.url);
    if (!videoId) return res.status(400).json({ error: "올바른 YouTube 링크를 입력해주세요." });

    const video = await fetchVideo(videoId);
    const source = await fetchRecipeSource(videoId, video);

    const client = new OpenAI({
      apiKey: aiApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": `http://localhost:${port}`,
        "X-OpenRouter-Title": "Recipe Zip"
      }
    });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      max_tokens: 2500,
      messages: [{
        role: "user",
        content: `다음 유튜브 요리 영상 ${source.type}을 한국어 레시피로 정리해. 댓글을 사용하는 경우 [영상 업로더 댓글]을 최우선으로 신뢰해. 출처에 없는 수치나 재료는 추측하지 말고 \"영상 확인 필요\"로 표시해. 조리 단계는 3~8개로 간결하게 만들어.\n\n반드시 아래 형태의 유효한 JSON 객체 하나만 반환해. 설명 문장, Markdown, **, 코드 블록은 절대 쓰지 마.\n{"title":"요리 이름","servings":"2인분","cookingTime":"20분","ingredients":[{"name":"재료","amount":"분량"}],"steps":[{"title":"단계 제목","description":"조리 설명","tip":"팁"}]}\n\n영상 제목: ${video.title}\n\n${source.type}:\n${source.text}`
      }],
      response_format: { type: "json_object" }
    });
    const recipe = validateRecipe(parseRecipe(completion.choices[0]?.message?.content || ""));
    res.json({ videoId, video, recipe, sourceType: source.type });
  } catch (error) {
    console.error(error);
    res.status(error?.status || 500).json({ error: getPublicError(error) });
  }
});

app.listen(port, host, () => console.log(`Recipe Zip is running at http://localhost:${port}`));
