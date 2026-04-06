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
  const [showFolderEdit, setShowFolderEdit] = useState(!getLastFolder());
  const [uploading, setUploading] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [editingPathId, setEditingPathId] = useState<number | null>(null);
  const [editPathValue, setEditPathValue] = useState("");
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
    if (!baseFolder.trim()) {
      toast.warning("Set base folder first", "Click 'change' to set your local screenshots folder path before adding images.");
      setShowFolderEdit(true);
      return;
    }
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const sep = baseFolder.includes("/") ? "/" : "\\";
      const folder = baseFolder.endsWith("\\") || baseFolder.endsWith("/") ? baseFolder : baseFolder + sep;
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

  const handleUpdatePath = async (imgId: number) => {
    if (!editPathValue.trim()) return;
    try {
      // Delete old and re-add with new path (simplest approach)
      const img = images.find((i) => i.id === imgId);
      if (!img) return;
      // Update via backend - we need a PATCH endpoint, but for now re-create
      // Actually just update the file_path in the DB
      const res = await fetch(`/api/task-images/${imgId}/path`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: editPathValue.trim() }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditingPathId(null);
      toast.success("Path updated");
      await loadImages();
    } catch {
      toast.error("Failed to update path");
    }
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
          {/* Base folder — prominent when not set */}
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius)",
            background: !baseFolder.trim() ? "rgba(224,85,85,0.1)" : "var(--bg-input)",
            border: !baseFolder.trim() ? "1px solid rgba(224,85,85,0.3)" : "1px solid var(--border)",
          }}>
            {showFolderEdit ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: !baseFolder.trim() ? "var(--danger)" : "var(--text-secondary)", marginBottom: 6 }}>
                  {!baseFolder.trim() ? "Set your local image folder path (required)" : "Base folder for image paths"}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={baseFolder}
                    onChange={(e) => setBaseFolder(e.target.value)}
                    placeholder="e.g., C:\Users\DoronMarcu\Pictures\Screenshots"
                    autoFocus
                    style={{ ...inputStyle, flex: 1, fontSize: 12, fontFamily: "monospace" }}
                  />
                  <Button variant="primary" onClick={() => {
                    if (!baseFolder.trim()) { toast.warning("Enter a folder path"); return; }
                    saveLastFolder(baseFolder);
                    setShowFolderEdit(false);
                    toast.success("Base folder saved");
                  }} style={{ fontSize: 11, padding: "4px 12px" }}>Save</Button>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                  This is the folder on YOUR computer where screenshots are stored. It will be prepended to filenames when you browse for images.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Base folder:</span>
                <span style={{ color: "var(--text-secondary)", fontFamily: "monospace", flex: 1 }}>{baseFolder}</span>
                <button onClick={() => setShowFolderEdit(true)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>change</button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => { handleBrowseAndUpload(e.target.files); e.target.value = ""; }} />

          {/* Image grid */}
          {images.length === 0 ? (
            <div style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No images attached. Click "+ Add Image" to browse and attach screenshots.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {images.map((img) => (
                <div key={img.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  background: "var(--bg-input)", borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}>
                  {/* Thumbnail */}
                  {img.thumbnail_url ? (
                    <img
                      src={img.thumbnail_url}
                      alt={img.original_name}
                      onClick={() => setFullImageUrl(img.thumbnail_url)}
                      style={{ width: 50, height: 38, objectFit: "cover", cursor: "pointer", borderRadius: 3, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 50, height: 38, borderRadius: 3, flexShrink: 0, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 16 }}>
                      {"\uD83D\uDDBC"}
                    </div>
                  )}
                  {/* Path info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingPathId === img.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input value={editPathValue} onChange={(e) => setEditPathValue(e.target.value)}
                          style={{ ...inputStyle, fontSize: 11, fontFamily: "monospace", padding: "4px 8px" }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdatePath(img.id); }} />
                        <Button variant="primary" onClick={() => handleUpdatePath(img.id)} style={{ fontSize: 10, padding: "2px 8px" }}>ok</Button>
                        <Button variant="secondary" onClick={() => setEditingPathId(null)} style={{ fontSize: 10, padding: "2px 8px" }}>x</Button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>
                          {img.original_name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                          title="Click to edit path"
                          onClick={() => { setEditingPathId(img.id); setEditPathValue(img.file_path); }}>
                          {img.file_path}
                          <span style={{ marginLeft: 4, color: "var(--accent)", fontSize: 9 }}>edit</span>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => handleRemove(img.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "0 4px" }} title="Remove">x</button>
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

export async function getTemplateImagePaths(taskId: number, templateId: number): Promise<string[]> {
  try {
    const imgs = await api.getTaskTemplateImages(taskId, templateId);
    return imgs.map((img) => img.file_path);
  } catch { return []; }
}
