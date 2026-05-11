import { useRef, useState } from 'react';
import { Paperclip, Upload, X, FileText, Image, File, Loader2 } from 'lucide-react';

export interface AttachedFile {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

interface Props {
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.doc';
const MAX_MB = 10;

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-red-500" />;
  if (['png', 'jpg', 'jpeg'].includes(ext ?? '')) return <Image className="w-3.5 h-3.5 text-blue-500" />;
  return <File className="w-3.5 h-3.5 text-slate-400" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceUploader({ files, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList: FileList) {
    setError(null);
    const file = fileList[0];
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit`);
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error ?? 'Upload failed');
      }

      const data = await res.json();
      const newFile: AttachedFile = {
        url: data.fileUrl,
        name: data.fileName,
        size: data.fileSize,
        uploadedAt: new Date().toISOString(),
      };
      onChange([...files, newFile]);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeFile(index: number) {
    const file = files[index];
    // Best-effort delete from server
    const filename = file.url.split('/').pop();
    if (filename) {
      const token = localStorage.getItem('token');
      await fetch(`/api/uploads/${filename}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {/* Attached files list */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={f.url}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm"
            >
              {fileIcon(f.name)}
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-foreground hover:text-kmi-coral transition-colors"
              >
                {f.name}
              </a>
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(f.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload zone */}
      {!disabled && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
            dragging
              ? 'border-kmi-coral bg-kmi-coral/5'
              : 'border-border hover:border-kmi-coral/50 hover:bg-muted/30'
          }`}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="w-4 h-4 text-kmi-coral animate-spin flex-shrink-0" />
          ) : (
            <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-xs text-muted-foreground">
            {uploading
              ? 'Uploading…'
              : dragging
                ? 'Drop file here'
                : 'Attach file (PDF, PNG, JPG, DOCX · max 10 MB)'}
          </span>
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
