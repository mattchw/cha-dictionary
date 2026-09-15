import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "英漢詞典 · English → 香港繁體";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F7F3",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 16,
            background: "#C0362B",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          查
        </div>
        <div style={{ fontSize: 64, fontWeight: 600, color: "#22201C", marginBottom: 12 }}>
          英漢詞典
        </div>
        <div style={{ fontSize: 32, color: "#6E6B62" }}>English · 香港繁體</div>
      </div>
    ),
    { ...size }
  );
}
