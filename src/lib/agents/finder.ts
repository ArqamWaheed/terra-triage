import "server-only";

import { createHash } from "node:crypto";

import sharp from "sharp";

import { getServiceSupabase } from "@/lib/db/supabase";
import type {
  SafetyAdvice,
  TriageErrorReason,
  TriageResult,
  TriageRunResult,
} from "@/lib/db/types";

const MODEL_ID = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const PROMPT_VERSION = "v2";
const MAX_EDGE_PX = 768;
const JPEG_QUALITY = 80;
const REQUEST_TIMEOUT_MS = 8000;
const SAFETY_LINE = "When in doubt, call - don't carry.";

const SYSTEM_PROMPT = `You are a wildlife triage assistant for licensed rehabbers.
You receive ONE photo and GPS coords. Identify the species and grade injury severity.
Be conservative: if unsure, say so. You are NOT a veterinarian; output triage, not diagnosis.
Safety advice MUST include: whether to touch, how to contain, how to transport, and the line
"${SAFETY_LINE}"

Respond with ONLY a JSON object of this exact shape: {"species": string, "species_common": string?, "confidence": number in [0,1], "severity": integer 1..5, "should_touch": boolean, "safety_advice": {"containment": string, "transport": string, "line": "${SAFETY_LINE}"}, "uncertainty_notes": string?}`;

export class TriageError extends Error {
  reason: TriageErrorReason;
  constructor(reason: TriageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "TriageError";
    this.reason = reason;
  }
}

export interface RunFinderInput {
  imageBytes: Uint8Array;
  mimeType: string;
  lat: number;
  lng: number;
}

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new TriageError("vision_unavailable", "GROQ_API_KEY missing");
  }
  return key;
}

function userPrompt(lat: number, lng: number): string {
  return `GPS coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}.
Return JSON matching the specified shape. Severity grading:
1 observe · 2 monitor · 3 triage · 4 dispatch · 5 critical.
confidence must be in [0,1]. Always include the exact line "${SAFETY_LINE}".`;
}

async function resizeToJpeg(imageBytes: Uint8Array): Promise<Buffer> {
  try {
    return await sharp(imageBytes)
      .rotate()
      .resize({
        width: MAX_EDGE_PX,
        height: MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    throw new TriageError(
      "invalid_image",
      err instanceof Error ? err.message : "image decode failed",
    );
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256")
    .update(PROMPT_VERSION)
    .update(":")
    .update(buf)
    .digest("hex");
}

type RawResponse = {
  species?: unknown;
  species_common?: unknown;
  confidence?: unknown;
  severity?: unknown;
  should_touch?: unknown;
  safety_advice?: {
    containment?: unknown;
    transport?: unknown;
    line?: unknown;
  };
  uncertainty_notes?: unknown;
};

function clampSeverity(n: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.round(n);
  if (r <= 1) return 1;
  if (r >= 5) return 5;
  return r as 2 | 3 | 4;
}

function normalise(raw: RawResponse): TriageResult {
  const species =
    typeof raw.species === "string" && raw.species.trim()
      ? raw.species.trim()
      : "Unknown animal";
  const species_common =
    typeof raw.species_common === "string" && raw.species_common.trim()
      ? raw.species_common.trim()
      : undefined;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;
  const severity = clampSeverity(
    typeof raw.severity === "number" ? raw.severity : 3,
  );
  const should_touch =
    typeof raw.should_touch === "boolean" ? raw.should_touch : false;

  const sa = raw.safety_advice ?? {};
  const containment =
    typeof sa.containment === "string" && sa.containment.trim()
      ? sa.containment.trim()
      : "Ventilated cardboard box lined with a soft cloth. Keep dark and quiet.";
  const transport =
    typeof sa.transport === "string" && sa.transport.trim()
      ? sa.transport.trim()
      : "Car, seat-belted box, no heat/AC blowing on it. Drive directly to rehabber.";
  let line =
    typeof sa.line === "string" && sa.line.trim() ? sa.line.trim() : SAFETY_LINE;
  if (!line.includes("call") || !line.toLowerCase().includes("carry")) {
    line = SAFETY_LINE;
  }
  if (!line.includes(SAFETY_LINE)) {
    line = `${line} ${SAFETY_LINE}`.trim();
  }

  const safety_advice: SafetyAdvice = {
    touch: should_touch,
    containment,
    transport,
    line,
  };

  const uncertainty_notes =
    typeof raw.uncertainty_notes === "string" && raw.uncertainty_notes.trim()
      ? raw.uncertainty_notes.trim()
      : undefined;

  return {
    species,
    species_common,
    species_confidence: confidence,
    severity,
    should_touch,
    safety_advice,
    uncertainty_notes,
  };
}

function applyConfidenceFloor(r: TriageResult): TriageResult {
  if (r.species_confidence < 0.35) {
    return {
      ...r,
      species: "Unknown animal",
      species_common: undefined,
      severity: r.severity >= 1 && r.severity <= 5 ? r.severity : 3,
      uncertainty_notes:
        r.uncertainty_notes ??
        "Low-confidence identification - rehabber will confirm.",
    };
  }
  return r;
}

type ChatMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function postGroq(
  messages: Array<{ role: "user"; content: ChatMessageContent[] }>,
  temperature: number,
): Promise<RawResponse> {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages,
        response_format: { type: "json_object" },
        max_tokens: 1024,
        temperature,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new TriageError(
        "vision_unavailable",
        `Groq ${res.status}: ${body}`,
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new TriageError("parse_failed", "Groq returned empty content");
    }
    return JSON.parse(content) as RawResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function callVisionWithImage(
  jpeg: Buffer,
  lat: number,
  lng: number,
  temperature: number,
): Promise<RawResponse> {
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  return postGroq(
    [
      {
        role: "user",
        content: [
          { type: "text", text: `${SYSTEM_PROMPT}\n\n${userPrompt(lat, lng)}` },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature,
  );
}

async function callVisionTextOnly(
  lat: number,
  lng: number,
): Promise<RawResponse | null> {
  const prompt = `${SYSTEM_PROMPT}

No image was available. Emit a conservative JSON triage for an
unidentified injured animal at ${lat.toFixed(3)}, ${lng.toFixed(3)}.
Set species="Unknown animal", confidence=0.1, severity=3, should_touch=false, and include the literal
"${SAFETY_LINE}" in safety_advice.line.`;
  try {
    return await postGroq(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      0,
    );
  } catch {
    return null;
  }
}

function synthesizeUnknown(): TriageResult {
  return normalise({
    species: "Unknown animal",
    confidence: 0.1,
    severity: 3,
    should_touch: false,
    safety_advice: {
      containment:
        "Ventilated cardboard box lined with a soft cloth. Keep dark and quiet.",
      transport:
        "Car, seat-belted box, no heat/AC blowing on it. Drive directly to rehabber.",
      line: SAFETY_LINE,
    },
    uncertainty_notes:
      "Automated identification failed - a licensed rehabber will confirm species and next steps.",
  });
}

export async function runFinder(
  input: RunFinderInput,
): Promise<TriageRunResult> {
  const jpeg = await resizeToJpeg(input.imageBytes);
  const sha = sha256(jpeg);

  const supabase = getServiceSupabase();

  const { data: cached } = await supabase
    .from("triage_cache")
    .select("response")
    .eq("sha", sha)
    .maybeSingle();
  if (cached?.response) {
    const result = applyConfidenceFloor(cached.response as TriageResult);
    return { ...result, cached: true };
  }

  let raw: RawResponse | null = null;
  let degraded: TriageRunResult["degraded"];
  try {
    raw = await callVisionWithImage(jpeg, input.lat, input.lng, 0.2);
  } catch {
    try {
      raw = await callVisionWithImage(jpeg, input.lat, input.lng, 0);
    } catch {
      raw = null;
    }
  }

  if (!raw) {
    raw = await callVisionTextOnly(input.lat, input.lng);
    degraded = "text_only";
  }

  if (!raw) {
    throw new TriageError(
      "vision_unavailable",
      "All Groq fallback branches failed",
    );
  }

  let result = normalise(raw);
  result = applyConfidenceFloor(result);
  if (result.species === "Unknown animal" && !degraded) {
    degraded = "low_confidence";
  }

  await supabase
    .from("triage_cache")
    .upsert({ sha, response: result }, { onConflict: "sha" });

  return { ...result, cached: false, degraded };
}

export { SAFETY_LINE, synthesizeUnknown };
