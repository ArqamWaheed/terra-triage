"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { RehabberMapProps } from "./rehabber-map";

const FINDER_ICON_HTML = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"
       fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
       role="img" aria-label="Finder location">
    <circle cx="12" cy="12" r="10" fill="#dbeafe"/>
    <path d="M12 6v12M6 12h12"/>
  </svg>`;

const REHABBER_ICON_HTML = (top: boolean) => `
  <div class="tt-pin ${top ? "tt-pin-top" : ""}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${top ? 34 : 26}" height="${top ? 34 : 26}"
         fill="${top ? "#dc2626" : "#16a34a"}" stroke="#ffffff" stroke-width="1.5"
         role="img" aria-label="${top ? "Top rehabber" : "Rehabber"}">
      <path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.5 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
    </svg>
  </div>`;

function buildDivIcon(html: string, size: [number, number]): L.DivIcon {
  return L.divIcon({
    html,
    className: "tt-marker",
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
}

function FitBounds({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function RehabberMapInner({
  finder,
  ranked,
  className,
}: RehabberMapProps) {
  const top3 = useMemo(() => ranked.slice(0, 3), [ranked]);

  const finderIcon = useMemo(
    () => buildDivIcon(FINDER_ICON_HTML, [28, 28]),
    [],
  );
  const iconTop = useMemo(
    () => buildDivIcon(REHABBER_ICON_HTML(true), [34, 34]),
    [],
  );
  const iconNormal = useMemo(
    () => buildDivIcon(REHABBER_ICON_HTML(false), [26, 26]),
    [],
  );

  const points: Array<[number, number]> = [
    [finder.lat, finder.lng],
    ...top3.map<[number, number]>((r) => [r.rehabber.lat, r.rehabber.lng]),
  ];

  return (
    <figure className={className}>
      <style>{`
        .tt-marker { background: transparent !important; border: 0 !important; }
        .tt-pin { display:grid; place-items:center; filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
        .tt-pin-top { animation: tt-pulse 1.6s ease-in-out infinite; }
        @keyframes tt-pulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tt-pin-top { animation: none; }
        }
        .leaflet-container { height: 360px; width: 100%; border-radius: 0.5rem; }
      `}</style>
      <MapContainer
        center={[finder.lat, finder.lng]}
        zoom={11}
        scrollWheelZoom={false}
        aria-label="Map of finder location and top rehabber candidates"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[finder.lat, finder.lng]} icon={finderIcon}>
          <Popup>You (finder)</Popup>
        </Marker>
        {top3.map((r, i) => (
          <Marker
            key={r.rehabber.id}
            position={[r.rehabber.lat, r.rehabber.lng]}
            icon={i === 0 ? iconTop : iconNormal}
          >
            <Popup>
              <strong>{r.rehabber.name}</strong>
              {r.rehabber.org ? <div>{r.rehabber.org}</div> : null}
              <div>{r.km.toFixed(1)} km away</div>
              <div>score {(r.score * 100).toFixed(0)}</div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Top 3 rehabbers by Terra Triage ranking. Map tiles &copy; OpenStreetMap
        contributors.
      </figcaption>
    </figure>
  );
}
