import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { X, Download, Plus, Type, Image as ImageIcon, Trash2, Move, Layers } from 'lucide-react';

interface LayerData {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fill?: string;
  url?: string;
  rotation: number;
}

interface LayeredEditorProps {
  baseImageUrl: string;
  onClose: () => void;
  brandName: string;
}

const URLImage = ({ layer, isSelected, onSelect, onChange }: { 
  layer: LayerData; 
  isSelected: boolean; 
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}) => {
  const [img] = useImage(layer.url || '');
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      // @ts-ignore
      trRef.current.nodes([shapeRef.current]);
      // @ts-ignore
      const layer = trRef.current.getLayer();
      if (layer) layer.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        image={img}
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...layer}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(node.height() * scaleY),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

const TextLayer = ({ layer, isSelected, onSelect, onChange }: { 
  layer: LayerData; 
  isSelected: boolean; 
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      // @ts-ignore
      trRef.current.nodes([shapeRef.current]);
      // @ts-ignore
      const layer = trRef.current.getLayer();
      if (layer) layer.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...layer}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          node.scaleX(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: node.fontSize() * scaleX,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            newBox.width = Math.max(30, newBox.width);
            return newBox;
          }}
        />
      )}
    </>
  );
};

export const LayeredEditor: React.FC<LayeredEditorProps> = ({ baseImageUrl, onClose, brandName }) => {
  const [layers, setLayers] = useState<LayerData[]>([
    {
      id: 'bg',
      type: 'image',
      url: baseImageUrl,
      x: 0,
      y: 0,
      width: 800,
      height: 800,
      rotation: 0,
    }
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<any>(null);

  const addText = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLayer: LayerData = {
      id,
      type: 'text',
      text: brandName || 'New Text',
      x: 100,
      y: 100,
      fontSize: 40,
      fill: '#000000',
      rotation: 0,
    };
    setLayers([...layers, newLayer]);
    setSelectedId(id);
  };

  const deleteLayer = () => {
    if (selectedId && selectedId !== 'bg') {
      setLayers(layers.filter(l => l.id !== selectedId));
      setSelectedId(null);
    }
  };

  const handleExportSVG = () => {
    // Basic SVG Export logic
    const width = stageRef.current.width();
    const height = stageRef.current.height();
    
    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
    
    layers.forEach(layer => {
      if (layer.type === 'image') {
        svgContent += `\n  <image x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" xlink:href="${layer.url}" transform="rotate(${layer.rotation}, ${layer.x + (layer.width || 0)/2}, ${layer.y + (layer.height || 0)/2})" />`;
      } else if (layer.type === 'text') {
        svgContent += `\n  <text x="${layer.x}" y="${layer.y + (layer.fontSize || 20)}" font-size="${layer.fontSize}" fill="${layer.fill}" transform="rotate(${layer.rotation}, ${layer.x}, ${layer.y})">${layer.text}</text>`;
      }
    });
    
    svgContent += '\n</svg>';
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `design-layers-${Date.now()}.svg`;
    link.click();
  };

  const handleExportPNG = () => {
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = `design-flat-${Date.now()}.png`;
    link.href = uri;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-surface rounded-2xl overflow-hidden flex flex-col h-[90vh] shadow-2xl border border-border-subtle">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h3 className="text-ink font-bold flex items-center gap-2 text-lg tracking-tight">
                <Layers className="w-5 h-5 text-emerald-500" />
                图层编辑器
              </h3>
              <span className="text-[10px] text-ink-muted font-bold uppercase tracking-widest">Prepress Layer Editor</span>
            </div>
            
            <div className="h-8 w-px bg-border-subtle" />
            
            <div className="flex items-center gap-2">
              <button 
                onClick={addText}
                className="px-3 py-2 hover:bg-ink/5 rounded-xl text-ink-muted hover:text-ink transition-all flex items-center gap-2 text-sm font-medium border border-transparent hover:border-border-subtle"
              >
                <Type className="w-4 h-4" />
                添加文字
              </button>
              <button 
                onClick={deleteLayer}
                disabled={!selectedId || selectedId === 'bg'}
                className="px-3 py-2 hover:bg-red-500/5 rounded-xl text-ink-muted hover:text-red-500 transition-all disabled:opacity-20 flex items-center gap-2 text-sm font-medium border border-transparent hover:border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
                删除图层
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportSVG}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Download className="w-4 h-4" />
              导出 SVG (带图层)
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-ink/5 rounded-xl text-ink-muted hover:text-ink transition-all border border-transparent hover:border-border-subtle"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden relative bg-bg">
          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-12 custom-scrollbar">
            <div className="bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-sm overflow-hidden">
              <Stage
                width={800}
                height={800}
                ref={stageRef}
                onMouseDown={(e) => {
                  const clickedOnEmpty = e.target === e.target.getStage();
                  if (clickedOnEmpty) {
                    setSelectedId(null);
                  }
                }}
              >
                <Layer>
                  {layers.map((layer, i) => {
                    if (layer.type === 'image') {
                      return (
                        <URLImage
                          key={layer.id}
                          layer={layer}
                          isSelected={layer.id === selectedId}
                          onSelect={() => setSelectedId(layer.id)}
                          onChange={(newAttrs) => {
                            const lrs = layers.slice();
                            lrs[i] = newAttrs;
                            setLayers(lrs);
                          }}
                        />
                      );
                    } else {
                      return (
                        <TextLayer
                          key={layer.id}
                          layer={layer}
                          isSelected={layer.id === selectedId}
                          onSelect={() => setSelectedId(layer.id)}
                          onChange={(newAttrs) => {
                            const lrs = layers.slice();
                            lrs[i] = newAttrs;
                            setLayers(lrs);
                          }}
                        />
                      );
                    }
                  })}
                </Layer>
              </Stage>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-72 border-l border-border-subtle bg-surface p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">图层列表</h4>
                <span className="text-[10px] bg-ink/5 px-2 py-0.5 rounded-full text-ink-muted">{layers.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setSelectedId(layer.id)}
                    className={`w-full p-3.5 rounded-xl flex items-center gap-3 transition-all text-left group ${
                      selectedId === layer.id 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-ink/5 border border-transparent text-ink-muted hover:bg-ink/10 hover:text-ink'
                    }`}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${selectedId === layer.id ? 'bg-emerald-500/20' : 'bg-ink/5 group-hover:bg-ink/10'}`}>
                      {layer.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium truncate">
                      {layer.id === 'bg' ? '底图 (印前稿)' : (layer.text || '图片图层')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selectedId && selectedId !== 'bg' && (
              <div className="mt-auto pt-8 border-t border-border-subtle animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h4 className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] mb-4">属性编辑</h4>
                {layers.find(l => l.id === selectedId)?.type === 'text' && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-2">文字内容</label>
                      <input 
                        type="text"
                        value={layers.find(l => l.id === selectedId)?.text || ''}
                        onChange={(e) => {
                          setLayers(layers.map(l => l.id === selectedId ? { ...l, text: e.target.value } : l));
                        }}
                        className="w-full bg-bg border border-border-subtle rounded-xl p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="输入文字..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-2">颜色选择</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color"
                          value={layers.find(l => l.id === selectedId)?.fill || '#000000'}
                          onChange={(e) => {
                            setLayers(layers.map(l => l.id === selectedId ? { ...l, fill: e.target.value } : l));
                          }}
                          className="w-12 h-12 bg-bg border border-border-subtle rounded-xl p-1 cursor-pointer overflow-hidden"
                        />
                        <div className="flex-1 bg-bg border border-border-subtle rounded-xl p-3 text-xs font-mono text-ink-muted">
                          {layers.find(l => l.id === selectedId)?.fill?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-bg border-t border-border-subtle text-center">
          <p className="text-[10px] text-ink-muted font-bold uppercase tracking-[0.25em]">
            SVG FORMAT SUPPORTS ADOBE ILLUSTRATOR / PHOTOSHOP / CORELDRAW WITH LAYERS PRESERVED
          </p>
        </div>
      </div>
    </div>
  );
};
