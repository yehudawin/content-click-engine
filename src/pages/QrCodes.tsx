import { useState, useRef } from "react";
import { QrCode, Download, Link2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const SIZES = [
  { label: "קטן", value: 256 },
  { label: "בינוני", value: 512 },
  { label: "גדול", value: 1024 },
];

export default function QrCodes() {
  const [url, setUrl] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState(512);
  const [label, setLabel] = useState("");
  const svgRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("יש להזין כתובת או טקסט");
      return;
    }
    setGenerated(trimmed);
  };

  const handleDownload = (format: "png" | "svg") => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const fileName = (label.trim() || "qr-code").replace(/[^\p{L}\p{N}_-]+/gu, "_");

    if (format === "svg") {
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = `${fileName}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + utf8ToBase64(svgData);
  };

  return (
    <div className="min-h-screen pt-16 lg:pt-0">
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <QrCode className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">QR Codes</h1>
            <p className="text-muted-foreground text-sm">צרו קוד QR לכל קישור או טקסט</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                כתובת URL או טקסט
              </label>
              <div className="relative">
                <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                שם לקובץ (אופציונלי)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="לדוגמה: קמפיין_פסח"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">צבע קוד</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-10 w-14 rounded-md border border-input cursor-pointer bg-background"
                  />
                  <span className="text-xs text-muted-foreground font-mono">{fgColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">צבע רקע</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-14 rounded-md border border-input cursor-pointer bg-background"
                  />
                  <span className="text-xs text-muted-foreground font-mono">{bgColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">גודל הורדה</label>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSize(s.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      size === s.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {s.label}
                    <span className="block text-xs opacity-70">{s.value}px</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
            >
              <QrCode className="h-5 w-5" />
              צור QR
            </button>
          </div>

          {/* Preview */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            {generated ? (
              <div className="flex flex-col items-center gap-5 w-full">
                <div
                  ref={svgRef}
                  className="p-4 rounded-xl border border-border"
                  style={{ backgroundColor: bgColor }}
                >
                  <QRCodeSVG
                    value={generated}
                    size={240}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level="H"
                  />
                </div>
                <p
                  className="text-xs text-muted-foreground text-center break-all max-w-full"
                  dir="ltr"
                >
                  {generated}
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => handleDownload("png")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    <Download className="h-4 w-4" />
                    הורד PNG
                  </button>
                  <button
                    onClick={() => handleDownload("svg")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
                  >
                    <Download className="h-4 w-4" />
                    הורד SVG
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <QrCode className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">הזינו כתובת ולחצו "צור QR"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
