import React, { useState, useEffect, useRef } from 'react';

// === CONFIGURACIÓN INICIAL DE TEMÁTICAS CON ANCHO Y ALTO PREDETERMINADO ===
const INITIAL_THEMES = [
  { id: 't1', name: 'Anime & Gaming', color: '#8B5CF6', defaultWidth: 400, defaultHeight: 120 }, // Planchita de 40 x 12 cm
  { id: 't2', name: 'Logos & Marcas', color: '#3B82F6', defaultWidth: 500, defaultHeight: 150 }, // Planchita de 50 x 15 cm
  { id: 't3', name: 'Mascotas & Kawaii', color: '#10B981', defaultWidth: 300, defaultHeight: 150 }, // Planchita de 30 x 15 cm
  { id: 't4', name: 'Frases & Tipografía', color: '#F59E0B', defaultWidth: 580, defaultHeight: 200 }, // Planchita de 58 x 20 cm
  { id: 't_general', name: 'General', color: '#6B7280', defaultWidth: 400, defaultHeight: 200 } // Planchita de 40 x 20 cm
];

export default function App() {
  const [images, setImages] = useState([]);
  const [themes, setThemes] = useState(INITIAL_THEMES);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#EC4899');
  const [newThemeWidth, setNewThemeWidth] = useState(40); // default 40 cm
  const [newThemeHeight, setNewThemeHeight] = useState(20); // default 20 cm
  const [selectedThemeForUpload, setSelectedThemeForUpload] = useState('t_general');
  
  // Parámetros de la plancha
  const [sheetWidth, setSheetWidth] = useState(580); // en mm (58 cm)
  const [sheetHeight, setSheetHeight] = useState(1000); // en mm (100 cm)
  const [spacing, setSpacing] = useState(5); // espacio entre stickers en mm (0.5 cm)
  const [safeMargin, setSafeMargin] = useState(10); // margen de seguridad en mm (1 cm)
  
  // Parámetros de empaque y negocio
  const [packingMode, setPackingMode] = useState('theme'); // 'theme' (Agrupado por Planchitas) o 'optimized' (Mezclado)
  const [globalTargetSize, setGlobalTargetSize] = useState(40); // 4 cm por defecto
  const [pricePerMeter, setPricePerMeter] = useState(12000); // Precio por metro de film
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [showCutMarks, setShowCutMarks] = useState(true);

  // === SOLUCIÓN AL ERROR: DECLARACIÓN DEL ESTADO DE CONTROL DE CONFIGURACIÓN ===
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  
  // Estados de edición unificada (Modal)
  const [editingSticker, setEditingSticker] = useState(null); 
  const [cropMode, setCropMode] = useState(false); 
  
  // Límites del recorte en porcentaje desde los bordes de la imagen original
  const [cropBounds, setCropBounds] = useState({ top: 5, right: 5, bottom: 5, left: 5 });
  
  // Estados para controlar el arrastre y redimensionado del recuadro de recorte interactivo
  const [dragType, setDragType] = useState(null); 
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, w: 0, h: 0, mouseX: 0, mouseY: 0, containerWidth: 0, containerHeight: 0 });

  // URL de previsualización procesada en tiempo real para el modal
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');

  // Estado de UI y Orientación de Visualización
  const [packedSheets, setPackedSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(65); // % de escala visual
  const [isRotated, setIsRotated] = useState(true); // TRUE = Vista Horizontal, FALSE = Vista Vertical
  const [hoveredSticker, setHoveredSticker] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Estado temporal de efectos para el sticker en edición
  const [editorEffects, setEditorEffects] = useState({
    removeBg: false,
    bgTargetColor: '#ffffff',
    bgTolerance: 40,
    colorMode: 'original', 
    primaryColor: '#ffffff',
    secondaryColor: '#000000',
    strokeWidth: 0, 
    strokeColor: '#ffffff',
    name: '',
    quantity: 1,
    targetSize: 40,
    sizingMode: 'max',
    theme: 't_general',
    customWidth: 40, 
    customHeight: 40 
  });

  // === 2. VARIABLES CALCULADAS DERIVADAS ===
  const totalMetersUsed = (packedSheets.length * (sheetHeight / 1000)).toFixed(2);
  const totalCostEstimate = (parseFloat(totalMetersUsed) * pricePerMeter).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  const fileInputRef = useRef(null);
  const cropContainerRef = useRef(null);

  // Carga dinámica de jsPDF para exportación de alta calidad
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Procesar empaquetado cada vez que cambien las imágenes, parámetros o las temáticas
  useEffect(() => {
    recalculateLayout();
  }, [images, sheetWidth, sheetHeight, spacing, safeMargin, packingMode, globalTargetSize, themes]);

  // === AUTO-PREVIEW EN TIEMPO REAL ===
  useEffect(() => {
    if (!editingSticker) return;

    const delayDebounce = setTimeout(() => {
      const activeEffects = {
        ...editorEffects,
        crop: { ...cropBounds }
      };
      
      applyImageEffects(editingSticker, activeEffects, (processedUrl) => {
        setLocalPreviewUrl(processedUrl);
      });
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [editorEffects, cropBounds, editingSticker]);

  // Manejo del evento MouseMove/MouseUp global para el arrastre del recuadro de recorte
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragType || !cropContainerRef.current) return;
      e.preventDefault();

      const deltaX = ((e.clientX - dragStart.mouseX) / dragStart.containerWidth) * 100;
      const deltaY = ((e.clientY - dragStart.mouseY) / dragStart.containerHeight) * 100;

      let newX = dragStart.x;
      let newY = dragStart.y;
      let newW = dragStart.w;
      let newH = dragStart.h;

      const minSize = 8; 

      if (dragType === 'move') {
        newX = Math.max(0, Math.min(100 - dragStart.w, dragStart.x + deltaX));
        newY = Math.max(0, Math.min(100 - dragStart.h, dragStart.y + deltaY));
      } else {
        if (dragType.includes('e')) {
          newW = Math.max(minSize, Math.min(100 - dragStart.x, dragStart.w + deltaX));
        }
        if (dragType.includes('w')) {
          const maxLeft = dragStart.x + dragStart.w - minSize;
          newX = Math.max(0, Math.min(maxLeft, dragStart.x + deltaX));
          newW = dragStart.w + (dragStart.x - newX);
        }
        if (dragType.includes('s')) {
          newH = Math.max(minSize, Math.min(100 - dragStart.y, dragStart.h + deltaY));
        }
        if (dragType.includes('n')) {
          const maxTop = dragStart.y + dragStart.h - minSize;
          newY = Math.max(0, Math.min(maxTop, dragStart.y + deltaY));
          newH = dragStart.h + (dragStart.y - newY);
        }
      }

      setCropBounds({
        top: Math.round(newY),
        left: Math.round(newX),
        bottom: Math.round(100 - (newY + newH)),
        right: Math.round(100 - (newX + newW))
      });
    };

    const handleMouseUp = () => {
      setDragType(null);
    };

    if (dragType) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragType, dragStart]);

  const handleHandleMouseDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropContainerRef.current) return;

    const rect = cropContainerRef.current.getBoundingClientRect();
    setDragType(type);
    setDragStart({
      x: cropBounds.left,
      y: cropBounds.top,
      w: 100 - cropBounds.left - cropBounds.right,
      h: 100 - cropBounds.top - cropBounds.bottom,
      mouseX: e.clientX,
      mouseY: e.clientY,
      containerWidth: rect.width,
      containerHeight: rect.height
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const newImgId = 'img_' + Math.random().toString(36).substr(2, 9);
          const newImg = {
            id: newImgId,
            name: file.name.split('.')[0],
            previewUrl: event.target.result, 
            originalUrl: event.target.result, 
            aspectRatio: aspectRatio,
            originalWidth: img.width,
            originalHeight: img.height,
            theme: selectedThemeForUpload,
            quantity: 1, 
            sizingMode: 'max', 
            targetSize: globalTargetSize, 
            customWidth: globalTargetSize, 
            customHeight: Math.round(globalTargetSize / aspectRatio), 
            effects: {
              removeBg: false,
              bgTargetColor: '#ffffff',
              bgTolerance: 40,
              colorMode: 'original',
              primaryColor: '#3b82f6',
              secondaryColor: '#ffffff',
              strokeWidth: 0,
              strokeColor: '#ffffff',
              crop: { top: 0, bottom: 0, left: 0, right: 0 }
            }
          };
          setImages(prev => [...prev, newImg]);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const loadDemoData = () => {
    const demoItems = [
      { name: 'Anime Boy Fighter', theme: 't1', svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="none"/><path d="M20,40 C15,40 10,50 10,65 C10,80 20,85 30,80 C35,78 40,70 50,70 C60,70 65,78 70,80 C80,85 90,80 90,65 C90,50 85,40 80,40 Z" fill="#8B5CF6" stroke="#fff" stroke-width="3"/><circle cx="25" cy="55" r="5" fill="#fff"/><circle cx="35" cy="65" r="5" fill="#fff"/><rect x="62" y="52" width="16" height="6" rx="3" fill="#10B981" transform="rotate(-15 70 55)"/><rect x="62" y="62" width="16" height="6" rx="3" fill="#EF4444" transform="rotate(15 70 65)"/></svg>` },
      { name: 'Neon Cyber Cat', theme: 't3', svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="none"/><path d="M15,30 L30,50 L70,50 L85,30 L75,75 L25,75 Z" fill="#10B981" stroke="#fff" stroke-width="3"/><circle cx="35" cy="58" r="6" fill="#fff"/><circle cx="65" cy="58" r="6" fill="#fff"/><path d="M45,66 Q50,70 55,66" fill="none" stroke="#fff" stroke-width="3"/><polygon points="30,33 22,10 40,30" fill="#EF4444"/><polygon points="70,33 78,10 60,30" fill="#EF4444"/></svg>` },
      { name: 'Coffee Cup Logo', theme: 't2', svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="none"/><path d="M25,25 L75,25 C75,25 70,75 50,75 C30,75 25,25 25,25 Z" fill="#3B82F6" stroke="#fff" stroke-width="4"/><path d="M73,35 C83,35 83,55 71,55" fill="none" stroke="#fff" stroke-width="4"/><path d="M40,10 Q45,18 40,22 M50,8 Q55,16 50,20 M60,10 Q65,18 60,22" fill="none" stroke="#fff" stroke-width="3"/></svg>` }
    ];

    const parsedImages = demoItems.map((item, idx) => {
      const blob = new Blob([item.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      return {
        id: 'demo_' + idx + '_' + Math.random().toString(36).substr(2, 5),
        name: item.name,
        originalUrl: url,
        previewUrl: url,
        aspectRatio: 1,
        originalWidth: 500,
        originalHeight: 500,
        theme: item.theme,
        quantity: 1,
        sizingMode: 'max',
        targetSize: 40,
        customWidth: 40,
        customHeight: 40,
        effects: {
          removeBg: false,
          bgTargetColor: '#ffffff',
          bgTolerance: 40,
          colorMode: 'original',
          primaryColor: '#3b82f6',
          secondaryColor: '#ffffff',
          strokeWidth: 0,
          strokeColor: '#ffffff',
          crop: { top: 0, bottom: 0, left: 0, right: 0 }
        }
      };
    });
    setImages(prev => [...prev, ...parsedImages]);
  };

  const applyImageEffects = (sticker, effectsConfig, onComplete) => {
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const crop = effectsConfig.crop || { top: 0, bottom: 0, left: 0, right: 0 };
      const startX = Math.round((crop.left / 100) * tempImg.width);
      const startY = Math.round((crop.top / 100) * tempImg.height);
      const cutWidth = Math.round(tempImg.width * (1 - (crop.left + crop.right) / 100));
      const cutHeight = Math.round(tempImg.height * (1 - (crop.top + crop.bottom) / 100));
      
      canvas.width = cutWidth > 0 ? cutWidth : tempImg.width;
      canvas.height = cutHeight > 0 ? cutHeight : tempImg.height;
      
      ctx.drawImage(
        tempImg, 
        startX, startY, canvas.width, canvas.height, 
        0, 0, canvas.width, canvas.height           
      );
      
      let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let data = imgData.data;
      
      if (effectsConfig.removeBg) {
        const hex = effectsConfig.bgTargetColor || '#ffffff';
        const targetR = parseInt(hex.slice(1, 3), 16);
        const targetG = parseInt(hex.slice(3, 5), 16);
        const targetB = parseInt(hex.slice(5, 7), 16);
        const tolerance = effectsConfig.bgTolerance || 40;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const dist = Math.sqrt(
            Math.pow(r - targetR, 2) +
            Math.pow(g - targetG, 2) +
            Math.pow(b - targetB, 2)
          );
          
          if (dist < tolerance) {
            data[i+3] = 0; 
          }
        }
      }
      
      if (effectsConfig.colorMode === 'one-color') {
        const pColor = effectsConfig.primaryColor || '#ffffff';
        const pr = parseInt(pColor.slice(1, 3), 16);
        const pg = parseInt(pColor.slice(3, 5), 16);
        const pb = parseInt(pColor.slice(5, 7), 16);
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 10) {
            data[i] = pr;
            data[i+1] = pg;
            data[i+2] = pb;
          }
        }
      } else if (effectsConfig.colorMode === 'two-color') {
        const pColor = effectsConfig.primaryColor || '#ffffff';
        const sColor = effectsConfig.secondaryColor || '#000000';
        
        const pr = parseInt(pColor.slice(1, 3), 16);
        const pg = parseInt(pColor.slice(3, 5), 16);
        const pb = parseInt(pColor.slice(5, 7), 16);
        
        const sr = parseInt(sColor.slice(1, 3), 16);
        const sg = parseInt(sColor.slice(3, 5), 16);
        const sb = parseInt(sColor.slice(5, 7), 16);
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 10) {
            const l = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            if (l > 128) {
              data[i] = pr; data[i+1] = pg; data[i+2] = pb;
            } else {
              data[i] = sr; data[i+1] = sg; data[i+2] = sb;
            }
          }
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      
      if (effectsConfig.strokeWidth > 0) {
        const strokeCanvas = document.createElement('canvas');
        const sCtx = strokeCanvas.getContext('2d');
        
        strokeCanvas.width = canvas.width;
        strokeCanvas.height = canvas.height;
        
        const maxBorderPx = Math.min(50, effectsConfig.strokeWidth * (Math.max(canvas.width, canvas.height) / 300));
        const scaleX = (canvas.width - maxBorderPx * 2) / canvas.width;
        const scaleY = (canvas.height - maxBorderPx * 2) / canvas.height;
        const scale = Math.min(scaleX, scaleY, 0.98);
        
        const drawW = canvas.width * scale;
        const drawH = canvas.height * scale;
        const drawX = (canvas.width - drawW) / 2;
        const drawY = (canvas.height - drawH) / 2;
        
        const silCanvas = document.createElement('canvas');
        const silCtx = silCanvas.getContext('2d');
        silCanvas.width = canvas.width;
        silCanvas.height = canvas.height;
        
        silCtx.drawImage(canvas, drawX, drawY, drawW, drawH);
        
        const silData = silCtx.getImageData(0, 0, silCanvas.width, silCanvas.height);
        const sD = silData.data;
        const stColor = effectsConfig.strokeColor || '#ffffff';
        const str = parseInt(stColor.slice(1, 3), 16);
        const stg = parseInt(stColor.slice(3, 5), 16);
        const stb = parseInt(stColor.slice(5, 7), 16);
        
        for (let i = 0; i < sD.length; i += 4) {
          if (sD[i+3] > 10) {
            sD[i] = str; sD[i+1] = stg; sD[i+2] = stb; sD[i+3] = 255;
          }
        }
        silCtx.putImageData(silData, 0, 0);
        
        for (let angle = 0; angle < 360; angle += 22.5) {
          const dx = Math.cos(angle * Math.PI / 180) * maxBorderPx;
          const dy = Math.sin(angle * Math.PI / 180) * maxBorderPx;
          sCtx.drawImage(silCanvas, dx, dy);
        }
        
        sCtx.drawImage(canvas, drawX, drawY, drawW, drawH);
        
        onComplete(strokeCanvas.toDataURL('image/png'), canvas.width / canvas.height);
      } else {
        onComplete(canvas.toDataURL('image/png'), canvas.width / canvas.height);
      }
    };
    tempImg.src = sticker.originalUrl;
  };

  // === FUNCIONES FALTANTES QUE CAUSABAN LA PANTALLA BLANCA ===

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const addTheme = (e) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    const newTheme = {
      id: 'theme_' + Math.random().toString(36).substr(2, 9),
      name: newThemeName.trim(),
      color: newThemeColor,
      defaultWidth: Math.round(newThemeWidth * 10),
      defaultHeight: Math.round(newThemeHeight * 10)
    };
    setThemes(prev => [...prev, newTheme]);
    setNewThemeName('');
    setNewThemeColor('#EC4899');
    setNewThemeWidth(40);
    setNewThemeHeight(20);
  };

  const openEditorModal = (img) => {
    setEditingSticker(img);
    setCropMode(false);
    // Inicializar cropBounds desde los efectos guardados del sticker
    const savedCrop = img.effects?.crop || { top: 0, bottom: 0, left: 0, right: 0 };
    setCropBounds(savedCrop);
    // Cargar efectos guardados del sticker en el editor
    setEditorEffects({
      removeBg: img.effects?.removeBg ?? false,
      bgTargetColor: img.effects?.bgTargetColor ?? '#ffffff',
      bgTolerance: img.effects?.bgTolerance ?? 40,
      colorMode: img.effects?.colorMode ?? 'original',
      primaryColor: img.effects?.primaryColor ?? '#3b82f6',
      secondaryColor: img.effects?.secondaryColor ?? '#ffffff',
      strokeWidth: img.effects?.strokeWidth ?? 0,
      strokeColor: img.effects?.strokeColor ?? '#ffffff',
      name: img.name ?? '',
      quantity: img.quantity ?? 1,
      targetSize: img.targetSize ?? globalTargetSize,
      sizingMode: img.sizingMode ?? 'max',
      theme: img.theme ?? 't_general',
      customWidth: img.customWidth ?? globalTargetSize,
      customHeight: img.customHeight ?? globalTargetSize
    });
    // Inicializar preview con la imagen actual
    setLocalPreviewUrl(img.previewUrl);
  };

  const saveEditorChanges = () => {
    if (!editingSticker) return;

    const activeEffectsConfig = {
      ...editorEffects,
      crop: { ...cropBounds }
    };

    applyImageEffects(editingSticker, activeEffectsConfig, (processedUrl, newAspectRatio) => {
      setImages(prev => prev.map(img => {
        if (img.id !== editingSticker.id) return img;
        return {
          ...img,
          name: editorEffects.name || img.name,
          previewUrl: processedUrl,
          aspectRatio: newAspectRatio ?? img.aspectRatio,
          quantity: editorEffects.quantity,
          sizingMode: editorEffects.sizingMode,
          targetSize: editorEffects.targetSize,
          customWidth: editorEffects.customWidth,
          customHeight: editorEffects.customHeight,
          theme: editorEffects.theme,
          effects: {
            removeBg: editorEffects.removeBg,
            bgTargetColor: editorEffects.bgTargetColor,
            bgTolerance: editorEffects.bgTolerance,
            colorMode: editorEffects.colorMode,
            primaryColor: editorEffects.primaryColor,
            secondaryColor: editorEffects.secondaryColor,
            strokeWidth: editorEffects.strokeWidth,
            strokeColor: editorEffects.strokeColor,
            crop: { ...cropBounds }
          }
        };
      }));
      setEditingSticker(null);
      setLocalPreviewUrl('');
    });
  };

  const downloadSingleSticker = (sticker) => {
    if (!sticker) return;
    const activeEffectsConfig = {
      ...editorEffects,
      crop: { ...cropBounds }
    };
    applyImageEffects(sticker, activeEffectsConfig, (processedUrl) => {
      const link = document.createElement('a');
      link.href = processedUrl;
      link.download = `${editorEffects.name || sticker.name || 'sticker'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const recalculateLayout = () => {
    const itemsToPack = [];
    images.forEach(img => {
      const qty = parseInt(img.quantity) || 1;
      let widthMm = 40;
      let heightMm = 40;
      const aspect = img.aspectRatio || 1;
      const sizeValue = parseFloat(img.targetSize) || globalTargetSize;
      const themePreset = themes.find(t => t.id === img.theme) || { defaultWidth: 400, defaultHeight: 200 };

      if (img.sizingMode === 'exact') {
        widthMm = parseFloat(img.customWidth) || 40;
        heightMm = parseFloat(img.customHeight) || 40;
      } else if (img.sizingMode === 'theme-preset') {
        widthMm = themePreset.defaultWidth / 3; 
        heightMm = themePreset.defaultHeight / 3;
      } else if (img.sizingMode === 'max') {
        if (aspect >= 1) {
          widthMm = sizeValue;
          heightMm = sizeValue / aspect;
        } else {
          heightMm = sizeValue;
          widthMm = sizeValue * aspect;
        }
      } else if (img.sizingMode === 'width') {
        widthMm = sizeValue;
        heightMm = sizeValue / aspect;
      } else if (img.sizingMode === 'height') {
        heightMm = sizeValue;
        widthMm = heightMm * aspect;
      }

      for (let i = 0; i < qty; i++) {
        itemsToPack.push({
          id: `${img.id}_copy_${i}`,
          parentId: img.id,
          name: img.name,
          theme: img.theme,
          imageSrc: img.previewUrl,
          width: widthMm,
          height: heightMm,
          aspectRatio: aspect
        });
      }
    });

    if (itemsToPack.length === 0) {
      setPackedSheets([]);
      return;
    }

    if (packingMode === 'theme') {
      const themesMap = {};
      itemsToPack.forEach(item => {
        if (!themesMap[item.theme]) themesMap[item.theme] = [];
        themesMap[item.theme].push(item);
      });

      const themeBlocksToPack = [];

      Object.keys(themesMap).forEach(themeId => {
        const themeItems = themesMap[themeId];
        const themeInfo = themes.find(t => t.id === themeId) || { name: 'General', color: '#6B7280', defaultWidth: 400, defaultHeight: 200 };
        
        const blockW = themeInfo.defaultWidth;  
        const blockH = themeInfo.defaultHeight; 
        const sortedItems = [...themeItems].sort((a, b) => b.height - a.height);
        
        let currentBlockItems = [];
        let currentShelves = [];
        let blockIndex = 1;

        const pushBlock = () => {
          if (currentBlockItems.length > 0) {
            themeBlocksToPack.push({
              id: `block_${themeId}_${blockIndex++}`,
              themeId: themeId,
              themeName: themeInfo.name,
              themeColor: themeInfo.color,
              width: blockW,
              height: blockH,
              items: [...currentBlockItems]
            });
          }
        };

        sortedItems.forEach(item => {
          let placed = false;

          const stickerW = Math.min(item.width, blockW - spacing * 2);
          const stickerH = Math.min(item.height, blockH - spacing * 2);
          const adjustedItem = { ...item, width: stickerW, height: stickerH };

          for (const shelf of currentShelves) {
            if (shelf.currentX + adjustedItem.width <= blockW - spacing && adjustedItem.height <= shelf.height * 1.3) {
              currentBlockItems.push({
                ...adjustedItem,
                relX: shelf.currentX,
                relY: shelf.y
              });
              shelf.currentX += adjustedItem.width + spacing;
              if (adjustedItem.height > shelf.height) shelf.height = adjustedItem.height;
              placed = true;
              break;
            }
          }

          if (!placed) {
            const lastY = currentShelves.length > 0 ? currentShelves[currentShelves.length - 1].y + currentShelves[currentShelves.length - 1].height + spacing : 0;
            if (lastY + adjustedItem.height <= blockH - spacing) {
              currentShelves.push({ y: lastY, height: adjustedItem.height, currentX: adjustedItem.width + spacing });
              currentBlockItems.push({
                ...adjustedItem,
                relX: 0,
                relY: lastY
              });
              placed = true;
            }
          }

          if (!placed) {
            pushBlock();
            currentBlockItems = [];
            currentShelves = [{ y: 0, height: adjustedItem.height, currentX: adjustedItem.width + spacing }];
            currentBlockItems.push({
              ...adjustedItem,
              relX: 0,
              relY: 0
            });
          }
        });
        pushBlock();
      });

      const maxPrintableW = sheetWidth - (safeMargin * 2);
      themeBlocksToPack.forEach(b => {
        if (b.width > maxPrintableW) b.width = maxPrintableW;
      });

      const sortedBlocks = [...themeBlocksToPack].sort((a, b) => b.height - a.height);
      const sheets = [{ id: 1, packedBlocks: [], packedItems: [], shelves: [], areaUtilized: 0 }];

      sortedBlocks.forEach(block => {
        let placed = false;
        const printableHeight = sheetHeight - (safeMargin * 2);

        for (const sheet of sheets) {
          for (const shelf of sheet.shelves) {
            if (shelf.currentX + block.width <= maxPrintableW && block.height <= shelf.height * 1.3) {
              const absX = shelf.currentX + safeMargin;
              const absY = shelf.y + safeMargin;

              sheet.packedBlocks.push({ ...block, x: absX, y: absY });
              block.items.forEach(item => {
                sheet.packedItems.push({
                  ...item,
                  x: absX + item.relX + spacing,
                  y: absY + item.relY + spacing
                });
              });

              shelf.currentX += block.width + spacing;
              if (block.height > shelf.height) shelf.height = block.height;
              sheet.areaUtilized += block.width * block.height;
              placed = true;
              break;
            }
          }
          if (placed) break;

          const lastY = sheet.shelves.length > 0 ? sheet.shelves[sheet.shelves.length - 1].y + sheet.shelves[sheet.shelves.length - 1].height + spacing : 0;
          if (lastY + block.height <= printableHeight) {
            const absX = safeMargin;
            const absY = lastY + safeMargin;

            sheet.shelves.push({ y: lastY, height: block.height, currentX: block.width + spacing });
            sheet.packedBlocks.push({ ...block, x: absX, y: absY });
            block.items.forEach(item => {
              sheet.packedItems.push({
                ...item,
                x: absX + item.relX + spacing,
                y: absY + item.relY + spacing
              });
            });

            sheet.areaUtilized += block.width * block.height;
            placed = true;
            break;
          }
        }

        if (!placed) {
          const newSheet = { id: sheets.length + 1, packedBlocks: [], packedItems: [], shelves: [{ y: 0, height: block.height, currentX: block.width + spacing }], areaUtilized: block.width * block.height };
          const absX = safeMargin;
          const absY = safeMargin;

          newSheet.packedBlocks.push({ ...block, x: absX, y: absY });
          block.items.forEach(item => {
            newSheet.packedItems.push({
              ...item,
              x: absX + item.relX + spacing,
              y: absY + item.relY + spacing
            });
          });

          sheets.push(newSheet);
        }
      });

      sheets.forEach(s => {
        const printableArea = maxPrintableW * (sheetHeight - (safeMargin * 2));
        s.utilizationPercentage = Math.min(100, Math.round((s.areaUtilized / printableArea) * 100));
      });

      setPackedSheets(sheets);
      if (activeSheetIndex >= sheets.length) setActiveSheetIndex(0);

    } else {
      const sortedMixItems = [...itemsToPack].sort((a, b) => b.height - a.height);
      const tempSheets = runShelfPacker(sortedMixItems, sheetWidth, sheetHeight, spacing, safeMargin);
      
      tempSheets.forEach((sheet, idx) => {
        sheet.id = idx + 1;
        sheet.themeName = 'Mixto (Optimizado)';
        sheet.themeColor = '#10B981';
        sheet.packedBlocks = []; // modo optimizado no tiene blocks
      });

      setPackedSheets(tempSheets);
      if (activeSheetIndex >= tempSheets.length) setActiveSheetIndex(0);
    }
  };

  // (Helper algorithm)
  const runShelfPacker = (items, totalWidth, totalHeight, margin, safe) => {
    const printableWidth = totalWidth - (safe * 2);
    const printableHeight = totalHeight - (safe * 2);

    const sheets = [];
    const createNewSheet = (sheetNum) => ({
      id: sheetNum,
      packedItems: [],
      shelves: [],
      areaUtilized: 0
    });

    sheets.push(createNewSheet(1));

    items.forEach(item => {
      let placed = false;

      for (const sheet of sheets) {
        for (const shelf of sheet.shelves) {
          if (shelf.currentX + item.width <= printableWidth && item.height <= shelf.height * 1.3) {
            sheet.packedItems.push({
              ...item,
              x: shelf.currentX + safe,
              y: shelf.y + safe,
            });
            shelf.currentX += item.width + margin;
            if (item.height > shelf.height) {
              shelf.height = item.height;
            }
            sheet.areaUtilized += item.width * item.height;
            placed = true;
            break;
          }
        }
        if (placed) break;

        const lastShelfY = sheet.shelves.length > 0
          ? sheet.shelves[sheet.shelves.length - 1].y + sheet.shelves[sheet.shelves.length - 1].height + margin
          : 0;

        if (lastShelfY + item.height <= printableHeight) {
          const newShelf = {
            y: lastShelfY,
            height: item.height,
            currentX: item.width + margin
          };
          sheet.shelves.push(newShelf);
          sheet.packedItems.push({
            ...item,
            x: safe,
            y: lastShelfY + safe
          });
          sheet.areaUtilized += item.width * item.height;
          placed = true;
          break;
        }
      }

      if (!placed) {
        const newSheet = createNewSheet(sheets.length + 1);
        const firstShelf = {
          y: 0,
          height: item.height,
          currentX: item.width + margin
        };
        newSheet.shelves.push(firstShelf);
        newSheet.packedItems.push({
          ...item,
          x: safe,
          y: safe
        });
        newSheet.areaUtilized += item.width * item.height;
        sheets.push(newSheet);
      }
    });

    sheets.forEach(sheet => {
      const printableArea = printableWidth * printableHeight;
      sheet.utilizationPercentage = Math.min(100, Math.round((sheet.areaUtilized / printableArea) * 100));
    });

    return sheets;
  };

  const generatePDF = async () => {
    if (packedSheets.length === 0) return;

    // Esperar a que jsPDF esté disponible
    if (!window.jspdf) {
      setPdfProgress('Cargando librería PDF...');
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.jspdf) {
            clearInterval(interval);
            resolve();
          } else if (attempts > 30) {
            clearInterval(interval);
            reject(new Error('jsPDF no pudo cargarse'));
          }
        }, 200);
      });
    }

    setIsGeneratingPdf(true);
    setPdfProgress('Iniciando PDF...');

    try {
      const { jsPDF } = window.jspdf;
      const orientation = sheetWidth > sheetHeight ? 'landscape' : 'portrait';
      
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [sheetWidth, sheetHeight]
      });

      for (let sIdx = 0; sIdx < packedSheets.length; sIdx++) {
        const sheet = packedSheets[sIdx];
        setPdfProgress(`Procesando Plancha ${sIdx + 1} de ${packedSheets.length}...`);

        if (sIdx > 0) {
          doc.addPage([sheetWidth, sheetHeight]);
        }

        if (showCutMarks) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.rect(safeMargin, safeMargin, sheetWidth - (safeMargin * 2), sheetHeight - (safeMargin * 2), 'S');
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`DTF UV PLOTTER PLANNER | Plancha ${sIdx + 1}/${packedSheets.length}`, safeMargin, safeMargin - 3);
        }

        if (packingMode === 'theme' && sheet.packedBlocks) {
          sheet.packedBlocks.forEach(block => {
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([2, 2], 0);
            doc.rect(block.x, block.y, block.width, block.height, 'S');
            
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 130);
            doc.text(`${block.themeName.toUpperCase()} [${block.width/10}x${block.height/10} cm]`, block.x + 2, block.y + 4);
          });
          doc.setLineDashPattern([], 0);
        }

        for (let iIdx = 0; iIdx < sheet.packedItems.length; iIdx++) {
          const item = sheet.packedItems[iIdx];
          try {
            doc.addImage(
              item.imageSrc, 
              'PNG', 
              item.x, 
              item.y, 
              item.width, 
              item.height, 
              undefined, 
              'FAST'
            );
          } catch (e) {
            console.error("Error al incrustar sticker en PDF: ", e);
          }
        }
      }

      setPdfProgress('Generando descarga...');
      
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `Planchas_DTF_UV_${sheetWidth / 10}x${sheetHeight / 10}cm.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      document.body.removeChild(downloadLink);
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 150);

    } catch (error) {
      console.error(error);
      setPdfProgress('Error al generar PDF.');
      setTimeout(() => setPdfProgress(''), 4000);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  const scale = (zoomLevel / 100) * 1.2;

  let currentBaseWidth = editorEffects.targetSize;
  let currentBaseHeight = editorEffects.targetSize / (editingSticker?.aspectRatio || 1);

  const themePresetForCalc = themes.find(t => t.id === editorEffects.theme) || { defaultWidth: 400, defaultHeight: 200 };

  if (editorEffects.sizingMode === 'exact') {
    currentBaseWidth = editorEffects.customWidth;
    currentBaseHeight = editorEffects.customHeight;
  } else if (editorEffects.sizingMode === 'theme-preset') {
    currentBaseWidth = themePresetForCalc.defaultWidth / 3;
    currentBaseHeight = themePresetForCalc.defaultHeight / 3;
  } else if (editorEffects.sizingMode === 'width') {
    currentBaseWidth = editorEffects.targetSize;
    currentBaseHeight = editorEffects.targetSize / (editingSticker?.aspectRatio || 1);
  } else if (editorEffects.sizingMode === 'height') {
    currentBaseHeight = editorEffects.targetSize;
    currentBaseWidth = editorEffects.targetSize * (editingSticker?.aspectRatio || 1);
  } else if (editorEffects.sizingMode === 'max') {
    const asp = editingSticker?.aspectRatio || 1;
    if (asp >= 1) {
      currentBaseWidth = editorEffects.targetSize;
      currentBaseHeight = editorEffects.targetSize / asp;
    } else {
      currentBaseHeight = editorEffects.targetSize;
      currentBaseWidth = editorEffects.targetSize * asp;
    }
  }

  const calculatedCropWidthCm = (currentBaseWidth / 10) * (1 - (cropBounds.left + cropBounds.right) / 100);
  const calculatedCropHeightCm = (currentBaseHeight / 10) * (1 - (cropBounds.top + cropBounds.bottom) / 100);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex flex-col">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-violet-600 to-cyan-500 p-2.5 rounded-xl shadow-inner">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Smart DTF UV Pro Layout
            </h1>
            <p className="text-xs text-slate-400 font-medium font-mono">Pre-prensa, Distribución Óptima y Grilla Unificada de Stickers</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Planchas: <strong>{packedSheets.length}</strong></span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400"></span>
            <span>Uso de Film: <strong>{totalMetersUsed} m</strong></span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Precio Est.: <strong>{currencySymbol}{totalCostEstimate}</strong></span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* PANEL IZQUIERDO: CONFIGURACIONES Y LISTADO EN GRILLA DE STICKERS */}
        <aside className="w-full lg:w-[440px] bg-slate-950 border-r border-slate-800 p-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-80px)]">
          
          {/* BOTÓN COLAPSABLE INTERACTIVO DE CONFIGURACIONES GENERALES */}
          <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              ⚙️ CONFIGURACIONES GENERALES
            </h3>
            <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-black bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded transition-all cursor-pointer"
            >
              {isConfigOpen ? 'OCULTAR ▽' : 'MOSTRAR ▷'}
            </button>
          </div>

          {}
          {isConfigOpen && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* 1. CONFIGURACIÓN DE PELÍCULA */}
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-inner">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                  1. Configuración de Película
                </h3>
                
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button 
                    onClick={() => { setSheetHeight(1000); }}
                    className={`py-2 px-3 rounded-lg border font-semibold text-xs transition-all ${
                      sheetHeight === 1000 
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    58 cm x 1 Metro
                  </button>
                  <button 
                    onClick={() => { setSheetHeight(500); }}
                    className={`py-2 px-3 rounded-lg border font-semibold text-xs transition-all ${
                      sheetHeight === 500 
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    58 cm x 50 cm
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs mt-1">
                  <div>
                    <label className="text-slate-400 block mb-1">Ancho Imprimible (mm)</label>
                    <input 
                      type="number" 
                      value={sheetWidth} 
                      onChange={(e) => setSheetWidth(parseInt(e.target.value) || 580)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Márgen Seguro (mm)</label>
                    <input 
                      type="number" 
                      value={safeMargin} 
                      onChange={(e) => setSafeMargin(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Espacio de corte (mm)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={spacing} 
                      onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      min="1"
                      max="30"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tamaño Base (cm)</label>
                    <input 
                      type="number" 
                      value={globalTargetSize / 10} 
                      onChange={(e) => setGlobalTargetSize((parseFloat(e.target.value) || 3) * 10)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      min="1"
                      max="50"
                    />
                  </div>
                </div>
              </div>

              {/* 2. PLACHITAS POR TEMÁTICAS */}
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-inner">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                  2. Planchitas por Temáticas
                </h3>
                
                {/* Lista editable de medidas de temáticas */}
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                  {themes.map((theme) => (
                    <div key={theme.id} className="flex flex-col gap-1 p-2 bg-slate-950 border border-slate-850 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.color }}></span>
                          <span className="text-[11px] font-extrabold text-slate-200 truncate">{theme.name}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 mt-0.5">
                        <div>
                          <span className="block mb-0.5">Plancha Ancho (cm):</span>
                          <input 
                            type="number"
                            value={theme.defaultWidth / 10}
                            onChange={(e) => {
                              const val = (parseFloat(e.target.value) || 1) * 10;
                              setThemes(prev => prev.map(t => t.id === theme.id ? { ...t, defaultWidth: val } : t));
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-center font-bold font-mono"
                          />
                        </div>
                        <div>
                          <span className="block mb-0.5">Plancha Alto (cm):</span>
                          <input 
                            type="number"
                            value={theme.defaultHeight / 10}
                            onChange={(e) => {
                              const val = (parseFloat(e.target.value) || 1) * 10;
                              setThemes(prev => prev.map(t => t.id === theme.id ? { ...t, defaultHeight: val } : t));
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-center font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Formulario de creación de temática */}
                <form onSubmit={addTheme} className="flex flex-col gap-2 mt-1 border-t border-slate-900 pt-2.5">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nueva temática..." 
                      value={newThemeName}
                      onChange={(e) => setNewThemeName(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                    />
                    <input 
                      type="color" 
                      value={newThemeColor}
                      onChange={(e) => setNewThemeColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      <label className="block mb-1 font-semibold">Ancho Plancha (cm):</label>
                      <input 
                        type="number" 
                        value={newThemeWidth}
                        onChange={(e) => setNewThemeWidth(parseFloat(e.target.value) || 1)}
                        min="1"
                        max="50"
                        step="0.5"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-semibold">Alto Plancha (cm):</label>
                      <input 
                        type="number" 
                        value={newThemeHeight}
                        onChange={(e) => setNewThemeHeight(parseFloat(e.target.value) || 1)}
                        min="1"
                        max="50"
                        step="0.5"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-xs py-1.5 rounded-lg transition-colors font-bold mt-1 cursor-pointer"
                  >
                    + Crear Temática
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 3. SUBIR IMÁGENES */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                3. Subir Imágenes
              </h3>
              <button 
                onClick={loadDemoData}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
              >
                💡 Cargar Demo
              </button>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">Destinar subida a temática:</label>
              <select 
                value={selectedThemeForUpload}
                onChange={(e) => setSelectedThemeForUpload(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none cursor-pointer"
              >
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.defaultWidth/10}x{t.defaultHeight/10} cm)</option>
                ))}
              </select>
            </div>

            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-cyan-400 bg-cyan-950/20 text-cyan-200' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-300'
              }`}
            >
              <svg className={`w-7 h-7 ${isDragging ? 'text-cyan-400 animate-bounce' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              <div className="text-xs font-semibold">Arrastra tus archivos de imagen aquí</div>
              <p className="text-[10px] text-slate-500 font-medium">Soporta transparencias PNG y SVG</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>

          {/* === STREAMING_CHUNK:Rendering uploaded stickers grid... === */}
          {/* 4. LISTADO EN GRILLA DE STICKERS CARGADOS */}
          <div className="flex-1 flex flex-col gap-3 min-h-[300px]">
            <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded-xl border border-slate-800/60">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Stickers Cargados ({images.length})
              </span>
              
              {images.length > 0 && (
                <button 
                  onClick={() => setImages([])} 
                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold bg-transparent border-none cursor-pointer"
                >
                  Limpiar Todo
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <div className="flex-1 border border-slate-800/80 border-dashed rounded-xl bg-slate-950/20 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <p className="text-xs">No hay imágenes en cola de edición.</p>
                <button 
                  onClick={loadDemoData}
                  className="mt-3 text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 px-4 py-1.5 rounded-lg font-medium transition-all cursor-pointer"
                >
                  Cargar diseños demo
                </button>
              </div>
            ) : (
              // GRILLA DE STICKERS DE VISTA COMPACTA
              <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[350px] lg:max-h-none p-1">
                {images.map((img) => {
                  const currentTheme = themes.find(t => t.id === img.theme) || { name: 'General', color: '#6B7280', defaultWidth: 400, defaultHeight: 200 };
                  
                  // Calcular tamaños físicos mostrados en el badge de la celda de la grilla
                  let finalWidthCm = img.targetSize / 10;
                  let finalHeightCm = (img.targetSize / 10) / (img.aspectRatio || 1);

                  if (img.sizingMode === 'exact') {
                    finalWidthCm = (img.customWidth || 40) / 10;
                    finalHeightCm = (img.customHeight || 40) / 10;
                  } else if (img.sizingMode === 'theme-preset') {
                    finalWidthCm = currentTheme.defaultWidth / 10;
                    finalHeightCm = currentTheme.defaultHeight / 10;
                  }

                  return (
                    <div 
                      key={img.id}
                      onClick={() => openEditorModal(img)}
                      className="group bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/80 rounded-xl p-2.5 flex flex-col items-center gap-1.5 relative cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-violet-950/20 animate-fade-in"
                    >
                      {/* Miniatura en Caja */}
                      <div className="w-full h-24 bg-slate-950 rounded-lg p-1.5 flex items-center justify-center border border-slate-850 overflow-hidden relative">
                        <img src={img.previewUrl} alt={img.name} className="max-w-full max-h-full object-contain filter drop-shadow-md" />
                        <span 
                          className="absolute bottom-0 left-0 right-0 h-1" 
                          style={{ backgroundColor: currentTheme.color }}
                        ></span>
                      </div>

                      {/* Nombre Archivo */}
                      <span className="text-[11px] font-bold text-slate-300 truncate w-full text-center px-1" title={img.name}>
                        {img.name}
                      </span>

                      {/* Badges de Estado */}
                      <div className="flex flex-col gap-1 justify-center items-center w-full">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-emerald-400 font-mono font-bold">
                          {finalWidthCm.toFixed(1)}x{finalHeightCm.toFixed(1)} cm
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-cyan-400 font-bold">
                          {img.quantity || 1} ud {img.sizingMode === 'exact' ? '(Exacta)' : img.sizingMode === 'theme-preset' ? '(Tema)' : ''}
                        </span>
                      </div>

                      {/* Botones de acción flotantes en hover */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Evita abrir modal
                          removeImage(img.id);
                        }}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-600/90 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 transition-all shadow-md cursor-pointer border-none z-10"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* === STREAMING_CHUNK:Rendering main printable sheet canvas... === */}
        {/* ÁREA DE PREVIEW Y PLANCHAS GENERAL */}
        <main className="flex-1 bg-slate-900 p-6 flex flex-col gap-4 overflow-hidden relative">
          
          {/* BARRA DE ACCIONES DE LA PLANCHA */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col lg:flex-row justify-between items-center gap-3 shadow-md shrink-0">
            
            {/* Opciones de Empaquetado */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 ml-2">Organización:</span>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setPackingMode('theme')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    packingMode === 'theme' 
                      ? 'bg-violet-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  📁 Planchitas Temáticas
                </button>
                <button 
                  onClick={() => setPackingMode('optimized')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    packingMode === 'optimized' 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  🔄 Mezclado (Ahorro Máximo)
                </button>
              </div>
            </div>

            {/* Selector de Orientación del Lienzo en pantalla */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Vista del Lienzo:</span>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setIsRotated(true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    isRotated 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📐 Horizontal
                </button>
                <button 
                  onClick={() => setIsRotated(false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    !isRotated 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🪜 Vertical
                </button>
              </div>
            </div>

            {/* Configuración de Costos y Marcas */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                <label className="text-[10px] text-slate-500 font-bold">m Lineal:</label>
                <input 
                  type="text" 
                  value={currencySymbol} 
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-4 bg-transparent border-none p-0 text-xs font-bold text-slate-300 text-center focus:outline-none"
                />
                <input 
                  type="number" 
                  value={pricePerMeter} 
                  onChange={(e) => setPricePerMeter(parseInt(e.target.value) || 0)}
                  className="w-16 bg-transparent border-none p-0 text-xs font-bold text-slate-100 focus:outline-none text-left"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                <input 
                  type="checkbox" 
                  id="cutMarksCheckbox"
                  checked={showCutMarks}
                  onChange={(e) => setShowCutMarks(e.target.checked)}
                  className="rounded border-slate-800 text-cyan-500 focus:ring-0 bg-slate-950 cursor-pointer w-3.5 h-3.5"
                />
                <label htmlFor="cutMarksCheckbox" className="text-[10px] text-slate-400 font-bold cursor-pointer">Guías</label>
              </div>
            </div>

            {/* Botón de Exportación Premium */}
            <button 
              onClick={generatePDF}
              disabled={packedSheets.length === 0 || isGeneratingPdf}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-all ${
                packedSheets.length === 0 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : isGeneratingPdf 
                    ? 'bg-cyan-700 text-slate-200 cursor-wait' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transform active:scale-95'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Generar PDF</span>
                </>
              )}
            </button>
          </div>

          {/* VISUALIZADOR DE PLANCHAS */}
          <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden">
            
            {/* Selector Lateral de Planchas */}
            <div className="w-full md:w-56 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto max-h-[100px] md:max-h-none shrink-0">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:block mb-2">Planchas ({packedSheets.length})</div>
              
              {packedSheets.length === 0 ? (
                <div className="text-xs text-slate-600 italic py-2 hidden md:block">No hay material cargado</div>
              ) : (
                packedSheets.map((sheet, index) => (
                  <button
                    key={sheet.id}
                    onClick={() => setActiveSheetIndex(index)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left shrink-0 w-44 md:w-full ${
                      activeSheetIndex === index 
                        ? 'bg-slate-800 border-cyan-500 text-white shadow-md shadow-cyan-500/5' 
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" 
                      style={{ backgroundColor: sheet.themeColor }}
                    ></span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">Plancha {sheet.id}</div>
                      <div className="text-[10px] text-slate-500 truncate">{sheet.themeName}</div>
                      <div className="text-[10px] text-cyan-400 font-semibold">{sheet.utilizationPercentage}% Optimizado</div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Lienzo / Canvas de la Plancha Activa */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col overflow-hidden relative shadow-inner">
              
              {/* Barra de control de Zoom */}
              <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 mb-3 text-xs shrink-0">
                {packedSheets[activeSheetIndex] ? (
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-300">Plancha {packedSheets[activeSheetIndex].id}</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                      Medida Real: {sheetWidth / 10} x {sheetHeight / 10} cm
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold">
                      ({packedSheets[activeSheetIndex].packedItems.length} stickers)
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">Sin planchas para previsualizar</span>
                )}
                
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-400">Zoom:</span>
                  <input 
                    type="range" 
                    min="20" 
                    max="100" 
                    value={zoomLevel} 
                    onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                    className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <span className="font-mono text-slate-300 w-8 text-right">{zoomLevel}%</span>
                </div>
              </div>

              {/* El Film de impresión */}
              <div className="flex-1 overflow-auto flex justify-center items-center bg-slate-900/60 rounded-xl border border-slate-800 p-6 relative">
                {packedSheets[activeSheetIndex] ? (
                  <div 
                    className="relative bg-slate-950 border border-dashed border-slate-700 shadow-2xl transition-all"
                    style={{
                      width: isRotated ? `${sheetHeight * scale}px` : `${sheetWidth * scale}px`,
                      height: isRotated ? `${sheetWidth * scale}px` : `${sheetHeight * scale}px`,
                      backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                      backgroundSize: '12px 12px'
                    }}
                  >
                    
                    {/* REGLA MILIMÉTRICA DINÁMICA */}
                    {isRotated ? (
                      <div className="absolute -top-6 left-0 right-0 h-5 border-b border-slate-800 flex justify-between text-[9px] text-slate-500 select-none px-1 font-mono">
                        {Array.from({ length: Math.floor(sheetHeight / 100) + 1 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute"
                            style={{ left: `${(i * 100) * scale}px` }}
                          >
                            | {i * 10} cm
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute top-0 -left-10 bottom-0 w-8 border-r border-slate-800 flex flex-col justify-between text-[10px] text-slate-600 select-none pr-1.5 font-mono text-right">
                        {Array.from({ length: Math.floor(sheetHeight / 100) + 1 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute w-full"
                            style={{ top: `${(i * 100) * scale}px` }}
                          >
                            {i * 10} cm —
                          </div>
                        ))}
                      </div>
                    )}

                    {/* REGLA ANCHO BOBINA (58 cm) */}
                    {isRotated ? (
                      <div className="absolute top-0 -left-10 bottom-0 w-8 border-r border-slate-850 flex flex-col justify-between text-[9px] text-slate-500 select-none pr-1.5 font-mono text-right">
                        {Array.from({ length: Math.floor(sheetWidth / 100) + 1 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute w-full"
                            style={{ top: `${(i * 100) * scale}px` }}
                          >
                            {i * 10} cm —
                          </div>
                        ))}
                        <div className="absolute w-full" style={{ top: `${sheetWidth * scale}px` }}>58 cm —</div>
                      </div>
                    ) : (
                      <div className="absolute -top-6 left-0 right-0 h-5 border-b border-slate-850 flex justify-between text-[9px] text-slate-500 select-none px-1 font-mono">
                        {Array.from({ length: Math.floor(sheetWidth / 100) + 1 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute"
                            style={{ left: `${(i * 100) * scale}px` }}
                          >
                            | {i * 10} cm
                          </div>
                        ))}
                        <div className="absolute" style={{ left: `${sheetWidth * scale}px` }}>| 58 cm</div>
                      </div>
                    )}

                    {/* Línea e indicador visual de Margen Seguro */}
                    <div 
                      className="absolute border border-dashed border-red-500/40 pointer-events-none rounded"
                      style={{
                        top: `${safeMargin * scale}px`,
                        left: `${safeMargin * scale}px`,
                        width: isRotated 
                          ? `${(sheetHeight - safeMargin * 2) * scale}px` 
                          : `${(sheetWidth - safeMargin * 2) * scale}px`,
                        height: isRotated 
                          ? `${(sheetWidth - safeMargin * 2) * scale}px` 
                          : `${(sheetHeight - safeMargin * 2) * scale}px`
                      }}
                    >
                      <span className="absolute -top-4 left-1 text-[8px] text-red-500/70 font-bold uppercase tracking-wider">
                        Borde Seguro Impresión
                      </span>
                    </div>

                    {/* === DIBUJAR CONTENEDORES DE PLANCHITAS TEMÁTICAS RECTANGULARES === */}
                    {packingMode === 'theme' && packedSheets[activeSheetIndex]?.packedBlocks?.map((block, bIdx) => {
                      const leftPos = isRotated ? block.y * scale : block.x * scale;
                      const topPos = isRotated ? block.x * scale : block.y * scale;
                      const widthSize = isRotated ? block.height * scale : block.width * scale;
                      const heightSize = isRotated ? block.width * scale : block.height * scale;

                      return (
                        <div
                          key={`block_${bIdx}`}
                          className="absolute border-2 border-dashed rounded-xl pointer-events-none z-10 flex flex-col justify-start"
                          style={{
                            left: `${leftPos}px`,
                            top: `${topPos}px`,
                            width: `${widthSize}px`,
                            height: `${heightSize}px`,
                            borderColor: block.themeColor,
                            backgroundColor: `${block.themeColor}05`
                          }}
                        >
                          <div 
                            className="text-[9px] font-black text-slate-100 px-2 py-0.5 rounded-br-lg rounded-tl-sm self-start whitespace-nowrap shadow flex items-center gap-1 select-none pointer-events-auto"
                            style={{ backgroundColor: block.themeColor }}
                            title={`Esta planchita mide exactamente ${block.width/10}x${block.height/10} cm`}
                          >
                            <span>📁 {block.themeName}</span>
                            <span className="opacity-75 font-normal">({block.width/10}x{block.height/10} cm)</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Stickers en el Lienzo */}
                    {packedSheets[activeSheetIndex]?.packedItems?.map((item) => {
                      const itemTheme = themes.find(t => t.id === item.theme) || { color: '#8B5CF6' };
                      
                      const leftPos = isRotated ? item.y * scale : item.x * scale;
                      const topPos = isRotated ? item.x * scale : item.y * scale;
                      const widthSize = isRotated ? item.height * scale : item.width * scale;
                      const heightSize = isRotated ? item.width * scale : item.height * scale;

                      return (
                        <div
                          key={item.id}
                          className="absolute group cursor-pointer z-20"
                          style={{
                            left: `${leftPos}px`,
                            top: `${topPos}px`,
                            width: `${widthSize}px`,
                            height: `${heightSize}px`
                          }}
                          onMouseEnter={() => setHoveredSticker(item)}
                          onMouseLeave={() => setHoveredSticker(null)}
                        >
                          <div 
                            className="w-full h-full p-[1px] rounded transition-all group-hover:scale-105 group-hover:shadow-lg relative overflow-hidden flex items-center justify-center"
                            style={{
                              border: `1.5px solid ${itemTheme.color}60`,
                              backgroundColor: 'rgba(30, 41, 59, 0.05)'
                            }}
                          >
                            <img 
                              src={item.imageSrc} 
                              alt={item.name} 
                              className="pointer-events-none object-contain animate-fade-in"
                              style={{
                                width: '100%',
                                height: '100%',
                                transform: isRotated ? 'rotate(-90deg)' : 'none',
                                transition: 'transform 0.15s ease'
                              }}
                            />

                            {/* Badge flotante en hover */}
                            <div className="absolute opacity-0 group-hover:opacity-100 bg-slate-950/90 border border-slate-700 text-[9px] px-2 py-1 rounded-lg text-slate-100 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap shadow-xl z-20 transition-all pointer-events-none">
                              <span className="font-bold">{item.name}</span>
                              <div className="text-cyan-400 font-mono text-[8px] mt-0.5">
                                {(item.width / 10).toFixed(1)} x {(item.height / 10).toFixed(1)} cm
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Guía en Hover */}
                    {hoveredSticker && (
                      <div 
                        className="absolute bg-transparent border-2 border-dashed pointer-events-none z-30 animate-pulse"
                        style={{
                          left: `${(isRotated ? hoveredSticker.y : hoveredSticker.x) * scale}px`,
                          top: `${(isRotated ? hoveredSticker.x : hoveredSticker.y) * scale}px`,
                          width: `${(isRotated ? hoveredSticker.height : hoveredSticker.width) * scale}px`,
                          height: `${(isRotated ? hoveredSticker.width : hoveredSticker.height) * scale}px`,
                          borderColor: '#22d3ee'
                        }}
                      ></div>
                    )}

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-slate-600 gap-3">
                    <svg className="w-12 h-12 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-slate-400">Plancha Vacía</p>
                      <p className="text-xs text-slate-500 mt-1">Sube tus stickers e imágenes por temáticas para ver el empaquetado inteligente.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* BARRA DE ESTADO DEL LIENZO */}
              {packedSheets[activeSheetIndex] && (
                <div className="mt-3 flex flex-wrap justify-between items-center text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 shrink-0">
                  <div className="flex gap-4">
                    <span>Stickers en esta plancha: <strong>{packedSheets[activeSheetIndex].packedItems.length}</strong></span>
                    <span>Ancho Útil: <strong>{(sheetWidth - (safeMargin * 2)) / 10} cm</strong></span>
                    <span>Alto Útil: <strong>{(sheetHeight - (safeMargin * 2)) / 10} cm</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span>Eficiencia de Espacio: <strong className="text-cyan-400">{packedSheets[activeSheetIndex].utilizationPercentage}%</strong></span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* ==================================================================== */}
      {/* === MODAL DE EDICIÓN AVANZADA DE STICKER (MÓDULO PRE-PRENSA PRO) === */}
      {/* ==================================================================== */}
      {editingSticker && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-up">
            
            {/* Cabecera del Editor */}
            <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-violet-600/15 text-violet-400 p-2 rounded-xl border border-violet-500/20 animate-pulse">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                    <span>Configuración & Edición de Stickers</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      ⚡ Autopreview Activo
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Recortes interactivos, remoción cromática de fondos y trazado de contorno de seguridad</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingSticker(null)}
                className="text-slate-400 hover:text-slate-100 bg-slate-900 hover:bg-slate-850 px-4 py-2 rounded-xl transition-all font-semibold"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Cuerpo del Editor */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
              
              {/* Visualizador Comparador (Original vs Resultado) */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lienzo Interactivo de Trabajo</span>
                  
                  {/* Botón de Recorte principal */}
                  <button 
                    onClick={() => setCropMode(!cropMode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      cropMode 
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md' 
                        : 'bg-slate-850 border border-slate-800 text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    ✂️ {cropMode ? 'Ajustando Recorte...' : 'Ajustar Recorte'}
                  </button>
                </div>
                
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800/80 p-6 flex items-center justify-center relative overflow-hidden min-h-[340px] pattern-bg shadow-inner">
                  
                  {/* === ENTORNO DE RECORTE CON TIRADORES REALES === */}
                  <div 
                    ref={cropContainerRef}
                    className="relative max-w-full max-h-[340px] select-none"
                    style={{ aspectRatio: `${editingSticker.originalWidth || 1} / ${editingSticker.originalHeight || 1}` }}
                  >
                    {/* Imagen de fondo atenuada de referencia */}
                    <img 
                      src={editingSticker.originalUrl} 
                      alt="Referencia" 
                      className="max-w-full max-h-[340px] object-contain opacity-25" 
                      draggable={false}
                    />

                    {/* Imagen principal que se renderiza */}
                    {!cropMode && (
                      <img 
                        src={localPreviewUrl || editingSticker.previewUrl} 
                        alt="Resultado" 
                        className="absolute inset-0 w-full h-full object-contain filter drop-shadow-xl animate-fade-in" 
                        draggable={false}
                      />
                    )}

                    {/* RECUADRO DE RECORTE INTERACTIVO DRAGGABLE */}
                    {cropMode && (
                      <div 
                        className="absolute border border-cyan-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.8)] cursor-move select-none"
                        style={{
                          top: `${cropBounds.top}%`,
                          left: `${cropBounds.left}%`,
                          width: `${100 - cropBounds.left - cropBounds.right}%`,
                          height: `${100 - cropBounds.top - cropBounds.bottom}%`,
                        }}
                        onMouseDown={(e) => handleHandleMouseDown(e, 'move')}
                      >
                        {/* Guías interiores de la regla de tercios */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                          <div className="border-r border-b border-cyan-400/50"></div>
                          <div className="border-r border-b border-cyan-400/50"></div>
                          <div className="border-b border-cyan-400/50"></div>
                          <div className="border-r border-b border-cyan-400/50"></div>
                          <div className="border-r border-b border-cyan-400/50"></div>
                          <div className="border-b border-cyan-400/50"></div>
                          <div className="border-r border-cyan-400/50"></div>
                          <div className="border-r border-cyan-400/50"></div>
                          <div></div>
                        </div>

                        {/* TIRADORES DE REDIMENSIONAMIENTO (ESQUINAS) */}
                        <div 
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 rounded-sm cursor-nwse-resize border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'nw')}
                        ></div>
                        <div 
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 rounded-sm cursor-nesw-resize border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'ne')}
                        ></div>
                        <div 
                          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 rounded-sm cursor-nesw-resize border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'sw')}
                        ></div>
                        <div 
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 rounded-sm cursor-nwse-resize border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'se')}
                        ></div>

                        {/* TIRADORES LATERALES (BORDES) */}
                        <div 
                          className="absolute top-1/2 -left-1 w-2 h-4 bg-cyan-400 rounded-sm cursor-ew-resize -translate-y-1/2 border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'w')}
                        ></div>
                        <div 
                          className="absolute top-1/2 -right-1 w-2 h-4 bg-cyan-400 rounded-sm cursor-ew-resize -translate-y-1/2 border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'e')}
                        ></div>
                        <div 
                          className="absolute -top-1 left-1/2 w-4 h-2 bg-cyan-400 rounded-sm cursor-ns-resize -translate-x-1/2 border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 'n')}
                        ></div>
                        <div 
                          className="absolute -bottom-1 left-1/2 w-4 h-2 bg-cyan-400 rounded-sm cursor-ns-resize -translate-x-1/2 border border-slate-900"
                          onMouseDown={(e) => handleHandleMouseDown(e, 's')}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info de tamaño resultante recortado */}
                <div className="flex justify-between items-center text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                  <span>Tamaño Resultante de Impresión:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {calculatedCropWidthCm.toFixed(1)} x {calculatedCropHeightCm.toFixed(1)} cm
                  </span>
                </div>
              </div>

              {/* Panel de Herramientas de Edición y Parámetros */}
              <div className="w-full md:w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">
                
                {/* BLOQUE A: DATOS FÍSICOS (MEDIDAS, COPIAS, CATEGORÍA) */}
                <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
                  <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    📏 Parámetros Físicos
                  </span>

                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Nombre:</label>
                    <input 
                      type="text"
                      value={editorEffects.name}
                      onChange={(e) => setEditorEffects(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-100 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Medida Base (cm):</label>
                      <input 
                        type="number" 
                        value={editorEffects.targetSize / 10} 
                        disabled={editorEffects.sizingMode === 'exact' || editorEffects.sizingMode === 'theme-preset'}
                        onChange={(e) => setEditorEffects(prev => ({ ...prev, targetSize: (parseFloat(e.target.value) || 2) * 10 }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-center text-xs font-bold text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        min="1"
                        max="50"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Copias:</label>
                      <div className="flex items-center justify-between bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button 
                          onClick={() => setEditorEffects(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                          className="w-6 h-6 flex items-center justify-center bg-slate-950 rounded hover:text-white text-slate-400 font-bold"
                        >
                          -
                        </button>
                        <span className="font-black text-slate-100 text-xs w-6 text-center">{editorEffects.quantity}</span>
                        <button 
                          onClick={() => setEditorEffects(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                          className="w-6 h-6 flex items-center justify-center bg-slate-950 rounded hover:text-white text-slate-400 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Ajustar por:</label>
                      <select 
                        value={editorEffects.sizingMode} 
                        onChange={(e) => setEditorEffects(prev => ({ ...prev, sizingMode: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value="max">Lado mayor</option>
                        <option value="width">Ancho fijo</option>
                        <option value="height">Alto fijo</option>
                        <option value="theme-preset">Medida de Temática</option>
                        <option value="exact">Medida Personalizada Exacta</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Temática:</label>
                      <select 
                        value={editorEffects.theme} 
                        onChange={(e) => setEditorEffects(prev => ({ ...prev, theme: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 text-[11px] focus:outline-none cursor-pointer"
                      >
                        {themes.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.defaultWidth/10}x{t.defaultHeight/10}cm)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* === CAMPOS DINÁMICOS DE MEDIDA EXACTA INDEPENDIENTE === */}
                  {editorEffects.sizingMode === 'exact' && (
                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-900 animate-fade-in">
                      <div>
                        <label className="text-[9px] text-slate-400 font-semibold block mb-1">Ancho Exacto (cm):</label>
                        <input 
                          type="number" 
                          value={editorEffects.customWidth / 10} 
                          onChange={(e) => setEditorEffects(prev => ({ ...prev, customWidth: (parseFloat(e.target.value) || 2) * 10 }))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-center text-xs font-bold text-slate-100"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-semibold block mb-1">Alto Exacto (cm):</label>
                        <input 
                          type="number" 
                          value={editorEffects.customHeight / 10} 
                          onChange={(e) => setEditorEffects(prev => ({ ...prev, customHeight: (parseFloat(e.target.value) || 2) * 10 }))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-center text-xs font-bold text-slate-100"
                          step="0.1"
                        />
                      </div>
                    </div>
                  )}

                  {/* INFO DE TAMAÑO AUTO-APLICADO POR TEMÁTICA */}
                  {editorEffects.sizingMode === 'theme-preset' && (
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 text-[10px] text-violet-400 animate-fade-in font-medium">
                      💡 Forzado a la medida de la planchita: <strong>{themePresetForCalc.defaultWidth / 10} x {themePresetForCalc.defaultHeight / 10} cm</strong>
                    </div>
                  )}
                </div>

                {/* BLOQUE B: REMOCIÓN DE FONDO */}
                <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      1. Eliminar Fondo de Color
                    </span>
                    <input 
                      type="checkbox"
                      checked={editorEffects.removeBg}
                      onChange={(e) => setEditorEffects(prev => ({ ...prev, removeBg: e.target.checked }))}
                      className="rounded border-slate-800 text-emerald-500 focus:ring-0 bg-slate-950 cursor-pointer w-4 h-4"
                    />
                  </div>

                  {editorEffects.removeBg && (
                    <div className="flex flex-col gap-3 pt-2 border-t border-slate-900 animate-fade-in text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Color a eliminar:</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="color" 
                            value={editorEffects.bgTargetColor}
                            onChange={(e) => setEditorEffects(prev => ({ ...prev, bgTargetColor: e.target.value }))}
                            className="w-7 h-7 rounded border-0 cursor-pointer overflow-hidden bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={editorEffects.bgTargetColor.toUpperCase()}
                            onChange={(e) => setEditorEffects(prev => ({ ...prev, bgTargetColor: e.target.value }))}
                            className="w-16 bg-slate-900 border border-slate-800 text-center py-1 rounded text-[10px] font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Tolerancia de filtro:</span>
                          <span className="font-mono text-cyan-400">{editorEffects.bgTolerance} px</span>
                        </div>
                        <input 
                          type="range"
                          min="10"
                          max="180"
                          value={editorEffects.bgTolerance}
                          onChange={(e) => setEditorEffects(prev => ({ ...prev, bgTolerance: parseInt(e.target.value) }))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* BLOQUE C: CONFIGURACIÓN DE COLOR DTF */}
                <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
                  <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                    2. Configuración de Color DTF
                  </span>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                    <button
                      onClick={() => setEditorEffects(prev => ({ ...prev, colorMode: 'original' }))}
                      className={`py-1.5 rounded-lg transition-all ${editorEffects.colorMode === 'original' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      A todo color
                    </button>
                    <button
                      onClick={() => setEditorEffects(prev => ({ ...prev, colorMode: 'one-color' }))}
                      className={`py-1.5 rounded-lg transition-all ${editorEffects.colorMode === 'one-color' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      1 Color
                    </button>
                    <button
                      onClick={() => setEditorEffects(prev => ({ ...prev, colorMode: 'two-color' }))}
                      className={`py-1.5 rounded-lg transition-all ${editorEffects.colorMode === 'two-color' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      2 Colores
                    </button>
                  </div>

                  {editorEffects.colorMode !== 'original' && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-900 animate-fade-in text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Color Primario:</span>
                        <input 
                          type="color" 
                          value={editorEffects.primaryColor}
                          onChange={(e) => setEditorEffects(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-7 h-7 rounded border-0 cursor-pointer overflow-hidden bg-transparent"
                        />
                      </div>

                      {editorEffects.colorMode === 'two-color' && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Color Secundario:</span>
                          <input 
                            type="color" 
                            value={editorEffects.secondaryColor}
                            onChange={(e) => setEditorEffects(prev => ({ ...prev, secondaryColor: e.target.value }))}
                            className="w-7 h-7 rounded border-0 cursor-pointer overflow-hidden bg-transparent"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* BLOQUE D: BORDE DE STICKER */}
                <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
                  <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    3. Borde de Sticker
                  </span>

                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Grosor del borde:</span>
                        <span className="font-mono text-cyan-400">{editorEffects.strokeWidth} px</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="25"
                        value={editorEffects.strokeWidth}
                        onChange={(e) => setEditorEffects(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>

                    {editorEffects.strokeWidth > 0 && (
                      <div className="flex items-center justify-between pt-1 animate-fade-in">
                        <span className="text-slate-400">Color del borde:</span>
                        <input 
                          type="color" 
                          value={editorEffects.strokeColor}
                          onChange={(e) => setEditorEffects(prev => ({ ...prev, strokeColor: e.target.value }))}
                          className="w-7 h-7 rounded border-0 cursor-pointer overflow-hidden bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Barra de Acciones del Editor */}
            <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex justify-between gap-3 shrink-0">
              <button
                onClick={() => setEditingSticker(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-400 transition-colors cursor-pointer"
              >
                Cancelar y Descartar
              </button>

              <div className="flex gap-2">
                <button 
                  onClick={() => downloadSingleSticker(editingSticker)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  📥 Descargar PNG
                </button>
                <button
                  onClick={saveEditorChanges}
                  className="px-6 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg transition-all transform active:scale-95 cursor-pointer"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}