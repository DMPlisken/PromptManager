import { useState, useRef, useEffect } from "react";
import { api } from "../api/client";
import { useToast } from "./Toast";
import Button from "./ui/Button";
import { Card, CardHeader, CardTitle, CardBody } from "./ui/Card";
import HelpButton from "./HelpButton";

interface PersistedImage {
  id: number;
  file_path: string;
  original_name: string;
  thumbnail_url: string | null;
  display_order: number;
}

const LAST_FOLDER_KEY = "promptflow_last_image_folder";
function getLastFolder(): string { return localStorage.getItem(LAST_FOLDER_KEY) || ""; }
function saveLastFolder(folder: string) { localStorage.setItem(LAST_FOLDER_KEY, folder); }

interface ImageAttachmentsProps {
  taskId: number;
  templateId: number | null;
  onHelp?: (id: string) => void;
}

export default function ImageAttachments({ taskId, templateId, onHelp }: ImageAttachmentsProps) {
  const [images, setImages] = useState<PersistedImage[]>([]);
  const [baseFolder, setBaseFolder] = useState(getLastFolder());
  const [showFolderEdit, setShowFolderEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const loadImages = async () => {
    if (!templateId) { setImages([]); return; }
    try {
      const imgs = await api.getTaskTemplateImages(taskId, templateId);
      setImages(imgs);
    } catch { setImages([]); }
  };

  useEffect(() => { loadImages(); }, [taskId, templateId]);

  const handleBrowseAndUpload = async (files: FileList | null) => {
    if (!files || !templateId) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const folder = baseFolder ? (baseFolder.endsWith("\\") || baseFolder.endsWith("/") ? baseFolder : baseFolder + "\\") : "";
      const filePath = folder + file.name;
      try {
        await api.uploadTaskImage(taskId, templateId, file, filePath, images.length + i);
        toast.success("Image added", file.name);
      } catch (e) {
        toast.error("Upload failed", file.name);
      }
    }
    setUploading(false);
    await loadImages();
  };

  const handleRemove = async (imgId: number) => {
    try {
      await api.deleteTaskImage(imgId);
      await loadImages();
      toast.info("Image removed");
    } catch { toast.error("Failed to remove image"); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    color: "var(--text-primary)", fontSize: 13, outline: "none",
  };

  if (!templateId) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            Image Attachments
            {images.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>({images.length})</span>}
            {onHelp && <HelpButton onClick={() => onHelp("images")} />}
          </CardTitle>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : "+ Add Image"}
          </Button>
        </CardHeader>
        <CardBody>
          {/* Base folder */}
          <div style={{ marginBottom: 10 }}>
            {showFolderEdit ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>Base folder:</span>
                <input value={baseFolder} onChange={(e) => setBaseFolder(e.target.value)}
                  placeholder="e.g., C:\Users\screenshots" style={{ ...inputStyle, flex: 1, fontSize: 12, fontFamily: "monospace" }} />
                <Button variant="primary" onClick={() => { saveLastFolder(baseFolder); setShowFolderEdit(false); }} style={{ fontSize: 11, padding: "4px 10px" }}>Save</Button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ color: "var(--text-muted)" }}>Base folder:</span>
                <span style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{baseFolder || "(not set)"}</span>
                <button onClick={() => setShowFolderEdit(true)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>change</button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => { handleBrowseAndUpload(e.target.files); e.target.value = ""; }} />

          {/* Image grid */}
          {images.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No images attached. Click "+ Add Image" to browse and attach screenshots.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {images.map((img) => (
                <div key={img.id} style={{
                  position: "relative", width: 100, borderRadius: "var(--radius)",
                  border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-input)",
                }}>
                  {/* Thumbnail */}
                  {img.thumbnail_url ? (
                    <img
                      src={img.thumbnail_url}
                      alt={img.original_name}
                      onClick={() => setFullImageUrl(img.thumbnail_url)}
                      style={{ width: 100, height: 75, objectFit: "cover", cursor: "pointer", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: 100, height: 75, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 24 }}>
                      {"\uD83D\uDDBC"}
                    </div>
                  )}
                  {/* Name + remove */}
                  <div style={{ padding: "4px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={img.file_path}>
                      {img.original_name}
                    </span>
                    <button onClick={() => handleRemove(img.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 0, marginLeft: 4 }} title="Remove">x</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Full image overlay */}
      {fullImageUrl && (
        <div onClick={() => setFullImageUrl(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
        }}>
          <img src={fullImageUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </>
  );
}

// Export helper to get image paths for copy
export async function getTemplateImagePaths(taskId: number, templateId: number): Promise<string[]> {
  try {
    const imgs = await api.getTaskTemplateImages(taskId, templateId);
    return imgs.map((img) => img.file_path);
  } catch { return []; }
}
