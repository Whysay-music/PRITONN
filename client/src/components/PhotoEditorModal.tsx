import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCw, Undo2, Check, Send, Paintbrush, Eraser, Sparkles } from 'lucide-react';

interface PhotoEditorModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onClose: () => void;
  onSendPhoto: (editedFile: File, caption?: string) => void;
}

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  isOpen,
  imageFile,
  onClose,
  onSendPhoto,
}) => {
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser'>('brush');
  const [brushColor, setBrushColor] = useState<string>('#ff0055');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [activeFilter, setActiveFilter] = useState<'none' | 'grayscale' | 'sepia' | 'cyberpunk' | 'invert'>('none');
  const [rotation, setRotation] = useState<number>(0);
  const [caption, setCaption] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    if (!isOpen || !imageFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        initCanvas(img, rotation, activeFilter);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(imageFile);
  }, [isOpen, imageFile]);

  const initCanvas = (img: HTMLImageElement, rot: number, filter: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotated90or270 = rot % 180 !== 0;
    const maxW = 600;
    const maxH = 600;

    let targetW = img.width;
    let targetH = img.height;
    const scale = Math.min(maxW / targetW, maxH / targetH, 1);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);

    canvas.width = isRotated90or270 ? targetH : targetW;
    canvas.height = isRotated90or270 ? targetW : targetH;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);

    // Apply CSS-like filter in canvas
    if (filter === 'grayscale') ctx.filter = 'grayscale(100%)';
    else if (filter === 'sepia') ctx.filter = 'sepia(100%)';
    else if (filter === 'cyberpunk') ctx.filter = 'hue-rotate(180deg) saturate(200%) contrast(120%)';
    else if (filter === 'invert') ctx.filter = 'invert(100%)';
    else ctx.filter = 'none';

    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();

    // Save initial state to history
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  if (!isOpen || !imageFile) return null;

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = activeTool === 'eraser' ? '#000000' : brushColor;
    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleStopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 20) historyRef.current.shift();
  };

  const handleUndo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const last = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    if (!canvas || !last) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(last, 0, 0);
  };

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    if (baseImageRef.current) {
      initCanvas(baseImageRef.current, nextRot, activeFilter);
    }
  };

  const handleApplyFilter = (filter: 'none' | 'grayscale' | 'sepia' | 'cyberpunk' | 'invert') => {
    setActiveFilter(filter);
    if (baseImageRef.current) {
      initCanvas(baseImageRef.current, rotation, filter);
    }
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const editedFile = new File([blob], imageFile.name || 'edited_photo.jpg', {
        type: 'image/jpeg',
      });
      onSendPhoto(editedFile, caption.trim() || undefined);
      onClose();
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[var(--tg-sidebar)] rounded-3xl border border-[var(--tg-card-border)] shadow-2xl overflow-hidden flex flex-col text-[var(--tg-text)] max-h-[95vh]">
        {/* Header toolbar */}
        <div className="px-5 py-3 border-b border-[var(--tg-card-border)] flex items-center justify-between bg-[var(--tg-surface)]/60">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Редактор фото</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
              title="Повернуть на 90°"
            >
              <RotateCw size={17} />
            </button>
            <button
              type="button"
              onClick={handleUndo}
              className="p-2 rounded-xl hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
              title="Отменить действие"
            >
              <Undo2 size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canvas Center Area */}
        <div className="relative flex-1 bg-black/80 flex items-center justify-center p-4 min-h-[350px] overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleStartDraw}
            onMouseMove={handleDraw}
            onMouseUp={handleStopDraw}
            onMouseLeave={handleStopDraw}
            onTouchStart={handleStartDraw}
            onTouchMove={handleDraw}
            onTouchEnd={handleStopDraw}
            className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-2xl cursor-crosshair border border-white/10"
          />
        </div>

        {/* Tools and Filters bar */}
        <div className="p-3.5 border-t border-[var(--tg-card-border)] bg-[var(--tg-surface)]/40 flex flex-col gap-3">
          {/* Drawing Tools & Color Palette */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTool('brush')}
                className={`p-2 rounded-xl flex items-center gap-1.5 font-semibold transition cursor-pointer ${
                  activeTool === 'brush' ? 'bg-[var(--tg-accent)] text-white shadow' : 'bg-white/5 text-[var(--tg-text-muted)]'
                }`}
              >
                <Paintbrush size={15} />
                <span>Кисть</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`p-2 rounded-xl flex items-center gap-1.5 font-semibold transition cursor-pointer ${
                  activeTool === 'eraser' ? 'bg-[var(--tg-accent)] text-white shadow' : 'bg-white/5 text-[var(--tg-text-muted)]'
                }`}
              >
                <Eraser size={15} />
                <span>Ластик</span>
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-2">
              {['#ffffff', '#ff0055', '#ffaa00', '#00ff88', '#00d0ff', '#bd00ff'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setBrushColor(c);
                    setActiveTool('brush');
                  }}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    brushColor === c && activeTool === 'brush' ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Brush Size */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--tg-text-muted)]">Размер:</span>
              <input
                type="range"
                min="2"
                max="16"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 accent-[var(--tg-accent)]"
              />
            </div>
          </div>

          {/* Filters strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'none', label: 'Оригинал' },
              { id: 'grayscale', label: 'Ч/Б' },
              { id: 'sepia', label: 'Сепия' },
              { id: 'cyberpunk', label: 'Киберпанк' },
              { id: 'invert', label: 'Инверсия' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleApplyFilter(f.id as any)}
                className={`px-3 py-1 rounded-full font-medium transition cursor-pointer text-[11px] flex-shrink-0 ${
                  activeFilter === f.id
                    ? 'bg-white/20 text-white font-bold border border-white/30'
                    : 'bg-white/5 text-[var(--tg-text-muted)] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Caption input and Send */}
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--tg-card-border)]">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавить подпись к фото..."
              className="flex-1 px-3 py-2 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] rounded-xl text-xs text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none focus:border-[var(--tg-border-accent)]"
            />
            <button
              type="button"
              onClick={handleSend}
              className="px-5 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Send size={14} />
              <span>Отправить</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
