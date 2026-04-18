import "server-only";

import { createHash } from "node:crypto";

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type Schema,
} from "@google/generative-ai";
import sharp from "sharp";

import { getServiceSupabase } from "@/lib/db/supabase";
import type {
  SafetyAdvice,
  TriageErrorReason,
  TriageResult,
  TriageRunResult,
} from "@/lib/db/types";

const MODEL_ID = "gemini-2.0-flash";
const PROMPT_VERSION = "v1";
const MAX_EDGE_PX = 768;
const JPEG_QUALITY = 80;
const SAFETY_LINE = "When in doubt, call — don't carry.";

const SYSTEM_PROMPT = `You are a wildlife triage assistant for licensed rehabbers.
You receive ONE photo and GPS coords. Identify the species and grade injury severity.
Be conservative: if unsure, say so. You are NOT a veterinarian; output triage, not diagnosis.
Safety advice MUST include: whether to touch, how to contain, how to transport, and the line
"${SAFETY_LINE}"`;

const RESPONSE_SCHEMA = {
  type: "object",
  required: ["species", "confidence", "severity", "safety_advice", "should_touch"],
  properties: {
    species: { type: "string" },
    species_common: { type: "string" },
    confidence: { type: "number" },
    severity: { type: "integer" },
    should_touch: { type: "boolean" },
    safety_advice: {
      type: "object",
      required: ["containment", "transport", "line"],
      properties: {
        containment: { type: "string" },
        transport: { type: "string" },
        line: { type: "string" },
      },
    },
    uncertainty_notes: { type: "string" },
  },
} as const;

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

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new TriageError("missing_api_key", "GEMINI_API_KEY is not set");
  }
  return new GoogleGenerativeAI(key);
}

function userPrompt(lat: number, lng: number): string {
  return `GPS coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}.
Return JSON matching the provided schema. Severity grading:
1 observe · 2 monitor · 3 triage · 4 dispatch · 5 critical.
confidence must be in [0,1]. Always include the exact line "${SAFETY_LINE}".`;
}

async function resizeToJpeg(
  imageBytes: Uint8Array,
): Promise<Buffer> {
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
    // Always ensure the canonical line is present (FR-3).
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
        "Low-confidence identification — rehabber will confirm.",
    };
  }
  return r;
}

function model(temperature: number): GenerativeModel {
  return getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      // The SDK accepts JSON schema via `responseSchema`.
      responseSchema: RESPONSE_SCHEMA as unknown as Schema,
    },
    systemInstruction: SYSTEM_PROMPT,
  });
}

async function callGeminiWithImage(
  jpeg: Buffer,
  lat: number,
  lng: number,
  temperature: number,
): Promise<RawResponse> {
  const m = model(temperature);
  const res = await m.generateContent([
    {
      inlineData: {
        data: jpeg.toString("base64"),
        mimeType: "image/jpeg",
      },
    },
    { text: userPrompt(lat, lng) },
  ]);
  const text = res.response.text();
  return JSON.parse(text) as RawResponse;
}

async function callGeminiTextOnly(
  lat: number,
  lng: number,
): Promise<RawResponse | null> {
  // Text-only fallback: no image → we can't identify, but we can still emit
  // the canonical safety-advice + severity=3 scaffold so the UI + dispatcher
  // keep working. Regex-extract severity keywords if the model returns prose.
  const m = getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
    systemInstruction: SYSTEM_PROMPT,
  });
  const prompt = `No image was available. Emit a conservative JSON triage for an
unidentified injured animal at ${lat.toFixed(3)}, ${lng.toFixed(3)} using keys
{species, confidence, severity, should_touch, safety_advice:{containment,transport,line}, uncertainty_notes}.
Set species="Unknown animal", confidence=0.1, severity=3, should_touch=false, and include the literal
"${SAFETY_LINE}" in safety_advice.line.`;
  try {
    const res = await m.generateContent(prompt);
    const text = res.response.text();
    return JSON.parse(text) as RawResponse;
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
      "Automated identification failed — a licensed rehabber will confirm species and next steps.",
  });
}

export async function runFinder(
  input: RunFinderInput,
): Promise<TriageRunResult> {
  const jpeg = await resizeToJpeg(input.imageBytes);
  const sha = sha256(jpeg);

  const supabase = getServiceSupabase();

  // 1. Cache hit?
  const { data: cached } = await supabase
    .from("triage_cache")
    .select("response")
    .eq("sha", sha)
    .maybeSingle();
  if (cached?.response) {
    const result = applyConfidenceFloor(cached.response as TriageResult);
    return { ...result, cached: true };
  }

  // 2. Fresh call — with fallback chain.
  let raw: RawResponse | null = null;
  let degraded: TriageRunResult["degraded"];
  try {
    raw = await callGeminiWithImage(jpeg, input.lat, input.lng, 0.2);
  } catch {
    try {
      raw = await callGeminiWithImage(jpeg, input.lat, input.lng, 0);
    } catch {
      raw = null;
    }
  }

  if (!raw) {
    raw = await callGeminiTextOnly(input.lat, input.lng);
    degraded = "text_only";
  }

  if (!raw) {
    // Still nothing — throw so caller renders the "couldn't ID" UI with a
    // location-only dispatch. We do NOT cache this.
    throw new TriageError(
      "gemini_unavailable",
      "All Gemini fallback branches failed",
    );
  }

  let result = normalise(raw);
  result = applyConfidenceFloor(result);
  if (result.species === "Unknown animal" && !degraded) {
    degraded = "low_confidence";
  }

  // 3. Cache the canonical (post-normalisation) response keyed by SHA.
  await supabase
    .from("triage_cache")
    .upsert({ sha, response: result }, { onConflict: "sha" });

  return { ...result, cached: false, degraded };
}

export { SAFETY_LINE, synthesizeUnknown };
