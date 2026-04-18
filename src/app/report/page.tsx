"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Camera, Loader2, MapPin, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downscaleImage } from "@/lib/utils/image";
import { createCase } from "./actions";

type GeoState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; lat: number; lng: number; accuracy: number | null }
  | { kind: "manual"; reason: string };

export default function ReportPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  const [geo, setGeo] = useState<GeoState>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator
      ? { kind: "pending" }
      : { kind: "manual", reason: "Geolocation unavailable on this device." },
  );
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          kind: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      (err) => {
        setGeo({
          kind: "manual",
          reason:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — enter coordinates manually."
              : "Couldn't read location — enter coordinates manually.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onPickPhoto = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setError(null);
    e.target.value = ""; // allow re-pick of same file
  };

  const { lat, lng, coordsReady } = useMemo(() => {
    if (geo.kind === "ok") {
      return { lat: geo.lat, lng: geo.lng, coordsReady: true };
    }
    const parsedLat = parseFloat(manualLat);
    const parsedLng = parseFloat(manualLng);
    const ok =
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180;
    return {
      lat: ok ? parsedLat : null,
      lng: ok ? parsedLng : null,
      coordsReady: ok,
    };
  }, [geo, manualLat, manualLng]);

  const canSubmit = !!photo && coordsReady && !isPending;

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!photo || lat == null || lng == null) return;
      setError(null);
      setStatus("Compressing photo…");

      startTransition(async () => {
        try {
          const blob = await downscaleImage(photo);
          setStatus("Uploading…");
          const fd = new FormData();
          fd.append("photo", blob, "original.jpg");
          fd.append("lat", String(lat));
          fd.append("lng", String(lng));
          if (email.trim()) fd.append("finder_email", email.trim());

          const result = await createCase(fd);
          // On success the server action redirects; reaching here means error.
          if (result && "error" in result) {
            setError(result.error);
            setStatus("");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Submission failed.");
          setStatus("");
        }
      });
    },
    [photo, lat, lng, email],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Report an animal</h1>
        <p className="text-sm text-muted-foreground">
          Snap one clear photo and share your location. Our agents will triage the
          case and dispatch the nearest rehabber.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <section aria-labelledby="photo-label" className="flex flex-col gap-3">
          <span id="photo-label" className="text-sm font-medium">
            Photo <span aria-hidden="true">*</span>
          </span>

          <input
            ref={fileInputRef}
            type="file"
            name="photo-input"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="sr-only"
            aria-labelledby="photo-label"
          />

          {previewUrl ? (
            <div className="flex flex-col gap-2">
              {/* object URL preview; intentional <img> to skip Next optimizer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected animal"
                className="aspect-[4/3] w-full rounded-2xl border border-border object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onPickPhoto}
                className="h-11 w-full gap-2"
              >
                <RefreshCcw className="size-4" aria-hidden="true" />
                Retake photo
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={onPickPhoto}
              className="h-14 w-full gap-2 text-base"
            >
              <Camera className="size-5" aria-hidden="true" />
              Take photo
            </Button>
          )}
        </section>

        <section aria-labelledby="loc-label" className="flex flex-col gap-3">
          <span id="loc-label" className="text-sm font-medium">
            Location <span aria-hidden="true">*</span>
          </span>

          {geo.kind === "pending" && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Requesting location…
            </p>
          )}

          {geo.kind === "ok" && (
            <p className="inline-flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium">
                  {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                </span>
                {geo.accuracy != null && (
                  <span className="ml-1 text-muted-foreground">
                    (±{Math.round(geo.accuracy)} m)
                  </span>
                )}
              </span>
            </p>
          )}

          {geo.kind === "manual" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{geo.reason}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    type="number"
                    step="0.0001"
                    min={-90}
                    max={90}
                    required
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    inputMode="decimal"
                    type="number"
                    step="0.0001"
                    min={-180}
                    max={180}
                    required
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll only use this to share the outcome of this case.
          </p>
        </section>

        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : status ? (
            <p className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {status}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="h-12 w-full text-base"
        >
          {isPending ? "Submitting…" : "Submit case"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Not veterinary advice. If the animal is a predator, bat, or clearly
          aggressive, keep your distance and wait for the dispatcher.
        </p>
      </form>
    </main>
  );
}
