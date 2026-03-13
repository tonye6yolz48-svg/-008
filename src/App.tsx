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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
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
      const errorStr = JSON.stringify(error).toLowerCase();
      const message = (error?.message || "").toLowerCase();
      const status = (error?.status || "").toLowerCase();
      
      const isRetryable = 
        errorStr.includes('503') || 
        errorStr.includes('high demand') || 
        errorStr.includes('unavailable') ||
        message.includes('503') || 
        message.includes('high demand') || 
        status.includes('unavailable');

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
  const isBag = shape.toLowerCase().includes('bag') || shape.toLowerCase().includes('pouch');
  
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
      <div className="w-full h-[600px] bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden relative border border-zinc-800/50 shadow-2xl group flex flex-col items-center justify-center">
        <div className="absolute top-8 left-8 z-10">
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl px-5 py-2.5 rounded-2xl border border-white/10">
            <Box className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-[0.2em]">AR 增强现实预览</span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">WebXR / Scene Viewer 模式</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setViewMode('3d')}
          className="absolute top-8 right-8 z-10 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 text-zinc-400 hover:text-white transition-all"
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
          style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a' }}
        >
          <button slot="ar-button" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-8 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-3">
            <Box className="w-5 h-5" />
            在您的空间中查看 (AR)
          </button>
          {/* @ts-ignore */}
        </model-viewer>

        <div className="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest">
          移动端支持原生 AR 体验
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden relative border border-zinc-800/50 shadow-2xl group">
      <div className="absolute top-8 left-8 z-10">
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl px-5 py-2.5 rounded-2xl border border-white/10">
          <Rotate3d className="w-5 h-5 text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-[0.2em]">360° 交互预览</span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">实时 PBR 渲染引擎</span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setViewMode('ar')}
        className="absolute top-8 right-8 z-10 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 text-zinc-400 hover:text-white transition-all flex items-center gap-2"
      >
        <Box className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">开启 AR 模式</span>
      </button>
      
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 35 }}>
        <color attach="background" args={['#0a0a0a']} />
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

      <div className="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest">
        鼠标拖拽旋转 • 滚轮缩放 • 触控交互
      </div>
    </div>
  );
}
type Resolution = '512' | '1K' | '2K' | '4K';
type AspectRatio = '1:1' | '1:4' | '1:8' | '2:3' | '3:2' | '3:4' | '4:1' | '4:3' | '4:5' | '5:4' | '8:1' | '9:16' | '16:9' | '21:9' | 'Auto';
type OutputType = 'mockup' | 'prepress' | 'retail' | 'vi' | 'ecommerce' | 'threeD';

interface GeneratedImage {
  id: string;
  url: string;
  type: OutputType;
  prompt: string;
  aspectRatio: string;
  shape?: string;
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
  const [resolution, setResolution] = useState<Resolution>('2K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Auto');
  const [selectedOutputs, setSelectedOutputs] = useState<OutputType[]>(['mockup', 'ecommerce', 'vi', 'threeD']);
  const [assets, setAssets] = useState<AssetSlot[]>([
    { id: 1, name: 'Logo', file: null, preview: null },
    { id: 2, name: 'QS', file: null, preview: null },
    { id: 3, name: '素材三', file: null, preview: null },
    { id: 4, name: '素材四', file: null, preview: null },
    { id: 5, name: '素材五', file: null, preview: null },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareStatus, setShareStatus] = useState<{[key: string]: boolean}>({});

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
  const [feedbackList, setFeedbackList] = useState<string[]>([]);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
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
  const handleAssetUpload = (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setAssets(prev => prev.map(slot => 
        slot.id === id ? { ...slot, file, preview: e.target?.result as string } : slot
      ));
    };
    reader.readAsDataURL(file);
  };

  const removeAsset = (id: number) => {
    setAssets(prev => prev.map(slot => 
      slot.id === id ? { ...slot, file: null, preview: null } : slot
    ));
  };

  const toggleOutputType = (type: OutputType) => {
    setSelectedOutputs(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleOcr = async (file: File) => {
    setIsOcrLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { inlineData: { mimeType: file.type, data: base64 } },
              { text: "Extract all the text from this chat screenshot. Only return the extracted text." }
            ]
          }
        ]
      });

      if (response.text) {
        setChatText(prev => prev + (prev ? '\n' : '') + response.text);
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        setHasApiKey(false);
        alert("API 密钥权限不足。请重新关联密钥。");
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
              { text: "这是一个关于包装设计要求的现场录音。请提炼出其中的核心设计要求、产品信息和风格偏好。以简洁的文字形式返回。" }
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
      
      // 1. Analyze assets (especially Logo) to get visual identity
      let brandContext = "";
      const logoAsset = assets.find(a => a.name === 'Logo' && a.file);
      if (logoAsset && logoAsset.file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(logoAsset.file!);
        });
        const logoBase64 = await base64Promise;
        
        const logoAnalysis = await generateContentWithRetry(ai, {
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { inlineData: { mimeType: logoAsset.file.type, data: logoBase64 } },
                { text: "Analyze this logo. What is the brand name? What are the primary colors and design style? Return a brief description for an image generation prompt." }
              ]
            }
          ]
        });
        brandContext = logoAnalysis.text || "";
      }

      // 2. Analyze chat and assets to get context
      const feedbackContext = feedbackList.filter(f => f.trim()).map((f, i) => `Feedback ${i+1}: ${f}`).join('\n');
      
      const analysisResponse = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: `Analyze this chat log, brand context, and user feedback to determine the product type, brand style, and best aspect ratio for packaging design.
        Chat: ${chatText}
        Brand Context from Logo: ${brandContext}
        User Feedback on previous design: ${feedbackContext}
        Other Assets: ${assets.filter(a => a.file && a.name !== 'Logo').map(a => a.name).join(', ')}
        
        CRITICAL INSTRUCTION: 
        1. AVOID "AI-style" or "plastic" looks. 
        2. Use professional photography and material science terminology (Phase One, Macro, f/8, Studio Lighting).
        3. Simulate specific surface physics: 
           - For Matte: "Micro-granular surface scattering, zero specular glare, soft-touch tactile texture."
           - For Glossy: "Sharp ray-traced reflections, high-contrast specular highlights, deep gloss depth."
           - For Metallic: "Anisotropic reflections, brushed metal micro-scratches, realistic Fresnel falloff."
           - For Paper: "Visible cellulose fibers, uncoated ink absorption, natural paper tooth."
        4. For Prepress, use industrial manufacturing standards for rotogravure printing (凹版印刷). It must be a FLAT technical layout, not an exploded view. Include crop marks, bleed lines, CMYK color bars, and precise technical annotations.
        5. For Visual Communication (vi), you MUST design EXACTLY THREE (3) REAL-WORLD advertising assets in an array. DO NOT truncate this list.
           - Scene 1: "Chinese_Subway" (9:16) - Authentic Beijing/Shanghai subway station, backlit LED lightboxes.
           - Scene 2: "Mall_Hanging_Banner" (1:3) - A vertical hanging banner in a luxury shopping mall atrium. It must be suspended high in the air, NOT touching the floor.
           - Scene 3: "Outdoor_Billboard" (16:9) - Standard large format billboard in a high-traffic city center.
        6. For Retail: Simulate a REAL supermarket shelf environment (商超货架售卖场景). The product should be placed among other competing products on a standard metal shelf. Include price tags (shelf talkers), realistic fluorescent lighting, and other shoppers in the peripheral blur.
        7. For E-commerce:
           - If brand/context is Chinese: Simulate a "Taobao/Tmall Detail Page" (Mobile view, long-scroll style, vibrant marketing copy, discount badges, high-density information).
           - If brand/context is International: Simulate an "Amazon Product Page" (Clean white background, clear feature bullets, "Add to Cart" UI elements, professional clean aesthetic).
        
        Return a JSON object with:
        {
          "productDescription": "brief description",
          "productShape": "box or bag",
          "brandName": "extracted brand name",
          "brandStyle": "modern/classic/etc",
          "isChineseMarket": true/false,
          "recommendedAspectRatio": "1:1/3:4/4:3/9:16/16:9",
          "prompts": {
            "mockup": "High-end commercial product photography. Focus on material physics: [Describe specific material here, e.g., matte laminate with soft-touch finish]. Realistic light interaction: [Describe reflections/scattering]. Shot on Phase One XF, 100mm macro, f/8. Visible micro-textures and realistic ink absorption.",
            "prepress": "A professional flat technical layout for rotogravure printing (凹版印刷制版稿). This is a 2D flat design file, NOT a 3D view. Features precise magenta die-lines, 3mm bleed indicators, and fold marks. Includes standard CMYK color calibration bars, registration marks, and technical annotations for spot colors and finishings. Clean white background with industrial manufacturing aesthetic.",
            "retail": "A realistic supermarket shelf selling scene (商超货架售卖实拍). The product is stocked in multiple units on a standard retail metal shelf, surrounded by other real-world consumer goods. Includes yellow price tags (shelf talkers) attached to the shelf edge. Realistic fluorescent supermarket lighting with slight green/cool tint. Natural depth of field with other aisles visible in the background. Authentic retail environment.",
            "ecommerce": "A professional e-commerce product page design. [If Chinese: Taobao/Tmall style mobile detail page with long-scroll layout, promotional badges, and high-density marketing graphics. If International: Amazon style desktop product page with clean white background, clear typography, and 'Buy Now' UI elements]. Focus on realistic UI layout and product hero shot.",
            "visual_comm": [
              {
                "scene": "Chinese_Subway",
                "aspectRatio": "9:16",
                "prompt": "A backlit LED lightbox in a modern Shanghai subway station. Realistic internal light diffusion, sharp glass surface reflections, and subtle dust particles. Commuters in motion blur in the background. High-end transit media design with authentic Chinese environment."
              },
              {
                "scene": "Mall_Hanging_Banner",
                "aspectRatio": "1:3",
                "prompt": "A vertical hanging banner suspended in a luxury shopping mall atrium. Aspect ratio 1:3. The banner is hanging high above the ground, clearly separated from the floor. Material: High-tension flat vinyl, zero wrinkles. Structure: Visible steel hanging cables and weighted bottom rail. Proportions must be realistic relative to the massive architectural space. Captured from a low-angle perspective looking up."
              },
              {
                "scene": "Outdoor_Billboard",
                "aspectRatio": "16:9",
                "prompt": "A massive standard 16:9 outdoor billboard in a high-traffic city center. Realistic steel frame structure, high-altitude placement. Material: High-quality vinyl with realistic tension and professional advertising layout. Natural daylight with realistic shadow casting."
              }
            ]
          }
        }
      }`,
        config: { responseMimeType: "application/json" }
      });

      const analysis = JSON.parse(analysisResponse.text || '{}');
      const finalAspectRatio = aspectRatio === 'Auto' ? analysis.recommendedAspectRatio || '1:1' : aspectRatio;

      const newResults: GeneratedImage[] = [];
      let masterMockupBase64 = "";

      // 3. Sequential Generation for Consistency
      // Priority 1: Mockup (The Master Design)
      if (selectedOutputs.includes('mockup')) {
        const parts: any[] = [];
        
        // If we have feedback and a previous mockup, use it as reference
        if (feedbackList.length > 0 && previousMockup) {
          const base64Data = previousMockup.url.includes(',') ? previousMockup.url.split(',')[1] : previousMockup.url;
          parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
        } else if (logoAsset?.file && logoAsset.preview) {
          const base64Data = logoAsset.preview.includes(',') ? (logoAsset.preview as string).split(',')[1] : logoAsset.preview;
          parts.push({ inlineData: { mimeType: logoAsset.file.type, data: base64Data } });
        }

        parts.push({ text: `${analysis.prompts.mockup}. Brand name: ${analysis.brandName}. ${feedbackList.length > 0 ? 'Apply the following modifications: ' + feedbackList.join('; ') : ''}` });

        const genResponse = await generateContentWithRetry(ai, {
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
            prompt: analysis.prompts.mockup,
            aspectRatio: finalAspectRatio
          });
          setResults([...newResults]); // Show progress
        }
      }

      // Priority 2: 3D Preview (Instant if we have mockup)
      if (selectedOutputs.includes('threeD') && masterMockupBase64) {
        newResults.push({
          id: '3d-preview-' + Date.now(),
          url: `data:image/png;base64,${masterMockupBase64}`,
          type: 'threeD',
          prompt: 'Interactive 3D Preview',
          aspectRatio: '1:1',
          shape: analysis.productShape || 'box'
        });
        setResults([...newResults]);
      }

      // Priority 3: Other outputs using Mockup as reference (Parallel Generation)
      const otherTypes = selectedOutputs.filter(t => t !== 'mockup' && t !== 'threeD');
      const generationTasks: Promise<void>[] = [];

      for (const type of otherTypes) {
        let items: any[] = [];
        if (type === 'vi') {
          items = Array.isArray(analysis.prompts.visual_comm) ? analysis.prompts.visual_comm : [];
        } else {
          items = [{ prompt: analysis.prompts[type], aspectRatio: (type === 'prepress' || type === 'ecommerce') ? '1:1' : finalAspectRatio }];
        }
        
        for (const item of items) {
          const promptText = typeof item === 'object' ? item.prompt : item;
          const itemAspectRatio = typeof item === 'object' ? item.aspectRatio : ((type === 'prepress' || type === 'ecommerce') ? '1:1' : finalAspectRatio);
          
          if (!promptText) continue;

          const task = (async () => {
            const parts: any[] = [];
            
            if (masterMockupBase64) {
              parts.push({ inlineData: { mimeType: 'image/png', data: masterMockupBase64 } });
            } else if (logoAsset?.file && logoAsset.preview) {
              const base64Data = logoAsset.preview.includes(',') ? (logoAsset.preview as string).split(',')[1] : logoAsset.preview;
              parts.push({ inlineData: { mimeType: logoAsset.file.type, data: base64Data } });
            }

            parts.push({ text: `${promptText}. Maintain exact colors and brand identity: ${analysis.brandName}.` });

            try {
              const genResponse = await generateContentWithRetry(ai, {
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
                  aspectRatio: itemAspectRatio
                };
                newResults.push(result);
                setResults(prev => [...prev, result]); // Real-time update
              }
            } catch (err) {
              console.error(`Failed to generate ${type}:`, err);
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
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403") || errorMessage.includes("not found")) {
        setHasApiKey(false);
        alert("API 密钥权限不足或未开启计费。请重新关联一个已开启计费的 Google Cloud 项目密钥。");
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
    link.click();
  };

  const downloadPDF = (img: GeneratedImage) => {
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
    pdf.text(`智能包装设计提案 - 印前生产稿`, 10, 10);
    pdf.text(`生成日期: ${new Date().toLocaleString()}`, 10, 15);
    pdf.text(`品牌: ${img.prompt.split('Brand name: ')[1]?.split('.')[0] || '未知'}`, 10, 20);
    
    // Add the image
    pdf.addImage(img.url, 'PNG', 0, 30, pdfWidth, pdfHeight);
    
    // Add technical callouts (Simulated layers/separation info)
    pdf.addPage();
    pdf.setTextColor(0);
    pdf.setFontSize(14);
    pdf.text("印前生产说明 (Technical Specifications)", 10, 20);
    
    pdf.setFontSize(10);
    pdf.text("1. 刀版层 (Die-line Layer): 已嵌入主视觉图。请根据红色线条进行模切。", 10, 40);
    pdf.text("2. 视觉层 (Artwork Layer): 采用 300DPI 高清渲染，支持 4色 (CMYK) 印刷。", 10, 50);
    pdf.text("3. 工艺层 (Finishing Layer): 建议在 Logo 区域使用 UV 局部上光或烫金工艺。", 10, 60);
    pdf.text("4. 颜色标准 (Color Standard): 请参考文件侧边 CMYK 色标条进行校色。", 10, 70);

    pdf.save(`Prepress-${img.id}.pdf`);
  };

  const downloadAll = () => {
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* API Key Selection Overlay */}
      {!hasApiKey && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] text-center space-y-6 shadow-2xl"
          >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto">
              <Settings className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">激活 AI 设计功能</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                为了生成高清 4K 包装设计图，您需要关联您的 Google Cloud 项目 API 密钥。
              </p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={handleSelectKey}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl transition-all active:scale-95"
              >
                关联 API 密钥
              </button>
              <p className="text-[10px] text-zinc-500">
                请确保您的项目已开启计费。查看 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-emerald-500">计费文档</a>。
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex h-screen overflow-hidden">
        
        {/* Left Column: Input Area */}
        <aside className="w-[450px] border-r border-zinc-800 flex flex-col bg-zinc-900/50 backdrop-blur-xl">
          <header className="p-6 border-b border-zinc-800">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Layout className="w-5 h-5 text-zinc-950" />
              </div>
              智能包装设计提案系统
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-semibold">内部销售工具</p>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* Chat Input */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2 text-zinc-400">
                  <MessageSquare className="w-4 h-4" /> 聊天记录输入
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`text-xs flex items-center gap-1 transition-colors ${
                      isRecording ? 'text-red-500 hover:text-red-400' : 'text-emerald-500 hover:text-emerald-400'
                    }`}
                  >
                    {isRecording ? (
                      <><Square className="w-3 h-3 fill-current" /> 停止录音</>
                    ) : (
                      <><Mic className="w-3 h-3" /> 现场录音</>
                    )}
                  </button>
                  <button 
                    onClick={() => chatScreenshotRef.current?.click()}
                    className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                  >
                    <Upload className="w-3 h-3" /> 截图上传
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={chatScreenshotRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
                />
              </div>
              <div className="relative group">
                <textarea 
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="在此粘贴聊天记录，或上传截图提取文字..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-zinc-700"
                />
                {(isOcrLoading || isProcessingAudio) && (
                  <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      <span className="text-xs text-zinc-400">{isOcrLoading ? '正在识别截图...' : '正在分析录音...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Asset Uploads */}
            <section className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2 text-zinc-400">
                <ImageIcon className="w-4 h-4" /> 素材上传
              </label>
              <div className="grid grid-cols-5 gap-2">
                {assets.map((slot) => (
                  <div key={slot.id} className="relative aspect-square">
                    <input 
                      type="file" 
                      id={`asset-${slot.id}`}
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleAssetUpload(slot.id, e.target.files[0])}
                    />
                    <label 
                      htmlFor={`asset-${slot.id}`}
                      className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                        slot.preview ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                      }`}
                    >
                      {slot.preview ? (
                        <img src={slot.preview} alt={slot.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Plus className="w-5 h-5 text-zinc-600" />
                          <span className="text-[10px] mt-1 text-zinc-600 font-medium uppercase">{slot.name}</span>
                        </>
                      )}
                    </label>
                    {slot.preview && (
                      <button 
                        onClick={() => removeAsset(slot.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Output Config */}
            <section className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium flex items-center gap-2 text-zinc-400">
                  <Settings className="w-4 h-4" /> 输出配置
                </label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">分辨率</span>
                    <select 
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as Resolution)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="512">512px</option>
                      <option value="1K">1K</option>
                      <option value="2K">2K (默认)</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">长宽比</span>
                    <select 
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="Auto">AI 自动判断</option>
                      <option value="1:1">1:1 正方形</option>
                      <option value="1:4">1:4 极窄纵向</option>
                      <option value="1:8">1:8 极窄纵向</option>
                      <option value="2:3">2:3 纵向</option>
                      <option value="3:2">3:2 横向</option>
                      <option value="3:4">3:4 纵向</option>
                      <option value="4:1">4:1 极窄横向</option>
                      <option value="4:3">4:3 横向</option>
                      <option value="4:5">4:5 纵向</option>
                      <option value="5:4">5:4 横向</option>
                      <option value="8:1">8:1 极窄横向</option>
                      <option value="9:16">9:16 竖屏</option>
                      <option value="16:9">16:9 宽屏</option>
                      <option value="21:9">21:9 超宽屏</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">输出类型</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'mockup', label: '3D 包装效果图', icon: Box },
                      { id: 'prepress', label: '平面印前设计稿', icon: FileText },
                      { id: 'threeD', label: '360° 交互预览', icon: Rotate3d },
                      { id: 'retail', label: '商超陈列实拍图', icon: Store },
                      { id: 'vi', label: '广告物料与品牌推广', icon: Layers },
                      { id: 'ecommerce', label: '电商详情页设计', icon: ShoppingBag },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => toggleOutputType(type.id as OutputType)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                          selectedOutputs.includes(type.id as OutputType)
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="p-6 border-t border-zinc-800 bg-zinc-950/50">
            <button 
              onClick={generateProposal}
              disabled={isGenerating || (!chatText && assets.every(a => !a.file))}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在生成提案...
                </>
              ) : (
                <>
                  <Layout className="w-5 h-5" />
                  生成设计提案
                </>
              )}
            </button>
          </footer>
        </aside>

        {/* Right Column: Results Area */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 custom-scrollbar relative">
          <header className="sticky top-0 z-10 p-6 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                生成结果展示
                {results.length > 0 && (
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 font-normal">
                    {results.length} 张图片
                  </span>
                )}
              </h2>
              {results.length > 0 && (
                <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
                  <button 
                    onClick={handleReset}
                    className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" /> 重置方案
                  </button>
                  <button 
                    onClick={addFeedbackField}
                    className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 增加修改意见
                  </button>
                </div>
              )}
            </div>
            {results.length > 0 && (
              <button 
                onClick={downloadAll}
                className="flex items-center gap-2 bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition-colors"
              >
                <Download className="w-4 h-4" /> 下载全套
              </button>
            )}
          </header>

          <div className="p-8">
            {/* Feedback Input Section */}
            <AnimatePresence>
              {showFeedbackInput && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-8 p-6 bg-zinc-900 border border-emerald-500/30 rounded-3xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-500 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> 修改意见累加
                    </h3>
                    <button 
                      onClick={() => setShowFeedbackInput(false)}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {feedbackList.map((feedback, index) => (
                      <div key={index} className="flex gap-2">
                        <input 
                          value={feedback}
                          onChange={(e) => updateFeedback(index, e.target.value)}
                          placeholder={`请输入第 ${index + 1} 条修改意见...`}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 transition-all"
                        />
                        <button 
                          onClick={() => removeFeedback(index)}
                          className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={addFeedbackField}
                      className="flex-1 py-2 border border-dashed border-zinc-700 rounded-xl text-xs text-zinc-500 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                    >
                      + 继续添加意见
                    </button>
                    <button 
                      onClick={generateProposal}
                      disabled={isGenerating || feedbackList.every(f => !f.trim())}
                      className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-2 rounded-xl text-sm transition-all disabled:bg-zinc-800 disabled:text-zinc-600"
                    >
                      {isGenerating ? '正在根据意见调整...' : '确认修改并重新生成'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {isGenerating && results.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold">AI 正在设计中...</h3>
                  <p className="text-zinc-500 mt-2 max-w-xs">正在分析聊天记录和素材，为您打造专业的包装设计提案。</p>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 pb-20">
                <AnimatePresence mode="popLayout">
                  {[...results]
                    .sort((a, b) => {
                      const order = { mockup: 1, prepress: 2, threeD: 3, retail: 4, vi: 5, ecommerce: 6 };
                      return (order[a.type as keyof typeof order] || 99) - (order[b.type as keyof typeof order] || 99);
                    })
                    .map((img) => (
                    <motion.div 
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-emerald-500/50 transition-all flex flex-col ${img.type === 'threeD' ? 'col-span-2' : ''}`}
                    >
                      {img.type === 'threeD' ? (
                        <div className="h-[400px] relative">
                          <ThreeDViewer imageUrl={img.url} shape={img.shape} />
                          <div className="absolute top-3 left-3 z-10">
                            <span className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg">
                              03 360° 交互预览
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-zinc-950 p-4 relative">
                          <img 
                            src={img.url} 
                            alt={img.type} 
                            className="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 left-3 flex flex-col gap-1">
                            <span className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg">
                              {img.type === 'mockup' && '01 包装效果图'}
                              {img.type === 'prepress' && '02 印前设计稿'}
                              {img.type === 'retail' && '04 商超场景'}
                              {img.type === 'vi' && '05 品牌物料'}
                              {img.type === 'ecommerce' && '06 电商详情'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="p-3 flex items-center justify-between bg-zinc-900/80 backdrop-blur-sm border-t border-zinc-800">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">规格</span>
                          <p className="text-[10px] font-medium text-zinc-300">{img.aspectRatio} • {resolution}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleShare(img)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all group/share relative"
                          >
                            {shareStatus[img.id] ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5 text-zinc-400 group-hover/share:text-white" />
                            )}
                          </button>
                          {img.type === 'prepress' ? (
                            <button 
                              onClick={() => downloadPDF(img)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-all font-bold text-[10px]"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                            </button>
                          ) : (
                            <button 
                              onClick={() => downloadImage(img.url, `提案-${img.id}.png`)}
                              className="p-1.5 bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 rounded-lg transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center border border-zinc-800">
                  <Layout className="w-10 h-10 text-zinc-700" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">准备就绪</h3>
                  <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
                    在左侧输入客户聊天记录并上传品牌素材，即可瞬间生成专业的设计提案。
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    AI 文字识别
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    4K 高清渲染
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    VI 全套生成
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
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
