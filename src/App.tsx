/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { 
  Upload, 
  MessageSquare, 
  Image as ImageIcon, 
  Settings, 
  Download, 
  Loader2, 
  CheckCircle2,
  Plus, 
  X,
  FileText,
  Layout,
  ShoppingBag,
  Mic,
  Square,
  Box,
  Layers,
  Store,
  Rotate3d,
  Share2,
  Copy,
  Check,
  Presentation,
  Images,
  Sun,
  Moon,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { LayeredEditor } from './components/LayeredEditor';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, useTexture, PerspectiveCamera, Environment, ContactShadows, RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';
import '@google/model-viewer';

// Global types for AI Studio
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        poster?: string;
        'shadow-intensity'?: string;
        'auto-rotate'?: boolean;
      }, HTMLElement>;
    }
  }
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Helper for API retries
const generateContentWithRetry = async (ai: any, params: any, maxRetries = 5) => {
  let delay = 3000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      // Robust detection of retryable errors
      const errorStr = String(error).toLowerCase();
      const message = String(error?.message || "").toLowerCase();
      const status = String(error?.status || "").toLowerCase();
      
      const isRetryable = 
        errorStr.includes('503') || 
        errorStr.includes('500') ||
        errorStr.includes('high demand') || 
        errorStr.includes('unavailable') ||
        errorStr.includes('internal error') ||
        message.includes('503') || 
        message.includes('500') ||
        message.includes('high demand') || 
        message.includes('internal error') ||
        status.includes('unavailable') ||
        status.includes('internal');

      if (isRetryable && i < maxRetries - 1) {
        // Add jitter to avoid synchronized retries
        const jitter = Math.random() * 1000;
        const finalDelay = delay + jitter;
        
        console.warn(`API busy (503/Unavailable), retrying in ${Math.round(finalDelay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));
        
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
};

// 3D Product Component
function ProductModel({ textureUrl, shape = 'box' }: { textureUrl: string, shape?: string }) {
  const texture = useTexture(textureUrl);
  const meshRef = useRef<THREE.Mesh>(null);

  // Calculate aspect ratio to prevent stretching
  const img = texture.image as any;
  const imageAspect = img?.width ? img.width / img.height : 1;
  
  // Simple logic to choose geometry based on detected shape
  const safeShape = String(shape || "").toLowerCase();
  const isBag = safeShape.includes('bag') || safeShape.includes('pouch');
  
  // Base dimensions
  const height = 3.5;
  const width = height * imageAspect;
  
  return (
    <group>
      {isBag ? (
        // Bag/Pouch Shape: Tapered cylinder for a more organic pouch look
        <mesh ref={meshRef as any} castShadow receiveShadow scale={[width * 0.5, height * 0.5, 0.2]}>
          <cylinderGeometry args={[1, 1.1, 2, 64]} />
          <meshStandardMaterial 
            map={texture} 
            roughness={0.4} 
            metalness={0.1}
            envMapIntensity={1.2}
          />
        </mesh>
      ) : (
        // Standard Box Shape: Adjusted to match texture aspect ratio
        <RoundedBox 
          ref={meshRef as any}
          args={[width * 0.8, height * 0.8, 1]} 
          radius={0.05} 
          smoothness={4}
          castShadow 
          receiveShadow
        >
          <meshStandardMaterial 
            map={texture} 
            roughness={0.2} 
            metalness={0.1}
            envMapIntensity={1.5}
          />
        </RoundedBox>
      )}
    </group>
  );
}

function ThreeDViewer({ imageUrl, shape }: { imageUrl: string, shape?: string }) {
  const [viewMode, setViewMode] = useState<'3d' | 'ar'>('3d');

  if (viewMode === 'ar') {
    return (
      <div className="w-full h-[600px] bg-bg rounded-[2.5rem] overflow-hidden relative border border-border-subtle shadow-2xl group flex flex-col items-center justify-center">
        <div className="absolute top-8 left-8 z-10">
          <div className="flex items-center gap-3 bg-surface/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-border-subtle shadow-sm">
            <Box className="w-5 h-5 text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink uppercase tracking-[0.2em]">AR 增强现实预览</span>
              <span className="text-[9px] text-ink-muted uppercase tracking-widest font-bold">WebXR / Scene Viewer 模式</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setViewMode('3d')}
          className="absolute top-8 right-8 z-10 p-3 bg-surface/80 hover:bg-surface backdrop-blur-md rounded-2xl border border-border-subtle text-ink-muted hover:text-ink transition-all shadow-sm"
        >
          <Rotate3d className="w-5 h-5" />
        </button>

        {/* @ts-ignore */}
        <model-viewer
          src="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          poster="poster.webp"
          shadow-intensity="1"
          auto-rotate
          style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
        >
          <button slot="ar-button" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-3">
            <Box className="w-5 h-5" />
            在您的空间中查看 (AR)
          </button>
          {/* @ts-ignore */}
        </model-viewer>

        <div className="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-surface/60 backdrop-blur-md rounded-full border border-border-subtle text-[10px] text-ink-muted uppercase tracking-widest font-bold">
          移动端支持原生 AR 体验
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] bg-bg rounded-[2.5rem] overflow-hidden relative border border-border-subtle shadow-2xl group">
      <div className="absolute top-8 left-8 z-10">
        <div className="flex items-center gap-3 bg-surface/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-border-subtle shadow-sm">
          <Rotate3d className="w-5 h-5 text-emerald-500" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-ink uppercase tracking-[0.2em]">360° 交互预览</span>
            <span className="text-[9px] text-ink-muted uppercase tracking-widest font-bold">实时 PBR 渲染引擎</span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setViewMode('ar')}
        className="absolute top-8 right-8 z-10 p-3 bg-surface/80 hover:bg-surface backdrop-blur-md rounded-2xl border border-border-subtle text-ink-muted hover:text-ink transition-all flex items-center gap-2 shadow-sm"
      >
        <Box className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">开启 AR 模式</span>
      </button>
      
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 35 }}>
        <color attach="background" args={[document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f0f10' : '#f8f9fa']} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <Stage 
            intensity={0.5} 
            environment="studio" 
            shadows={{ type: 'contact', opacity: 0.2, blur: 2 }} 
            adjustCamera={true}
          >
            <ProductModel textureUrl={imageUrl} shape={shape} />
          </Stage>
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          minDistance={2}
          maxDistance={10}
          dampingFactor={0.05}
          enableDamping={true}
          makeDefault
        />
        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      </Canvas>

      <div className="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-surface/60 backdrop-blur-md rounded-full border border-border-subtle text-[10px] text-ink-muted uppercase tracking-widest font-bold">
        鼠标拖拽旋转 • 滚轮缩放 • 触控交互
      </div>
    </div>
  );
}
type Resolution = '512' | '1K' | '2K' | '4K';
type AspectRatio = '1:1' | '1:4' | '1:8' | '2:3' | '3:2' | '3:4' | '4:1' | '4:3' | '4:5' | '5:4' | '8:1' | '9:16' | '16:9' | '21:9' | 'Auto';
type OutputType = 'mockup' | 'prepress' | 'retail' | 'vi' | 'threeD';

interface GeneratedImage {
  id: string;
  url: string;
  type: OutputType;
  prompt: string;
  aspectRatio: string;
  shape?: string;
  resolution?: Resolution;
}

interface AssetSlot {
  id: number;
  name: string;
  file: File | null;
  preview: string | null;
}

export default function App() {
  // State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [chatText, setChatText] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Auto');
  const [selectedOutputs, setSelectedOutputs] = useState<OutputType[]>(['mockup', 'prepress', 'retail', 'vi']);
  const [assets, setAssets] = useState<AssetSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<Record<string, boolean>>({});
  const [upgradingImages, setUpgradingImages] = useState<{[key: string]: boolean}>({});
  const [shareStatus, setShareStatus] = useState<{[key: string]: boolean}>({});

  const handleUpgradeResolution = async (img: GeneratedImage, targetResolution: Resolution) => {
    if (upgradingImages[img.id]) return;
    
    setUpgradingImages(prev => ({ ...prev, [img.id]: true }));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = img.url.includes(',') ? img.url.split(',')[1] : img.url;
      
      const genResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-image-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Data } },
            { text: `Upscale and enhance this exact image to high resolution. Maintain exact composition, colors, and content. Original prompt for reference: ${img.prompt}` }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: img.aspectRatio as any,
            imageSize: (targetResolution === '512' ? '512px' : targetResolution) as any
          }
        }
      });

      const imagePart = genResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        setResults(prev => prev.map(r => {
          if (r.id === img.id) {
            return {
              ...r,
              url: `data:image/png;base64,${imagePart.inlineData.data}`,
              resolution: targetResolution
            };
          }
          // If this was the mockup, also update the 3D preview if it exists
          if (img.type === 'mockup' && r.type === 'threeD') {
             return {
               ...r,
               url: `data:image/png;base64,${imagePart.inlineData.data}`,
               resolution: targetResolution
             };
          }
          return r;
        }));
      }
    } catch (err) {
      console.error('Failed to upgrade resolution:', err);
      alert('分辨率升级失败，请重试。');
    } finally {
      setUpgradingImages(prev => ({ ...prev, [img.id]: false }));
    }
  };

  const handleShare = async (img: GeneratedImage) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '智能包装设计提案',
          text: `这是为您设计的 ${img.type} 方案，请查收。`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(img.url);
        setShareStatus(prev => ({ ...prev, [img.id]: true }));
        setTimeout(() => {
          setShareStatus(prev => ({ ...prev, [img.id]: false }));
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [feedbackList, setFeedbackList] = useState<string[]>([]);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(!!process.env.GEMINI_API_KEY);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per guidelines to avoid race condition
    }
  };

  // Refs
  const chatScreenshotRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleAssetUpload = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    const availableSlots = 14 - assets.length;
    const filesToAdd = newFiles.slice(0, availableSlots);

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAssets(prev => {
          if (prev.length >= 14) return prev;
          const newId = prev.length > 0 ? Math.max(...prev.map(a => a.id)) + 1 : 1;
          return [...prev, {
            id: newId,
            name: `素材${newId}`,
            file,
            preview: e.target?.result as string
          }];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAsset = (id: number) => {
    setAssets(prev => prev.filter(slot => slot.id !== id));
  };

  const toggleOutputType = (type: OutputType) => {
    setSelectedOutputs(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const refineRequirements = async () => {
    if (!chatText.trim()) return;
    setIsRefining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const assetParts = (await Promise.all(
        assets
          .filter(a => a.file && a.preview)
          .map(async (asset, index) => {
            const base64Data = asset.preview!.includes(',') ? asset.preview!.split(',')[1] : asset.preview!;
            return [
              { text: `素材${index + 1} (${asset.name}):` },
              {
                inlineData: {
                  mimeType: asset.file!.type,
                  data: base64Data
                }
              }
            ];
          })
      )).flat();

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              ...assetParts,
              { text: `你是一个专业的包装设计需求分析师。请将以下凌乱的聊天记录、语音转义文字或初步想法，精简提炼成最终的包装设计要求。
              
              核心目标：
              1. 彻底忽略所有沟通过程、客套话、表情符号、时间戳和无关闲聊。
              2. 必须明确并包含以下字段（如果信息缺失请根据上下文推断或标注未知，但不仅限于这些字段）：
                 产品名称：
                 产品品类：
                 净含量：
                 包装材质：
                 设计风格：
              3. 关键指令：如果提供了辅助设计素材（图片），你必须在提炼的要求中明确说明如何使用、参照或替换这些素材。
                 例如：“使用素材1中的第一个马车图案替换原‘银彭城’标志”、“参照素材2的整体配色方案”等。
                 请务必指明是哪个素材（素材1、素材2...）以及具体的视觉元素。
              4. 严禁使用任何星号（*）、井号（#）、加号（+）或其他Markdown符号。
              5. 禁止使用粗体、斜体或带符号的列表。
              6. 保持输出内容为纯文本，每行一个要点，使用“：”分隔键值，看起来清爽、专业。
              
              待提炼聊天内容：
              ${chatText}` }
            ]
          }
        ],
      });

      if (response.text) {
        setChatText(response.text.trim());
      }
    } catch (error) {
      console.error("Refine Error:", error);
      alert("提炼失败，请重试。");
    } finally {
      setIsRefining(false);
    }
  };

  const handleMultipleOcr = async (files: FileList) => {
    setIsOcrLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const fileArray = Array.from(files);
      const parts = (await Promise.all(fileArray.map(async (file, index) => {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        return [
          { text: `素材${index + 1} (${file.name}):` },
          { inlineData: { mimeType: file.type, data: base64 } }
        ];
      }))).flat();

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              ...parts,
              { text: `从这些聊天截图中提取并提炼最终的包装设计要求。忽略沟通过程、表情、时间戳和闲聊。
              必须明确并包含以下字段（但不仅限于这些）：
              产品名称：
              产品品类：
              净含量：
              包装材质：
              设计风格：
              
              关键指令：对于识别出的“辅助设计素材”，你必须在提炼的要求中明确说明如何使用、参照或替换这些素材。
              例如：“使用素材1中的第一个马车图案替换原‘银彭城’标志”、“参照素材2的整体配色方案”等。
              请务必指明是哪个素材（素材1、素材2...）以及具体的视觉元素。
              
              保持输出为纯文本，每行一个要点，使用“：”分隔键值。严禁使用星号（*）或其他复杂的Markdown符号（如粗体、斜体、带符号列表）。
              
              同时，请识别哪些图片是“辅助设计素材”。这些素材应该是：
              1. 无法通过文字提取的图案、纹理、插画。
              2. 需要作为设计参考的风格图、实拍图或Logo。
              
              返回 JSON 格式：
              {
                "requirements": "提炼后的设计要求字符串（纯文本，每行一个要点）",
                "usefulImageIndices": [0, 1, ...] // 哪些图片的索引是值得作为辅助设计素材的
              }` }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.requirements) {
        setChatText(prev => prev + (prev ? '\n' : '') + result.requirements);
      }

      // Automatically add useful images to assets
      if (Array.isArray(result.usefulImageIndices)) {
        const usefulFiles = result.usefulImageIndices
          .filter((idx: number) => idx >= 0 && idx < fileArray.length)
          .map((idx: number) => fileArray[idx]);
        
        if (usefulFiles.length > 0) {
          handleAssetUpload(usefulFiles);
        }
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        setHasApiKey(false);
        alert("API 密钥权限不足。请重新关联密钥。");
      } else {
        alert("截图提取失败，请重试。");
      }
    } finally {
      setIsOcrLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("无法访问麦克风，请检查权限设置。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessingAudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });
      const base64 = await base64Promise;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'audio/webm', data: base64 } },
              { text: "提炼最终的包装设计要求。忽略沟通过程、客套话和闲聊。必须明确并包含以下字段（但不仅限于这些）：产品名称：、产品品类：、净含量：、包装材质：、设计风格：。保持输出为纯文本，每行一个要点，使用“：”分隔键值。严禁使用星号（*）或其他复杂的Markdown符号（如粗体、斜体、带符号列表）。内容清爽、专业、易读。" }
            ]
          }
        ]
      });

      if (response.text) {
        setChatText(prev => prev + (prev ? '\n' : '') + response.text);
      }
    } catch (error: any) {
      console.error("Audio Processing Error:", error);
      alert("音频处理失败，请重试。");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const generateProposal = async () => {
    if (!chatText && assets.every(a => !a.file)) return;
    
    // Backup previous mockup for reference before clearing results
    const previousMockup = results.find(r => r.type === 'mockup');
    
    setIsGenerating(true);
    setResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // 1. Analyze assets to get visual identity
      let brandContext = "";
      const firstAsset = assets.find(a => a.file);
      if (firstAsset && firstAsset.file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(firstAsset.file!);
        });
        const assetBase64 = await base64Promise;
        
        const assetAnalysis = await generateContentWithRetry(ai, {
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { inlineData: { mimeType: firstAsset.file.type, data: assetBase64 } },
                { text: "Analyze this image. If it's a logo, what is the brand name? What are the primary colors and design style? If it's a product or style reference, describe its key visual elements. Return a brief description for an image generation prompt." }
              ]
            }
          ]
        });
        brandContext = assetAnalysis.text || "";
      }

      // 2. Analyze chat and assets to get context
      const feedbackContext = feedbackList.filter(f => f.trim()).map((f, i) => `Feedback ${i+1}: ${f}`).join('\n');
      
      const analysisResponse = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: `Analyze this chat log, brand context, and user feedback to determine the product type, brand style, and best aspect ratio for packaging design.
        Chat: ${chatText}
        Brand Context from Assets: ${brandContext}
        User Feedback on previous design: ${feedbackContext}
        Other Assets: ${assets.filter(a => a.file).map(a => a.name).join(', ')}
        
        CRITICAL INSTRUCTION: 
        1. AVOID "AI-style" or "plastic" looks. 
        2. Use professional photography and material science terminology.
        3. UNIFIED DESIGN SYSTEM: The "mockup" (3D包装效果图) is the MASTER DESIGN. All other outputs (prepress, ppt, carousel, retail, ecommerce, visual_comm) MUST strictly follow the visual identity established in the mockup (exact colors, fonts, layout, materials, and brand elements).
        4. MOCKUP PERSPECTIVE: The "mockup" MUST be a professional studio photograph from a 3/4 side view (three-quarter view). This is essential to showcase the depth, front panel, and side panel simultaneously.
        5. ASSET INTEGRATION: If the Chat text contains explicit instructions on how to use specific assets (e.g., "使用素材1替换Logo", "参照素材2的底纹"), you MUST strictly follow these instructions in the generated prompts.
        6. For productDescription, provide a concise summary of the FINAL design requirements. STRICTLY FORBIDDEN: Do not use asterisks (*), bolding, italics, or complex markdown. Keep it pure text, professional, and clean.
        7. Simulate specific surface physics: 
           - For Matte: "Micro-granular surface scattering, zero specular glare, soft-touch tactile texture."
           - For Glossy: "Sharp ray-traced reflections, high-contrast specular highlights, deep gloss depth."
           - For Metallic: "Anisotropic reflections, brushed metal micro-scratches, realistic Fresnel falloff."
           - For Paper: "Visible cellulose fibers, uncoated ink absorption, natural paper tooth."
           - For Heat Shrink Film: "Tight-fitting, high-gloss transparent plastic wrap, subtle warping at edges, realistic refraction, conforms perfectly to product geometry."
           - For Adhesive Labels: "Distinct physical thickness, visible edge shadow, semi-matte or glossy finish, clearly layered on top of the base material, sharp graphic print."
        7. For Prepress (prepress): Generate a STRICTLY 2D FLAT UNFOLDED LAYOUT based on the Master Design.
        8. For Brand Materials (vi): Design REAL-WORLD advertising campaigns featuring the Master Design in high-end environments.
        
        Return a JSON object with:
        {
          "productDescription": "brief description (NO ASTERISKS)",
          "productShape": "box or bag",
          "brandName": "extracted brand name in the language of the design",
          "brandLanguage": "zh or en",
          "brandStyle": "modern/classic/etc",
          "isChineseMarket": true/false,
          "recommendedAspectRatio": "1:1/3:4/4:3/9:16/16:9",
          "prompts": {
            "mockup": "Master Design: High-end commercial studio photography of the 3D packaging. Perspective: STRICT 3/4 side view (three-quarter view) to showcase depth and multiple panels. Shot on a professional high-resolution camera, 100mm macro, f/8. Visible micro-textures and realistic ink absorption. Lighting: Professional studio softbox lighting with natural falloff.",
            "prepress": "A strictly 2D flat unfolded layout (印前平面展开图) based on the Master Design. This is NOT a 3D mockup. It must show the entire packaging structure flattened out as a single continuous sheet. Include: 1. Red die-lines (红色刀版线) showing folds and cuts. 2. 3mm bleed lines (出血线). 3. CMYK color calibration bars (色标条). 4. Technical annotations. The design must be perfectly aligned for rotogravure printing (凹版印刷). High-density vector-style graphics, absolutely no perspective, no shadows, no 3D effects.",
            "ppt": "A professional high-end presentation slide for a design proposal featuring the Master Design. Aspect ratio 16:9. The artwork content is an editorial-style layout featuring a sophisticated grid, premium font pairings, and a clear visual narrative. The product is integrated into the composition with artistic flair, using overlapping elements and balanced negative space.",
            "carousel": [
              {
                "scene": "Hero_Banner",
                "aspectRatio": "16:9",
                "prompt": "A high-impact e-commerce hero banner featuring the Master Design. The artwork content is a complete piece of marketing design: a bold, stylized brand slogan, promotional badges with elegant glassmorphism effects, and a professional layout."
              },
              {
                "scene": "Detail_CloseUp",
                "aspectRatio": "16:9",
                "prompt": "An e-commerce feature banner focusing on the craftsmanship of the Master Design. The artwork content features exquisite typography explaining the product's unique selling points. A macro close-up of the product is integrated into a clean, minimalist graphic design."
              },
              {
                "scene": "Lifestyle_Context",
                "aspectRatio": "16:9",
                "prompt": "A lifestyle marketing banner featuring the Master Design. The artwork content shows the product in a high-end, aspirational usage context, framed by professional advertising copy and a sophisticated layout."
              }
            ],
            "retail": "A realistic supermarket shelf selling scene featuring the Master Design. The product is stocked in multiple units on a standard retail metal shelf, surrounded by other real-world consumer goods. Includes yellow price tags (shelf talkers). Realistic fluorescent supermarket lighting.",
            "ecommerce": "A professional e-commerce product page design featuring the Master Design. [If Chinese: Taobao/Tmall style mobile detail page. If International: Amazon style desktop product page]. Focus on realistic UI layout and product hero shot.",
            "visual_comm": [
              {
                "scene": "Chinese_Subway",
                "aspectRatio": "9:16",
                "prompt": "An authentic on-location photograph of a Shanghai subway station featuring an advertising poster for the Master Design. Realistic environmental details: sharp reflections, subtle dust, and commuters in motion blur. The poster itself features a sophisticated graphic design."
              },
              {
                "scene": "Mall_Hanging_Banner",
                "aspectRatio": "1:4",
                "prompt": "A realistic photo in a luxury shopping mall atrium featuring a massive vertical hanging banner of the Master Design. High-tension vinyl with subtle, natural ripples. Visible industrial hanging hardware. Authentic architectural scale."
              },
              {
                "scene": "Outdoor_Billboard",
                "aspectRatio": "16:9",
                "prompt": "A wide-angle street photograph of a massive outdoor billboard in a city center featuring the Master Design. Realistic urban context: distant skyscrapers and street lights. The billboard shows realistic vinyl texture with subtle tension lines."
              }
            ]
          }
        }
      }`,
        config: { responseMimeType: "application/json" }
      });

      const analysisData = JSON.parse(analysisResponse.text || '{}');
      setAnalysis(analysisData);
      const finalAspectRatio = aspectRatio === 'Auto' ? analysisData.recommendedAspectRatio || '1:1' : aspectRatio;

      const newResults: GeneratedImage[] = [];
      let masterMockupBase64 = "";

      // Initialize progress for all selected outputs
      const initialProgress: Record<string, boolean> = {};
      selectedOutputs.forEach(type => initialProgress[type] = true);
      setGenerationProgress(initialProgress);

      // 3. Sequential Generation for Consistency
      // Priority 1: Mockup (The Master Design)
      if (selectedOutputs.includes('mockup')) {
        const parts: any[] = [];
        
        // If we have feedback and a previous mockup, use it as reference
        if (feedbackList.length > 0 && previousMockup) {
          const base64Data = previousMockup.url.includes(',') ? previousMockup.url.split(',')[1] : previousMockup.url;
          parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
        } else if (firstAsset?.file && firstAsset.preview) {
          const base64Data = firstAsset.preview.includes(',') ? (firstAsset.preview as string).split(',')[1] : firstAsset.preview;
          parts.push({ inlineData: { mimeType: firstAsset.file.type, data: base64Data } });
        }

        parts.push({ text: `${analysisData.prompts.mockup}. Brand name: ${analysisData.brandName}. ${feedbackList.length > 0 ? 'Apply the following modifications: ' + feedbackList.join('; ') : ''}` });

        const mockupAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const genResponse = await generateContentWithRetry(mockupAi, {
          model: "gemini-3.1-flash-image-preview",
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: finalAspectRatio as any,
              imageSize: (resolution === '512' ? '512px' : resolution) as any
            }
          }
        });

        const imagePart = genResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          masterMockupBase64 = imagePart.inlineData.data;
          newResults.push({
            id: 'master-mockup-' + Date.now(),
            url: `data:image/png;base64,${masterMockupBase64}`,
            type: 'mockup',
            prompt: analysisData.prompts.mockup,
            aspectRatio: finalAspectRatio,
            resolution: resolution
          });
          setResults([...newResults]); // Show progress
        }
        setGenerationProgress(prev => ({ ...prev, mockup: false }));
      }

      // Priority 2: 3D Preview (Instant if we have mockup)
      if (selectedOutputs.includes('threeD') && masterMockupBase64) {
        newResults.push({
          id: '3d-preview-' + Date.now(),
          url: `data:image/png;base64,${masterMockupBase64}`,
          type: 'threeD',
          prompt: 'Interactive 3D Preview',
          aspectRatio: '1:1',
          shape: analysisData.productShape || 'box',
          resolution: resolution
        });
        setResults([...newResults]);
        setGenerationProgress(prev => ({ ...prev, threeD: false }));
      }

      // Priority 3: Other outputs using Mockup as reference (Parallel Generation)
      const otherTypes = selectedOutputs.filter(t => t !== 'mockup' && t !== 'threeD');
      const generationTasks: Promise<void>[] = [];

      for (const type of otherTypes) {
        let items: any[] = [];
        if (type === 'vi') {
          items = Array.isArray(analysisData.prompts.visual_comm) ? analysisData.prompts.visual_comm : [];
        } else {
          items = [{ prompt: analysisData.prompts[type], aspectRatio: (type === 'prepress') ? '1:1' : finalAspectRatio }];
        }
        
        for (const item of items) {
          const promptText = typeof item === 'object' ? item.prompt : item;
          let itemAspectRatio = typeof item === 'object' ? item.aspectRatio : ((type === 'prepress') ? '1:1' : finalAspectRatio);
          
          if (!promptText) continue;

          const task = (async () => {
            // Add a small staggered delay based on index to avoid hitting the API too hard simultaneously
            const index = otherTypes.indexOf(type);
            const itemIndex = items.indexOf(item);
            await new Promise(resolve => setTimeout(resolve, (index * 1000) + (itemIndex * 500)));

            // Create a new instance right before the call to ensure latest API key
            const taskAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const parts: any[] = [];
            
            if (masterMockupBase64) {
              parts.push({ inlineData: { mimeType: 'image/png', data: masterMockupBase64 } });
            }
            
            // Add all uploaded assets as inlineData
            for (const asset of assets) {
              if (asset.file && asset.preview) {
                const base64Data = asset.preview.includes(',') ? (asset.preview as string).split(',')[1] : asset.preview;
                parts.push({ inlineData: { mimeType: asset.file.type, data: base64Data } });
              }
            }

            parts.push({ text: `${promptText}. Maintain exact colors and brand identity: ${analysisData.brandName}.` });

            try {
              const genResponse = await generateContentWithRetry(taskAi, {
                model: "gemini-3.1-flash-image-preview",
                contents: { parts },
                config: {
                  imageConfig: {
                    aspectRatio: itemAspectRatio as any,
                    imageSize: (resolution === '512' ? '512px' : resolution) as any
                  }
                }
              });

              const imagePart = genResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
              if (imagePart?.inlineData) {
                const result: GeneratedImage = {
                  id: Math.random().toString(36).substr(2, 9),
                  url: `data:image/png;base64,${imagePart.inlineData.data}`,
                  type: type as any,
                  prompt: promptText,
                  aspectRatio: itemAspectRatio,
                  resolution: resolution
                };
                newResults.push(result);
                setResults(prev => [...prev, result]); // Real-time update
              }
            } catch (err) {
              console.error(`Failed to generate ${type}:`, err);
            } finally {
              setGenerationProgress(prev => ({ ...prev, [type]: false }));
            }
          })();
          
          generationTasks.push(task);
        }
      }

      await Promise.all(generationTasks);
      setResults([...newResults]);
    } catch (error: any) {
      console.error("Generation Error:", error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403") || errorMessage.toLowerCase().includes("not found")) {
        setHasApiKey(false);
        if (errorMessage.toLowerCase().includes("not found")) {
          await handleSelectKey();
        } else {
          alert("API 密钥权限不足或未开启计费。请重新关联一个已开启计费的 Google Cloud 项目密钥。");
        }
      } else {
        alert("生成失败: " + errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    if (results.length === 0) return;
    
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    const lang = analysis?.brandLanguage || 'zh';
    const brand = analysis?.brandName || '未命名品牌';
    const zipName = `${brand}龙锦包装设计提案v1.0版本.zip`;

    const typeNames: Record<string, Record<string, string>> = {
      zh: {
        mockup: '效果图',
        prepress: '印前展开图',
        retail: '商超场景',
        vi: '品牌视觉',
        ppt: '提案幻灯片',
        carousel: '电商主图',
        ecommerce: '详情页',
        threeD: '3D预览'
      },
      en: {
        mockup: 'Mockup',
        prepress: 'Prepress',
        retail: 'Retail_Scene',
        vi: 'Brand_Identity',
        ppt: 'Presentation',
        carousel: 'Carousel',
        ecommerce: 'E-commerce',
        threeD: '3D_Preview'
      }
    };

    const currentTypeNames = typeNames[lang] || typeNames.zh;

    const promises = results.map(async (img, index) => {
      const base64Data = img.url.split(',')[1];
      const typeName = currentTypeNames[img.type] || img.type;
      const fileName = `${typeName}_${index + 1}.png`;
      zip.file(fileName, base64Data, { base64: true });
    });

    await Promise.all(promises);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSingleImage = (img: GeneratedImage) => {
    const lang = analysis?.brandLanguage || 'zh';
    const typeNames: Record<string, Record<string, string>> = {
      zh: { mockup: '效果图', prepress: '印前展开图', retail: '商超场景', vi: '品牌视觉', ppt: '提案幻灯片', carousel: '电商主图', ecommerce: '详情页', threeD: '3D预览' },
      en: { mockup: 'Mockup', prepress: 'Prepress', retail: 'Retail_Scene', vi: 'Brand_Identity', ppt: 'Presentation', carousel: 'Carousel', ecommerce: 'E-commerce', threeD: '3D_Preview' }
    };
    const currentTypeNames = typeNames[lang] || typeNames.zh;
    const typeName = currentTypeNames[img.type] || img.type;
    downloadImage(img.url, `${typeName}_${img.id.slice(0, 4)}.png`);
  };

  const downloadPDF = (img: GeneratedImage) => {
    const lang = analysis?.brandLanguage || 'zh';
    const brand = analysis?.brandName || '未知品牌';
    const pdf = new jsPDF({
      orientation: img.aspectRatio === '16:9' || img.aspectRatio === '4:3' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgProps = pdf.getImageProperties(img.url);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Add production metadata
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    const isPrepress = img.type === 'prepress';
    const title = '智能包装设计提案 - 印前生产稿';
    
    pdf.text(title, 10, 10);
    pdf.text(`生成日期: ${new Date().toLocaleString()}`, 10, 15);
    pdf.text(`品牌: ${img.prompt.split('Brand name: ')[1]?.split('.')[0] || '未知'}`, 10, 20);
    
    // Add the image
    pdf.addImage(img.url, 'PNG', 0, 30, pdfWidth, pdfHeight);
    
    // Add technical callouts only for prepress
    if (isPrepress) {
      pdf.addPage();
      pdf.setTextColor(0);
      pdf.setFontSize(14);
      pdf.text("印前生产说明 (Technical Specifications)", 10, 20);
      
      pdf.setFontSize(10);
      pdf.text("1. 刀版层 (Die-line Layer): 已嵌入主视觉图。请根据红色线条进行模切。", 10, 40);
      pdf.text("2. 视觉层 (Artwork Layer): 采用 300DPI 高清渲染，支持 4色 (CMYK) 印刷。", 10, 50);
      pdf.text("3. 工艺层 (Finishing Layer): 建议在 Logo 区域使用 UV 局部上光或烫金工艺。", 10, 60);
      pdf.text("4. 颜色标准 (Color Standard): 请参考文件侧边 CMYK 色标条进行校色。", 10, 70);
    }

    pdf.save(`${brand}龙锦包装设计提案v1.0版本-${img.type}.pdf`);
  };

  const downloadAllLegacy = () => {
    results.forEach((img, index) => {
      downloadImage(img.url, `提案-${img.type}-${index + 1}.png`);
    });
  };

  const handleReset = () => {
    setResults([]);
    setFeedbackList([]);
    setShowFeedbackInput(false);
  };

  const addFeedbackField = () => {
    setFeedbackList(prev => [...prev, '']);
    setShowFeedbackInput(true);
  };

  const updateFeedback = (index: number, value: string) => {
    setFeedbackList(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeFeedback = (index: number) => {
    setFeedbackList(prev => prev.filter((_, i) => i !== index));
    if (feedbackList.length <= 1) setShowFeedbackInput(false);
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-emerald-500/30">
      {/* API Key Selection Overlay Removed */}

      <div className="flex h-screen overflow-hidden">
        
        {/* Left Column: Input Area */}
        <aside className="w-[450px] border-r border-border-subtle flex flex-col bg-surface/50 backdrop-blur-xl">
          <header className="h-[64px] px-8 py-2 border-b border-border-subtle sticky top-0 z-30 bg-surface/80 backdrop-blur-md flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Box className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black tracking-tight text-ink leading-none">
                    智能包装设计提案系统
                  </h1>
                </div>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-md bg-bg border border-border-subtle text-ink hover:border-emerald-500/50 transition-all flex items-center gap-2 group shadow-sm"
                title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
              >
                {theme === 'dark' ? <Sun className="w-3 h-3 group-hover:rotate-45 transition-transform" /> : <Moon className="w-3 h-3 group-hover:-rotate-12 transition-transform" />}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {/* Chat Input */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black uppercase tracking-widest text-ink-muted flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> 需求输入
                </label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                      isRecording ? 'text-red-500 hover:text-red-400' : 'text-emerald-500 hover:text-emerald-400'
                    }`}
                  >
                    {isRecording ? (
                      <><div className="w-2 h-2 bg-red-500 rounded-full animate-ping" /> 停止录音</>
                    ) : (
                      <><Mic className="w-3.5 h-3.5" /> 现场录音</>
                    )}
                  </button>
                  <button 
                    onClick={() => chatScreenshotRef.current?.click()}
                    className="text-sm font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> 截图提取
                  </button>
                  <button 
                    onClick={refineRequirements}
                    disabled={isRefining || !chatText.trim()}
                    className="text-sm font-bold uppercase tracking-wider text-violet-500 hover:text-violet-400 disabled:text-ink-muted/30 flex items-center gap-1.5 transition-colors"
                  >
                    {isRefining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    提炼需求
                  </button>
                  <input 
                    type="file"
                    ref={chatScreenshotRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleMultipleOcr(e.target.files)}
                  />
                </div>
              </div>
              <div className="relative group">
                <textarea 
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="在此粘贴客户聊天记录，或上传截图提取文字..."
                  className="w-full h-40 bg-bg/50 border border-border-subtle rounded-2xl p-5 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-ink-muted/50 leading-relaxed text-ink"
                />
                {(isOcrLoading || isProcessingAudio) && (
                  <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10 border border-emerald-500/20">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{isOcrLoading ? '正在识别截图...' : '正在分析录音...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Asset Uploads */}
            <section className="space-y-4">
              <label className="text-sm font-black uppercase tracking-widest text-ink-muted flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5" /> 辅助设计素材
              </label>
              <div className="grid grid-cols-5 gap-3">
                {assets.map((slot) => (
                  <div key={slot.id} className="relative aspect-square">
                    <div className="w-full h-full border-2 border-emerald-500/50 bg-emerald-500/5 rounded-2xl overflow-hidden group/slot">
                      <img src={slot.preview!} alt={slot.name} className="w-full h-full object-cover group-hover/slot:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                    </div>
                    <button 
                      onClick={() => removeAsset(slot.id)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-surface border border-border-subtle rounded-full flex items-center justify-center text-ink-muted hover:text-red-500 hover:border-red-500/50 transition-all shadow-lg z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-[10px] text-white font-black uppercase tracking-widest">
                      {slot.name}
                    </div>
                  </div>
                ))}
                
                {assets.length < 14 && (
                  <div className="relative aspect-square">
                    <input 
                      type="file" 
                      id="asset-upload-new"
                      className="hidden" 
                      accept="image/*"
                      multiple
                      onChange={(e) => e.target.files && handleAssetUpload(e.target.files)}
                    />
                    <label 
                      htmlFor="asset-upload-new"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-emerald-500', 'bg-emerald-500/10');
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-500/10');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-500/10');
                        if (e.dataTransfer.files) {
                          handleAssetUpload(e.dataTransfer.files);
                        }
                      }}
                      className="w-full h-full border-2 border-dashed border-border-subtle hover:border-emerald-500/30 hover:bg-emerald-500/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group/new-slot"
                    >
                      <Plus className="w-5 h-5 text-ink-muted/30 group-hover/new-slot:text-emerald-500 transition-colors" />
                      <span className="text-[10px] mt-1.5 text-ink-muted font-black uppercase tracking-tighter">添加素材</span>
                    </label>
                  </div>
                )}
              </div>
            </section>

            {/* Output Config */}
            <section className="space-y-6 pt-4 border-t border-border-subtle">
              <div className="space-y-6">
                <label className="text-sm font-black uppercase tracking-widest text-ink-muted flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> 提案配置
                </label>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <span className="text-sm text-ink-muted uppercase font-black tracking-widest">分辨率</span>
                    <div className="relative">
                      <select 
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as Resolution)}
                        className="w-full bg-bg/50 border border-border-subtle rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer text-ink"
                      >
                        <option value="512">512px (预览)</option>
                        <option value="1K">1K (标准)</option>
                        <option value="2K">2K (高清)</option>
                        <option value="4K">4K (超清)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-ink-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <span className="text-sm text-ink-muted uppercase font-black tracking-widest">长宽比</span>
                    <div className="relative">
                      <select 
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className="w-full bg-bg/50 border border-border-subtle rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer text-ink"
                      >
                        <option value="Auto">AI 智能判断</option>
                        <option value="1:1">1:1 正方形</option>
                        <option value="1:4">1:4 极细长</option>
                        <option value="1:8">1:8 极细长</option>
                        <option value="2:3">2:3 纵向</option>
                        <option value="3:2">3:2 横向</option>
                        <option value="3:4">3:4 纵向</option>
                        <option value="4:1">4:1 极宽</option>
                        <option value="4:3">4:3 横向</option>
                        <option value="4:5">4:5 纵向</option>
                        <option value="5:4">5:4 横向</option>
                        <option value="8:1">8:1 极宽</option>
                        <option value="9:16">9:16 竖屏</option>
                        <option value="16:9">16:9 宽屏</option>
                        <option value="21:9">21:9 超宽屏</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-ink-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-sm text-ink-muted uppercase font-black tracking-widest">输出类型 (多选)</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'threeD', label: '360° 交互预览' },
                      { id: 'mockup', label: '3D 包装效果图' },
                      { id: 'prepress', label: '平面印前设计稿' },
                      { id: 'retail', label: '商超陈列实拍' },
                      { id: 'vi', label: '品牌物料推广' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => toggleOutputType(type.id as OutputType)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all group relative ${
                          selectedOutputs.includes(type.id as OutputType)
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                            : 'bg-bg/30 border-border-subtle text-ink-muted hover:border-ink-muted/50 hover:bg-bg/50'
                        }`}
                      >
                        <span className="text-sm font-black leading-none truncate pr-2">{type.label}</span>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          selectedOutputs.includes(type.id as OutputType) ? 'border-emerald-500 bg-emerald-500' : 'border-border-subtle'
                        }`}>
                          {selectedOutputs.includes(type.id as OutputType) && <Check className="w-2 h-2 text-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="p-8 border-t border-border-subtle bg-surface/80 backdrop-blur-md">
            <button 
              onClick={generateProposal}
              disabled={isGenerating || (!chatText && assets.every(a => !a.file))}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-surface disabled:text-ink-muted/50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-500/20 group"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  正在构思设计方案...
                </>
              ) : (
                <>
                  生成完整设计提案
                </>
              )}
            </button>
          </footer>
        </aside>

        {/* Right Column: Results Area */}
        <main className="flex-1 overflow-y-auto bg-bg custom-scrollbar relative">
          <header className="h-[64px] sticky top-0 z-30 px-8 py-2 flex items-center justify-between bg-bg/80 backdrop-blur-md border-b border-border-subtle">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h2 className="text-lg font-black tracking-tight flex items-center gap-3 text-ink leading-none">
                    提案生成区
                    {results.length > 0 && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                        {results.length} SAMPLES
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              
              {results.length > 0 && (
                <div className="flex items-center gap-4 border-l border-border-subtle pl-8 h-5">
                  <button 
                    onClick={handleReset}
                    className="text-[10px] font-black uppercase tracking-widest text-ink-muted hover:text-red-500 flex items-center gap-1.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" /> 重置
                  </button>
                  <button 
                    onClick={addFeedbackField}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" /> 修改意见
                  </button>
                </div>
              )}
            </div>
            {results.length > 0 && (
              <button 
                onClick={downloadAll}
                className="flex items-center gap-2 bg-ink text-bg px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-ink/10"
              >
                <Download className="w-3 h-3" /> 下载全套提案
              </button>
            )}
          </header>

          <div className="p-10 max-w-7xl mx-auto">
            {/* Feedback Input Section */}
            <AnimatePresence>
              {showFeedbackInput && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-12 p-8 bg-surface border border-emerald-500/30 rounded-[2.5rem] shadow-2xl shadow-emerald-500/5 space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                        <Settings className="w-4 h-4" /> 修改意见累加
                      </h3>
                      <p className="text-[10px] text-ink-muted font-bold uppercase tracking-widest mt-1">Refinement Feedback</p>
                    </div>
                    <button 
                      onClick={() => setShowFeedbackInput(false)}
                      className="w-8 h-8 rounded-full bg-bg border border-border-subtle flex items-center justify-center text-ink-muted hover:text-ink transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {feedbackList.map((feedback, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-1 relative">
                          <input 
                            value={feedback}
                            onChange={(e) => updateFeedback(index, e.target.value)}
                            placeholder={`请输入第 ${index + 1} 条修改意见...`}
                            className="w-full bg-bg border border-border-subtle rounded-2xl px-6 py-4 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-ink"
                          />
                          <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 pr-4 hidden md:block">
                            <span className="text-[10px] font-black text-ink-muted uppercase tracking-tighter">#{index + 1}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFeedback(index)}
                          className="p-4 text-ink-muted hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={addFeedbackField}
                      className="flex-1 py-4 border-2 border-dashed border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest text-ink-muted hover:border-emerald-500/50 hover:text-emerald-500 transition-all bg-bg/30"
                    >
                      + 继续添加意见
                    </button>
                    <button 
                      onClick={generateProposal}
                      disabled={isGenerating || feedbackList.every(f => !f.trim())}
                      className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all disabled:bg-surface disabled:text-ink-muted/50 shadow-lg shadow-emerald-500/20"
                    >
                      {isGenerating ? '正在调整方案...' : '确认修改并重新生成'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isGenerating ? (
              <div className="h-[60vh] flex flex-col items-center justify-center space-y-12">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-black tracking-tight text-ink">正在生成您的设计方案</h3>
                  <p className="text-ink-muted max-w-sm mx-auto text-sm leading-relaxed">
                    正在深度分析您的需求与素材，为您打造最具商业竞争力的包装设计提案。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                  {selectedOutputs.map(type => (
                    <div key={type} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${generationProgress[type] ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border-subtle bg-surface/30'}`}>
                      <div className="flex items-center gap-4">
                        {generationProgress[type] ? (
                          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                        <span className="text-xs font-black uppercase tracking-widest text-ink">{type}</span>
                      </div>
                      <span className="text-[10px] font-bold text-ink-muted uppercase tracking-tighter">
                        {generationProgress[type] ? 'Processing' : 'Completed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      销售导向
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      专业视觉
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      品牌一致性
                    </div>
                  </div>
                  <div className="h-px flex-1 bg-border-subtle mx-8" />
                  <span className="text-[10px] font-black text-ink-muted uppercase tracking-widest">龙锦包装设计提案 v1.0</span>
                </div>

                <div className="grid grid-cols-2 gap-8 pb-32">
                <AnimatePresence mode="popLayout">
                  {[...results]
                    .sort((a, b) => {
                      const order = { mockup: 1, prepress: 2, threeD: 3, retail: 4, vi: 5 };
                      return (order[a.type as keyof typeof order] || 99) - (order[b.type as keyof typeof order] || 99);
                    })
                    .map((img) => (
                    <motion.div 
                      key={img.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group relative bg-surface rounded-[2rem] overflow-hidden border border-border-subtle hover:border-emerald-500/50 transition-all flex flex-col shadow-2xl shadow-black/5 ${img.type === 'threeD' ? 'col-span-2' : ''}`}
                    >
                      {img.type === 'threeD' ? (
                        <div className="h-[500px] relative bg-bg/50">
                          <ThreeDViewer imageUrl={img.url} shape={img.shape} />
                          <div className="absolute top-6 left-6 z-10">
                            <div className="flex flex-col gap-1">
                              <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
                                03 360° 交互预览
                              </span>
                              <span className="text-[9px] text-ink-muted font-bold uppercase tracking-widest ml-1">Interactive 3D View</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-bg/30 p-8 relative overflow-hidden">
                          {img.type === 'prepress' && (
                            <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
                              <button 
                                onClick={() => setEditingImage(img)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                图层编辑
                              </button>
                            </div>
                          )}
                          <img 
                            src={img.url} 
                            alt={img.type} 
                            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-6 left-6 flex flex-col gap-1 z-10">
                            <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
                              {img.type === 'mockup' && '01 包装效果图'}
                              {img.type === 'prepress' && '02 印前设计稿'}
                              {img.type === 'retail' && '04 商超场景'}
                              {img.type === 'vi' && '05 品牌物料'}
                            </span>
                            <span className="text-[11px] text-ink-muted font-bold uppercase tracking-widest ml-1">
                              {img.type === 'mockup' && '3D Mockup Rendering'}
                              {img.type === 'prepress' && 'Pre-press Design Layout'}
                              {img.type === 'retail' && 'Retail Display Scenario'}
                              {img.type === 'vi' && 'Brand Identity Collateral'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="p-6 flex items-center justify-between bg-surface/50 backdrop-blur-md border-t border-border-subtle">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">规格尺寸</span>
                            <p className="text-xs font-bold text-ink mt-0.5">{img.aspectRatio}</p>
                          </div>
                          <div className="w-px h-8 bg-border-subtle" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">分辨率</span>
                            {img.type !== 'threeD' ? (
                              <div className="relative flex items-center mt-0.5">
                                <select
                                  value={img.resolution || resolution}
                                  onChange={(e) => handleUpgradeResolution(img, e.target.value as Resolution)}
                                  disabled={upgradingImages[img.id]}
                                  className="bg-transparent text-xs font-bold text-ink outline-none cursor-pointer hover:text-emerald-400 disabled:opacity-50 appearance-none pr-4"
                                >
                                  <option value="512">512px</option>
                                  <option value="1K">1K</option>
                                  <option value="2K">2K</option>
                                  <option value="4K">4K</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-ink-muted absolute right-0 pointer-events-none" />
                              </div>
                            ) : (
                              <p className="text-xs font-bold text-ink mt-0.5">{img.resolution || resolution}</p>
                            )}
                          </div>
                          {upgradingImages[img.id] && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
                        </div>
 
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleShare(img)}
                            className="p-3 bg-bg border border-border-subtle hover:border-emerald-500/50 rounded-xl transition-all group/share relative"
                          >
                            {shareStatus[img.id] ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Share2 className="w-4 h-4 text-ink-muted group-hover/share:text-ink" />
                            )}
                          </button>
                          {img.type === 'prepress' ? (
                            <button 
                              onClick={() => downloadPDF(img)}
                              className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all font-black text-[11px] uppercase tracking-widest"
                            >
                              <FileText className="w-4 h-4" />
                              导出 PDF
                            </button>
                          ) : (
                            <button 
                              onClick={() => downloadSingleImage(img)}
                              className="p-3 bg-bg border border-border-subtle hover:bg-emerald-500 hover:border-emerald-500 hover:text-white rounded-xl transition-all text-ink-muted hover:text-white"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-10">
                <div className="space-y-4">
                  <p className="text-ink-muted max-w-sm mx-auto text-sm leading-relaxed">
                    在左侧输入客户需求并上传品牌素材，AI 将瞬间为您生成一套完整、专业的包装设计提案。
                  </p>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">智能识别</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                      <Box className="w-5 h-5 text-violet-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">3D 建模</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                      <Download className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">高清导出</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border-subtle);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--ink-muted);
        }
      `}</style>

      {/* Layered Editor Overlay */}
      {editingImage && (
        <LayeredEditor 
          baseImageUrl={editingImage.url} 
          brandName={analysis?.brandName || ''}
          onClose={() => setEditingImage(null)} 
        />
      )}
    </div>
  );
}
