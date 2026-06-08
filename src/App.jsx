import React, { useState, useEffect, useRef } from 'react';

// === CONFIGURACIÓN INICIAL DE PLANTILLAS PEQUEÑAS (SUB-TEMPLATES) ===
const INITIAL_PLANCHAS = [
  { id: 'p1', name: 'Plancha Argentina (14x20 cm)', width: 140, height: 200, spacing: 3, safeMargin: 5, color: '#3B82F6' },
  { id: 'p2', name: 'Logos Club (12x10 cm)', width: 120, height: 100, spacing: 3, safeMargin: 5, color: '#8B5CF6' },
  { id: 'p3', name: 'Etiquetas Regalo (15x15 cm)', width: 150, height: 150, spacing: 3, safeMargin: 5, color: '#10B981' }
];

// Helper para convertir HEX a RGB en la generación del PDF
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// === FUNCIÓN DE RECORTE AUTOMÁTICO DE TRANSPARENCIAS (AUTOCROP) ===
function trimTransparentCanvas(canvas, alphaThreshold = 10) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let foundPixel = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        foundPixel = true;
      }
    }
  }

  if (!foundPixel) return canvas; 

  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(width - 1, maxX + 1);
  maxY = Math.min(height - 1, maxY + 1);

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  const croppedCtx = croppedCanvas.getContext('2d');

  croppedCtx.drawImage(canvas, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
  return croppedCanvas;
}

// Algoritmo para empaquetar stickers individuales dentro de un bloque chico (Paso 1)
const packStickersSingleBlock = (items, totalWidth, totalHeight, spacing, safe) => {
  const printableWidth = totalWidth - (safe * 2);
  const printableHeight = totalHeight - (safe * 2);

  const sortedItems = [...items].sort((a, b) => b.height - a.height);
  const packedItems = [];
  const shelves = [];

  sortedItems.forEach(item => {
    let placed = false;

    for (const shelf of shelves) {
      if (shelf.currentX + item.width <= printableWidth && item.height <= shelf.height * 1.35) {
        packedItems.push({
          ...item,
          x: shelf.currentX + safe,
          y: shelf.y + safe
        });
        shelf.currentX += item.width + spacing;
        if (item.height > shelf.height) {
          shelf.height = item.height;
        }
        placed = true;
        break;
      }
    }

    if (!placed) {
      const lastShelfY = shelves.length > 0
        ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height + spacing
        : 0;

      if (lastShelfY + item.height <= printableHeight) {
        const newShelf = {
          y: lastShelfY,
          height: item.height,
          currentX: item.width + spacing
        };
        shelves.push(newShelf);
        packedItems.push({
          ...item,
          x: safe,
          y: lastShelfY + safe
        });
        placed = true;
      }
    }
  });

  return packedItems;
};

// Algoritmo para acomodar las planchas chicas enteras dentro del Rollo Master (Paso 2)
const packPlanchasOntoMasterRoll = (planchasToPack, totalWidth, totalHeight, spacing, safe) => {
  const printableWidth = totalWidth - (safe * 2);
  const printableHeight = totalHeight - (safe * 2);

  const sortedPlanchas = [...planchasToPack].sort((a, b) => b.height - a.height);
  const sheets = [];
  
  const createNewSheet = (sheetNum) => ({
    id: sheetNum,
    width: totalWidth,
    height: totalHeight,
    safeMargin: safe,
    spacing: spacing,
    packedPlanchas: [],
    shelves: [],
    areaUtilized: 0
  });

  sheets.push(createNewSheet(1));

  sortedPlanchas.forEach(plancha => {
    let placed = false;

    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        if (shelf.currentX + plancha.width <= printableWidth && plancha.height <= shelf.height * 1.35) {
          sheet.packedPlanchas.push({
            ...plancha,
            x: shelf.currentX + safe,
            y: shelf.y + safe
          });
          shelf.currentX += plancha.width + spacing;
          if (plancha.height > shelf.height) {
            shelf.height = plancha.height;
          }
          sheet.areaUtilized += plancha.width * plancha.height;
          placed = true;
          break;
        }
      }
      if (placed) break;

      const lastShelfY = sheet.shelves.length > 0
        ? sheet.shelves[sheet.shelves.length - 1].y + sheet.shelves[sheet.shelves.length - 1].height + spacing
        : 0;

      if (lastShelfY + plancha.height <= printableHeight) {
        const newShelf = {
          y: lastShelfY,
          height: plancha.height,
          currentX: plancha.width + spacing
        };
        sheet.shelves.push(newShelf);
        sheet.packedPlanchas.push({
          ...plancha,
          x: safe,
          y: lastShelfY + safe
        });
        sheet.areaUtilized += plancha.width * plancha.height;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const newSheet = createNewSheet(sheets.length + 1);
      const firstShelf = {
        y: 0,
        height: plancha.height,
        currentX: plancha.width + spacing
      };
      newSheet.shelves.push(firstShelf);
      newSheet.packedPlanchas.push({
        ...plancha,
        x: safe,
        y: safe
      });
      newSheet.areaUtilized += plancha.width * plancha.height;
      sheets.push(newSheet);
    }
  });

  sheets.forEach(sheet => {
    const printableArea = printableWidth * printableHeight;
    sheet.utilizationPercentage = Math.min(100, Math.round((sheet.areaUtilized / printableArea) * 100));
  });

  return sheets;
};

export default function App() {
  const [masterWidth, setMasterWidth] = useState(580);
  const [masterHeight, setMasterHeight] = useState(1000);
  
  const [planchas, setPlanchas] = useState(INITIAL_PLANCHAS);
  const [selectedPlanchaForUpload, setSelectedPlanchaForUpload] = useState('p1');
  
  const [newPlanchaName, setNewPlanchaName] = useState('');
  const [newPlanchaWidth, setNewPlanchaWidth] = useState(14);
  const [newPlanchaHeight, setNewPlanchaHeight] = useState(20);
  const [newPlanchaSpacing, setNewPlanchaSpacing] = useState(3);
  const [newPlanchaSafeMargin, setNewPlanchaSafeMargin] = useState(5);
  const [newPlanchaColor, setNewPlanchaColor] = useState('#EC4899');

  const [images, setImages] = useState([]);
  
  const [pricePerMeter, setPricePerMeter] = useState(12000); 
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [showCutMarks, setShowCutMarks] = useState(true);
  
  const [isConfigOpen, setIsConfigOpen] = useState(false); 
  const [isPlanchasManagerOpen, setIsPlanchasManagerOpen] = useState(true);
  const [isImagesListOpen, setIsImagesListOpen] = useState(true);

  const [packedSheets, setPackedSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(65); 
  const [isRotated, setIsRotated] = useState(true); 
  const [hoveredSticker, setHoveredSticker] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Estados del Editor de Stickers (Quitar fondo y Bordes)
  const [editingImage, setEditingImage] = useState(null); 
  const [activeTab, setActiveTab] = useState('bg'); 
  const [bgMode, setBgMode] = useState('contiguous');
  const [clickCoords, setClickCoords] = useState({ x: 0, y: 0 }); 
  const [isBgRemovalActive, setIsBgRemovalActive] = useState(false);
  const [bgTolerance, setBgTolerance] = useState(15); 
  const [haloCleanup, setHaloCleanup] = useState(1); 
  const [targetBgColor, setTargetBgColor] = useState({ r: 255, g: 255, b: 255 });
  const [strokeEnabled, setStrokeEnabled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2); 
  const [strokeColor, setStrokeColor] = useState('#ffffff'); 
  const [editedAspectRatio, setEditedAspectRatio] = useState(1);
  const [removalPreviewUrl, setRemovalPreviewUrl] = useState('');
  const [originalBackupUrl, setOriginalBackupUrl] = useState(''); 
  
  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);

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

  useEffect(() => {
    recalculateLayouts();
  }, [images, planchas, masterWidth, masterHeight]);

  useEffect(() => {
    if (editingImage && originalBackupUrl) {
      applyImageEdits();
    }
  }, [editingImage, bgTolerance, targetBgColor, bgMode, clickCoords, originalBackupUrl, isBgRemovalActive, strokeEnabled, strokeWidth, strokeColor, haloCleanup]);

  const handleAddPlancha = (e) => {
    e.preventDefault();
    if (!newPlanchaName.trim()) return;
    const planchaId = 'plancha_' + Math.random().toString(36).substr(2, 9);
    const newPlancha = {
      id: planchaId,
      name: newPlanchaName.trim(),
      width: (parseInt(newPlanchaWidth) || 14) * 10,
      height: (parseInt(newPlanchaHeight) || 20) * 10,
      spacing: parseInt(newPlanchaSpacing) || 3,
      safeMargin: parseInt(newPlanchaSafeMargin) || 5,
      color: newPlanchaColor
    };
    setPlanchas(prev => [...prev, newPlancha]);
    setSelectedPlanchaForUpload(planchaId);
    setNewPlanchaName('');
  };

  const handleRemovePlancha = (id) => {
    if (planchas.length <= 1) return;
    setPlanchas(prev => prev.filter(p => p.id !== id));
    const firstRemaining = planchas.find(p => p.id !== id);
    if (firstRemaining) {
      setImages(prev => prev.map(img => img.planchaId === id ? { ...img, planchaId: firstRemaining.id } : img));
      setSelectedPlanchaForUpload(firstRemaining.id);
    }
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
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);

          const trimmedCanvas = trimTransparentCanvas(tempCanvas, 5);
          const trimmedUrl = trimmedCanvas.toDataURL('image/png');
          const aspectRatio = trimmedCanvas.width / trimmedCanvas.height;

          const newImg = {
            id: 'img_' + Math.random().toString(36).substr(2, 9),
            name: file.name.split('.')[0],
            previewUrl: trimmedUrl,
            originalBackupUrl: event.target.result, 
            aspectRatio: aspectRatio,
            originalWidth: trimmedCanvas.width,
            originalHeight: trimmedCanvas.height,
            planchaId: selectedPlanchaForUpload, 
            quantity: 1, 
            sizingMode: 'max', 
            targetSize: 40, 
            isBgRemovalActive: false,
            bgTolerance: 15,
            haloCleanup: 1, 
            targetBgColor: { r: 255, g: 255, b: 255 },
            bgMode: 'contiguous',
            strokeEnabled: false,
            strokeWidth: 2,
            strokeColor: '#ffffff'
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

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const updateImageProperty = (id, property, value) => {
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        return { ...img, [property]: value };
      }
      return img;
    }));
  };

  const loadDemoData = () => {
    const demoItems = [
      { name: 'Sol Argentina (Padding)', planchaId: 'p1', svg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="160" fill="none"/><path d="M80,30 L85,55 L110,60 L85,65 L80,90 L75,65 L50,60 L75,55 Z" fill="#F59E0B" stroke="#000" stroke-width="2"/><circle cx="80" cy="60" r="10" fill="#EC4899"/></svg>` },
      { name: 'Escudo AFA', planchaId: 'p1', svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#ffffff"/><path d="M15,20 L85,20 L75,70 L50,90 L25,70 Z" fill="#F59E0B" stroke="#000" stroke-width="3"/><path d="M30,35 L70,35 M30,50 L70,50" fill="none" stroke="#fff" stroke-width="4"/></svg>` },
      { name: 'Cyber Cat', planchaId: 'p2', svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#ffffff"/><path d="M15,30 L30,50 L70,50 L85,30 L75,75 L25,75 Z" fill="#10B981" stroke="#000" stroke-width="3"/><circle cx="35" cy="58" r="6" fill="#fff"/><circle cx="65" cy="58" r="6" fill="#fff"/></svg>` }
    ];

    const loadDemo = async () => {
      const parsedImages = demoItems.map((item, idx) => {
        const blob = new Blob([item.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        return {
          id: 'demo_' + idx + '_' + Math.random().toString(36).substr(2, 5),
          name: item.name,
          previewUrl: url,
          originalBackupUrl: url,
          aspectRatio: 1,
          originalWidth: 500,
          originalHeight: 500,
          planchaId: item.planchaId,
          quantity: 1,
          sizingMode: 'max',
          targetSize: 40,
          isBgRemovalActive: false,
          bgTolerance: 15,
          haloCleanup: 1,
          targetBgColor: { r: 255, g: 255, b: 255 },
          bgMode: 'contiguous',
          strokeEnabled: false,
          strokeWidth: 2,
          strokeColor: '#ffffff'
        };
      });
      setImages(prev => [...prev, ...parsedImages]);
    };

    loadDemo();
  };

  const recalculateLayouts = () => {
    let compiledPlanchas = [];

    planchas.forEach(plancha => {
      const planchaImages = images.filter(img => img.planchaId === plancha.id);
      if (planchaImages.length === 0) return;

      const itemsToPack = [];
      planchaImages.forEach(img => {
        const qty = parseInt(img.quantity) || 1;
        
        let widthMm = 40;
        let heightMm = 40;
        const aspect = img.aspectRatio || 1;
        const sizeValue = parseFloat(img.targetSize) || 40;

        if (img.sizingMode === 'max') {
          if (aspect >= 1) {
            widthMm = sizeValue;
            heightMm = sizeValue / aspect;
          } else {
            heightMm = sizeValue;
            widthMm = sizeValue * aspect;
          }
        }

        const maxPrintableWidth = plancha.width - (plancha.safeMargin * 2);
        const maxPrintableHeight = plancha.height - (plancha.safeMargin * 2);
        if (widthMm > maxPrintableWidth) {
          widthMm = maxPrintableWidth;
          heightMm = widthMm / aspect;
        }
        if (heightMm > maxPrintableHeight) {
          heightMm = maxPrintableHeight;
          widthMm = heightMm * aspect;
        }

        for (let i = 0; i < qty; i++) {
          itemsToPack.push({
            id: `${img.id}_copy_${i}`,
            parentId: img.id,
            name: img.name,
            planchaId: plancha.id,
            imageSrc: img.previewUrl,
            width: widthMm,
            height: heightMm,
            aspectRatio: aspect
          });
        }
      });

      if (itemsToPack.length === 0) return;

      const packedStickers = packStickersSingleBlock(itemsToPack, plancha.width, plancha.height, plancha.spacing, plancha.safeMargin);
      
      if (packedStickers.length > 0) {
        compiledPlanchas.push({
          id: plancha.id,
          name: plancha.name,
          width: plancha.width,
          height: plancha.height,
          color: plancha.color,
          packedStickers: packedStickers
        });
      }
    });

    if (compiledPlanchas.length === 0) {
      setPackedSheets([]);
      return;
    }

    const masterRollSheets = packPlanchasOntoMasterRoll(compiledPlanchas, masterWidth, masterHeight, 8, 10); 
    
    masterRollSheets.forEach(sheet => {
      sheet.packedPlanchas.forEach(packedPlancha => {
        packedPlancha.packedStickers.forEach(sticker => {
          sticker.globalX = packedPlancha.x + sticker.x;
          sticker.globalY = packedPlancha.y + sticker.y;
        });
      });
    });

    setPackedSheets(masterRollSheets);
    if (activeSheetIndex >= masterRollSheets.length) {
      setActiveSheetIndex(0);
    }
  };

  const generatePDF = async () => {
    if (packedSheets.length === 0) return;
    setIsGeneratingPdf(true);
    setPdfProgress('Iniciando PDF...');

    try {
      const { jsPDF } = window.jspdf;

      const firstSheet = packedSheets[0];
      const doc = new jsPDF({
        orientation: firstSheet.width > firstSheet.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [firstSheet.width, firstSheet.height]
      });

      for (let sIdx = 0; sIdx < packedSheets.length; sIdx++) {
        const sheet = packedSheets[sIdx];
        setPdfProgress(`Procesando Rollo Master ${sIdx + 1} de ${packedSheets.length}...`);

        if (sIdx > 0) {
          doc.addPage([sheet.width, sheet.height], sheet.width > sheet.height ? 'landscape' : 'portrait');
        }

        if (showCutMarks) {
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.rect(sheet.safeMargin, sheet.safeMargin, sheet.width - (sheet.safeMargin * 2), sheet.height - (sheet.safeMargin * 2), 'S');
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`DTF UV MASTER ROLL | Plancha ${sIdx + 1}/${packedSheets.length}`, sheet.safeMargin, sheet.safeMargin - 3);
          doc.text(`Medida Real: ${sheet.width / 10}x${sheet.height / 10} cm`, sheet.width - sheet.safeMargin - 45, sheet.safeMargin - 3);
        }

        sheet.packedPlanchas.forEach(plancha => {
          if (showCutMarks) {
            const rgb = hexToRgb(plancha.color) || { r: 150, g: 150, b: 150 };
            doc.setDrawColor(rgb.r, rgb.g, rgb.b);
            doc.setLineWidth(0.2);
            doc.setLineDashPattern([2, 2], 0);
            doc.rect(plancha.x, plancha.y, plancha.width, plancha.height, 'S');
            
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(rgb.r, rgb.g, rgb.b);
            doc.text(`${plancha.name} (${plancha.width/10}x${plancha.height/10} cm)`, plancha.x + 2, plancha.y + 4);
          }

          plancha.packedStickers.forEach(sticker => {
            try {
              doc.addImage(
                sticker.imageSrc, 
                'PNG', 
                sticker.globalX, 
                sticker.globalY, 
                sticker.width, 
                sticker.height, 
                undefined, 
                'FAST'
              );
            } catch (e) {
              console.error("Error al incrustar sticker en PDF: ", e);
            }
          });
        });
      }

      setPdfProgress('Generando descarga...');
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `Pliego_DTF_UV_${masterWidth/10}x${masterHeight/10}cm.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      document.body.removeChild(downloadLink);
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 150);

    } catch (error) {
      console.error("Error generando PDF: ", error);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  const openBackgroundRemovalModal = (img) => {
    setEditingImage(img);
    setOriginalBackupUrl(img.originalBackupUrl || img.previewUrl);
    setBgTolerance(img.bgTolerance !== undefined ? img.bgTolerance : 15);
    setHaloCleanup(img.haloCleanup !== undefined ? img.haloCleanup : 1);
    setTargetBgColor(img.targetBgColor || { r: 255, g: 255, b: 255 });
    setBgMode(img.bgMode || 'contiguous'); 
    setClickCoords({ x: 0, y: 0 }); 
    setIsBgRemovalActive(img.isBgRemovalActive || false);
    setStrokeEnabled(img.strokeEnabled || false);
    setStrokeWidth(img.strokeWidth || 2);
    setStrokeColor(img.strokeColor || '#ffffff');
    setRemovalPreviewUrl(img.previewUrl);
    setEditedAspectRatio(img.aspectRatio || 1);
    setActiveTab('bg');
  };

  const applyImageEdits = () => {
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const procCanvas = document.createElement('canvas');
      procCanvas.width = tempImg.naturalWidth || tempImg.width;
      procCanvas.height = tempImg.naturalHeight || tempImg.height;
      const procCtx = procCanvas.getContext('2d');
      procCtx.drawImage(tempImg, 0, 0);
      
      const width = procCanvas.width;
      const height = procCanvas.height;

      if (isBgRemovalActive) {
        const imgData = procCtx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const { r: targetR, g: targetG, b: targetB } = targetBgColor;
        
        const threshold = (bgTolerance / 100) * 442;
        const removedMask = new Uint8Array(width * height);

        if (bgMode === 'contiguous') {
          const visited = new Uint8Array(width * height);
          const queue = new Int32Array(width * height); 
          let head = 0;
          let tail = 0;

          const startX = Math.floor(clickCoords.x);
          const startY = Math.floor(clickCoords.y);

          if (startX >= 0 && startX < width && startY >= 0 && startY < height) {
            queue[tail++] = startY * width + startX;
            visited[startY * width + startX] = 1;
          }

          while (head < tail) {
            const idx = queue[head++];
            const currX = idx % width;
            const currY = Math.floor(idx / width);
            
            removedMask[idx] = 1;

            const neighbors = [
              [currX + 1, currY],
              [currX - 1, currY],
              [currX, currY + 1],
              [currX, currY - 1]
            ];

            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (!visited[nIdx]) {
                  visited[nIdx] = 1;
                  const ndataIdx = nIdx * 4;
                  const nr = data[ndataIdx];
                  const ng = data[ndataIdx + 1];
                  const nb = data[ndataIdx + 2];
                  const na = data[ndataIdx + 3];

                  if (na > 0) { 
                    const dist = Math.sqrt(
                      Math.pow(nr - targetR, 2) +
                      Math.pow(ng - targetG, 2) +
                      Math.pow(nb - targetB, 2)
                    );
                    if (dist < threshold) {
                      queue[tail++] = nIdx;
                    }
                  }
                }
              }
            }
          }
        } else {
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3];
            
            if (a === 0) continue;
            
            const distance = Math.sqrt(
              Math.pow(r - targetR, 2) +
              Math.pow(g - targetG, 2) +
              Math.pow(b - targetB, 2)
            );
            
            if (distance < threshold) {
              removedMask[i / 4] = 1;
            }
          }
        }

        for (let i = 0; i < width * height; i++) {
          if (removedMask[i] === 1) {
            data[i * 4 + 3] = 0;
          }
        }

        if (haloCleanup > 0) {
          const originalAlpha = new Uint8Array(width * height);
          for (let i = 0; i < width * height; i++) {
            originalAlpha[i] = data[i * 4 + 3];
          }

          const radius = Math.min(5, haloCleanup);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              if (originalAlpha[idx] === 0) continue;

              let minAlphaInNeighborhood = 255;

              for (let dy = -radius; dy <= radius; dy++) {
                const ny = y + dy;
                if (ny >= 0 && ny < height) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    if (dx*dx + dy*dy <= radius*radius) {
                      const nx = x + dx;
                      if (nx >= 0 && nx < width) {
                        const nIdx = ny * width + nx;
                        if (originalAlpha[nIdx] < minAlphaInNeighborhood) {
                          minAlphaInNeighborhood = originalAlpha[nIdx];
                        }
                      }
                    }
                  }
                }
              }

              data[idx * 4 + 3] = minAlphaInNeighborhood;
            }
          }
        }

        procCtx.putImageData(imgData, 0, 0);
      }
      
      let strokePx = 0;
      if (strokeEnabled && strokeWidth > 0) {
        const mmToPxRatio = procCanvas.width / (editingImage.targetSize || 40);
        strokePx = Math.round(strokeWidth * mmToPxRatio);
      }
      
      canvas.width = procCanvas.width + (strokePx * 2);
      canvas.height = procCanvas.height + (strokePx * 2);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerCanvas = document.createElement('canvas');
      centerCanvas.width = canvas.width;
      centerCanvas.height = canvas.height;
      const centerCtx = centerCanvas.getContext('2d');
      centerCtx.drawImage(procCanvas, strokePx, strokePx);
      
      if (strokeEnabled && strokePx > 0) {
        const silhouetteCanvas = document.createElement('canvas');
        silhouetteCanvas.width = canvas.width;
        silhouetteCanvas.height = canvas.height;
        const silCtx = silhouetteCanvas.getContext('2d');
        silCtx.drawImage(centerCanvas, 0, 0);
        silCtx.globalCompositeOperation = 'source-in';
        silCtx.fillStyle = strokeColor;
        silCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const steps = 36;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const dx = Math.cos(angle) * strokePx;
          const dy = Math.sin(angle) * strokePx;
          ctx.drawImage(silhouetteCanvas, dx, dy);
        }
      }
      
      ctx.drawImage(centerCanvas, 0, 0);
      
      const resultUrl = canvas.toDataURL('image/png');
      setRemovalPreviewUrl(resultUrl);
      setEditedAspectRatio(canvas.width / canvas.height);
    };
    tempImg.src = originalBackupUrl;
  };

  const handleCanvasClick = (e) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    
    const clickedImg = e.currentTarget;
    const rect = clickedImg.getBoundingClientRect();
    
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    setTargetBgColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setClickCoords({ x, y });
    setIsBgRemovalActive(true);
  };

  const saveTransparentImage = () => {
    if (!editingImage) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = previewCanvasRef.current.width;
    finalCanvas.height = previewCanvasRef.current.height;
    const finalCtx = finalCanvas.getContext('2d');

    const tempImg = new Image();
    tempImg.onload = () => {
      finalCtx.drawImage(tempImg, 0, 0);
      
      const trimmed = trimTransparentCanvas(finalCanvas, 5);
      const croppedUrl = trimmed.toDataURL('image/png');
      const newAspect = trimmed.width / trimmed.height;

      setImages(prev => prev.map(img => {
        if (img.id === editingImage.id) {
          return {
            ...img,
            previewUrl: croppedUrl,
            aspectRatio: newAspect,
            isBgRemovalActive,
            bgTolerance,
            haloCleanup,
            targetBgColor,
            bgMode,
            strokeEnabled,
            strokeWidth,
            strokeColor
          };
        }
        return img;
      }));
      setEditingImage(null);
    };
    tempImg.src = removalPreviewUrl;
  };

  const restoreOriginalImage = () => {
    if (!editingImage) return;
    
    const tempImg = new Image();
    tempImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempImg.width;
      tempCanvas.height = tempImg.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(tempImg, 0, 0);

      const trimmed = trimTransparentCanvas(tempCanvas, 5);
      const trimmedUrl = trimmed.toDataURL('image/png');
      const newAspect = trimmed.width / trimmed.height;

      setImages(prev => prev.map(img => {
        if (img.id === editingImage.id) {
          return {
            ...img,
            previewUrl: trimmedUrl,
            aspectRatio: newAspect,
            isBgRemovalActive: false,
            strokeEnabled: false
          };
        }
        return img;
      }));
      setEditingImage(null);
    };
    tempImg.src = originalBackupUrl;
  };

  const activeSheet = packedSheets[activeSheetIndex];
  const activePlanchaWidth = activeSheet ? activeSheet.width : 580;
  const activePlanchaHeight = activeSheet ? activeSheet.height : 1000;

  const totalMetersUsed = packedSheets.reduce((acc, sheet) => acc + (sheet.height / 1000), 0).toFixed(2);
  const totalCostEstimate = (parseFloat(totalMetersUsed) * pricePerMeter).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const scale = (zoomLevel / 100) * 0.85;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex flex-col">
      
      {/* HEADER DE LA APP */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-tr from-violet-600 to-cyan-500 p-2.5 rounded-xl shadow-inner animate-pulse">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-linear-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Smart DTF UV Pro Layout
            </h1>
            <p className="text-xs text-slate-400 font-medium">Anidamiento Jerárquico de Planillas en Bobina de Impresión</p>
          </div>
        </div>
        
        {/* Métricas Generales */}
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Pliegos Rollo Master: <strong>{packedSheets.length}</strong></span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400"></span>
            <span>Uso de Película: <strong>{totalMetersUsed} m</strong></span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Presupuesto: <strong>{currencySymbol}{totalCostEstimate}</strong></span>
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* PANEL IZQUIERDO DE ACCIONES CON SECCIONES COLAPSABLES */}
        <aside className="w-full lg:w-105 bg-slate-950 border-r border-slate-800 flex flex-col overflow-y-auto max-h-[calc(100vh-80px)] shrink-0">
          
          <div className="p-4 flex flex-col gap-4">

            {/* SECCIÓN COLAPSABLE 1: CONFIGURACIÓN GLOBAL */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all">
              <button 
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="w-full px-4 py-3 bg-slate-900/80 hover:bg-slate-900 flex justify-between items-center text-left text-xs font-bold uppercase tracking-wider text-slate-300 focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                  1. Medidas del Rollo Master y Costos
                </span>
                <span className={`text-slate-500 font-bold transform transition-transform duration-250 ${isConfigOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {isConfigOpen && (
                <div className="p-4 border-t border-slate-800/60 flex flex-col gap-3 text-xs bg-slate-900/20">
                  
                  <div>
                    <span className="text-slate-400 block mb-1.5 font-bold">Tamaño del Rollo Maestro (Bobina)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setMasterHeight(1000)}
                        className={`py-1.5 px-3 rounded-lg border font-bold transition-all text-xs ${
                          masterHeight === 1000 
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md' 
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        58 cm x 1 Metro
                      </button>
                      <button 
                        onClick={() => setMasterHeight(500)}
                        className={`py-1.5 px-3 rounded-lg border font-bold transition-all text-xs ${
                          masterHeight === 500 
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md' 
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        58 cm x 50 cm
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <label className="text-slate-400 block mb-1">Precio Metro Film</label>
                      <input 
                        type="number" 
                        value={pricePerMeter} 
                        onChange={(e) => setPricePerMeter(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Símbolo Divisa</label>
                      <input 
                        type="text" 
                        value={currencySymbol} 
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:ring-1 focus:ring-cyan-500 text-center focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox" 
                      id="globalCutMarks"
                      checked={showCutMarks}
                      onChange={(e) => setShowCutMarks(e.target.checked)}
                      className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="globalCutMarks" className="text-slate-400 font-medium cursor-pointer">Mostrar guías y contornos de corte en el PDF</label>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN COLAPSABLE 2: GESTOR DE PLANTILLAS INTERNAS CHICAS */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all">
              <button 
                onClick={() => setIsPlanchasManagerOpen(!isPlanchasManagerOpen)}
                className="w-full px-4 py-3 bg-slate-900/80 hover:bg-slate-900 flex justify-between items-center text-left text-xs font-bold uppercase tracking-wider text-slate-300 focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 17v-4h6v4"/></svg>
                  2. Configuración de Plantillas chicas (Clientes)
                </span>
                <span className={`text-slate-500 font-bold transform transition-transform duration-250 ${isPlanchasManagerOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isPlanchasManagerOpen && (
                <div className="p-4 border-t border-slate-800/60 bg-slate-900/20 flex flex-col gap-4">
                  
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {planchas.map(plancha => (
                      <div 
                        key={plancha.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: plancha.color }}></span>
                          <div className="text-xs min-w-0">
                            <h4 className="font-bold text-slate-200 truncate">{plancha.name}</h4>
                            <p className="text-[10px] text-slate-500">
                              Medida: {plancha.width / 10} x {plancha.height / 10} cm | separación {plancha.spacing} mm
                            </p>
                          </div>
                        </div>
                        {planchas.length > 1 && (
                          <button 
                            onClick={() => handleRemovePlancha(plancha.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-bold px-1.5 py-0.5 rounded focus:outline-none"
                            title="Eliminar esta plantilla"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddPlancha} className="border-t border-slate-800/60 pt-3 flex flex-col gap-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Crear nueva plantilla interna</span>
                    
                    <input 
                      type="text" 
                      placeholder="Nombre (ej: Cliente Pedro, Planilla 14x20)" 
                      value={newPlanchaName}
                      onChange={(e) => setNewPlanchaName(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-slate-500 text-[10px] block mb-1">Ancho Plantilla (cm)</label>
                        <input 
                          type="number"
                          value={newPlanchaWidth}
                          onChange={(e) => setNewPlanchaWidth(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200"
                          min="5"
                          max="58"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] block mb-1">Alto Plantilla (cm)</label>
                        <input 
                          type="number"
                          value={newPlanchaHeight}
                          onChange={(e) => setNewPlanchaHeight(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200"
                          min="5"
                          max="95"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-slate-500 text-[10px] block mb-1">Espaciado Stickers (mm)</label>
                        <input 
                          type="number"
                          value={newPlanchaSpacing}
                          onChange={(e) => setNewPlanchaSpacing(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] block mb-1">Margen Seguro (mm)</label>
                        <input 
                          type="number"
                          value={newPlanchaSafeMargin}
                          onChange={(e) => setNewPlanchaSafeMargin(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="text-slate-500 text-[10px] block mb-1">Color Referencia</label>
                      <div className="flex gap-1.5 items-center">
                        <input 
                          type="color" 
                          value={newPlanchaColor}
                          onChange={(e) => setNewPlanchaColor(e.target.value)}
                          className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer overflow-hidden"
                        />
                        <button 
                          type="submit"
                          className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-extrabold rounded-lg text-xs focus:outline-none"
                        >
                          + Crear Plantilla
                        </button>
                      </div>
                    </div>

                  </form>
                </div>
              )}
            </div>

            {/* SECCIÓN COLAPSABLE 3: SUBIDA DE IMÁGENES */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all">
              <div className="px-4 py-3 bg-slate-900/80 flex justify-between items-center text-left text-xs font-bold uppercase tracking-wider text-slate-300">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  3. Subir Imágenes
                </span>
                <button 
                  onClick={loadDemoData}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer bg-transparent border-none focus:outline-none"
                >
                  💡 Cargar Demo
                </button>
              </div>

              <div className="p-4 border-t border-slate-800/60 flex flex-col gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] font-bold block mb-1">Destinar stickers subidos a:</label>
                  <select 
                    value={selectedPlanchaForUpload}
                    onChange={(e) => setSelectedPlanchaForUpload(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 cursor-pointer focus:outline-none"
                  >
                    {planchas.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.width/10}x{p.height/10} cm)</option>
                    ))}
                  </select>
                </div>

                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-cyan-400 bg-cyan-950/20 text-cyan-200' 
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  <svg className={`w-8 h-8 ${isDragging ? 'text-cyan-400 animate-bounce' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                  </svg>
                  <div className="text-xs font-semibold">Arrastra tus archivos de imagen aquí</div>
                  <p className="text-[10px] text-slate-500">Soporta PNG, JPG y SVG</p>
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
            </div>

            {/* SECCIÓN COLAPSABLE 4: LISTADO DE IMÁGENES SUBIDAS */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all">
              <button 
                onClick={() => setIsImagesListOpen(!isImagesListOpen)}
                className="w-full px-4 py-3 bg-slate-900/80 hover:bg-slate-900 flex justify-between items-center text-left text-xs font-bold uppercase tracking-wider text-slate-300 focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                  Stickers Cargados ({images.length})
                </span>
                <span className={`text-slate-500 font-bold transform transition-transform duration-250 ${isImagesListOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isImagesListOpen && (
                <div className="p-3 border-t border-slate-800/60 bg-slate-900/10 flex flex-col gap-2 max-h-87.5 overflow-y-auto">
                  {images.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-6 italic">No hay imágenes. Sube tus diseños y asígnalos a tu plantilla chica.</div>
                  ) : (
                    images.map((img) => {
                      const currentPlancha = planchas.find(p => p.id === img.planchaId) || { name: 'Sin Asignar', color: '#6B7280' };
                      return (
                        <div 
                          key={img.id}
                          className="bg-slate-950 border border-slate-850 rounded-xl p-2.5 flex gap-2.5 relative hover:border-slate-750 transition-all"
                        >
                          <div className="w-12 h-12 bg-slate-900 rounded-lg p-0.5 flex items-center justify-center border border-slate-800 shrink-0 relative overflow-hidden checkboard-pattern">
                            <img src={img.previewUrl} alt={img.name} className="max-w-full max-h-full object-contain" />
                            <span 
                              className="absolute bottom-0 left-0 right-0 h-1" 
                              style={{ backgroundColor: currentPlancha.color }}
                            ></span>
                          </div>

                          <div className="flex-1 flex flex-col gap-1 min-w-0 text-xs">
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="font-bold text-slate-200 truncate pr-4 text-[11px]">{img.name}</h4>
                              <button 
                                onClick={() => removeImage(img.id)}
                                className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors focus:outline-none"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-slate-500">Plantilla:</span>
                              <select 
                                value={img.planchaId} 
                                onChange={(e) => updateImageProperty(img.id, 'planchaId', e.target.value)}
                                className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none p-0 cursor-pointer text-[10px]"
                              >
                                {planchas.map(p => (
                                  <option key={p.id} value={p.id} className="bg-slate-900">{p.name} ({p.width/10}x{p.height/10} cm)</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1.5 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                                <button 
                                  onClick={() => updateImageProperty(img.id, 'quantity', Math.max(1, (img.quantity || 1) - 1))}
                                  className="text-slate-400 hover:text-slate-200 font-bold px-1 text-[11px]"
                                >
                                  -
                                </button>
                                <span className="font-bold min-w-4 text-center text-slate-100 text-[11px]">{img.quantity}</span>
                                <button 
                                  onClick={() => updateImageProperty(img.id, 'quantity', (img.quantity || 1) + 1)}
                                  className="text-slate-400 hover:text-slate-200 font-bold px-1 text-[11px]"
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                <input 
                                  type="number" 
                                  value={img.targetSize ? img.targetSize / 10 : 4} 
                                  onChange={(e) => updateImageProperty(img.id, 'targetSize', (parseFloat(e.target.value) || 2) * 10)}
                                  className="w-10 bg-slate-900 border border-slate-850 rounded px-1 py-0.5 text-center text-[11px] text-slate-100 focus:outline-none"
                                  min="1"
                                  max="50"
                                  step="0.5"
                                />
                                <span className="text-[10px] text-slate-500">cm</span>
                              </div>

                              <button
                                onClick={() => openBackgroundRemovalModal(img)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-350 font-bold flex items-center gap-0.5 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40 transition-colors focus:outline-none"
                              >
                                🎨 Editar
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* ÁREA DE PREVIEW Y PLANCHAS GENERAL */}
        <main className="flex-1 bg-slate-900 p-6 flex flex-col gap-4 overflow-hidden relative">
          
          {/* BARRA DE ACCIONES DE LA PLANCHA */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col lg:flex-row justify-between items-center gap-3 shadow-md">
            
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-400">Giro Visual:</span>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setIsRotated(true)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 focus:outline-none ${
                    isRotated ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Optimizado para monitores de laptop/computadora"
                >
                  📐 Vista Horizontal (Panorámica)
                </button>
                <button 
                  onClick={() => setIsRotated(false)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 focus:outline-none ${
                    !isRotated ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Orientación tradicional vertical"
                >
                  🪜 Vista Vertical (Clásica)
                </button>
              </div>
            </div>

            <div className="text-xs">
              <span className="font-bold text-slate-400">Ver Pliego Master: </span>
              {packedSheets.length === 0 ? (
                <span className="text-slate-500 italic">No hay pliegos con material cargado</span>
              ) : (
                <select 
                  value={activeSheetIndex}
                  onChange={(e) => setActiveSheetIndex(parseInt(e.target.value))}
                  className="bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-xl font-bold cursor-pointer outline-none ml-2"
                >
                  {packedSheets.map((sheet, index) => (
                    <option key={sheet.id} value={index}>
                      Rollo Pág. {sheet.id} — Utilización {sheet.utilizationPercentage}% ({sheet.width/10}x{sheet.height/10} cm)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button 
              onClick={generatePDF}
              disabled={packedSheets.length === 0 || isGeneratingPdf}
              className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all focus:outline-none ${
                packedSheets.length === 0 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : isGeneratingPdf 
                    ? 'bg-cyan-700 text-slate-200 cursor-wait' 
                    : 'bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transform active:scale-95'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Procesando PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Exportar Pliego Master PDF</span>
                </>
              )}
            </button>
          </div>

          {isGeneratingPdf && (
            <div className="absolute inset-0 bg-slate-950/80 z-50 flex flex-col items-center justify-center gap-4 rounded-2xl backdrop-blur-xs">
              <div className="bg-linear-to-tr from-cyan-500 to-blue-600 p-4 rounded-full shadow-lg">
                <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="text-center animate-pulse">
                <h3 className="text-lg font-black text-white">Preparando el Pliego de Impresión Completo</h3>
                <p className="text-xs text-slate-400 mt-1">Generando vectores de alta calidad y líneas de pre-corte...</p>
                <div className="mt-4 bg-slate-900 border border-slate-850 text-cyan-400 text-xs font-mono px-4 py-1.5 rounded-full inline-block">
                  {pdfProgress}
                </div>
              </div>
            </div>
          )}

          {/* LIENZO DE LA PLANCHA DE TRABAJO */}
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col overflow-hidden relative shadow-inner">
            
            <div className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 mb-3 text-xs">
              {activeSheet ? (
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="font-extrabold text-slate-200">
                    Previsualización Rollo Master (Pág. {activeSheet.id})
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2.5 py-0.5 rounded text-slate-400 font-mono">
                    Bobina de impresión de {activeSheet.width / 10} x {activeSheet.height / 10} cm
                  </span>
                </div>
              ) : (
                <span className="text-slate-500">Ninguna plantilla interna con stickers ha sido agregada para el armado.</span>
              )}

              <div className="flex items-center gap-2.5">
                <span className="text-slate-400">Zoom:</span>
                <input 
                  type="range" 
                  min="25" 
                  max="100" 
                  value={zoomLevel} 
                  onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                  className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <span className="font-mono text-slate-300 w-8 text-right">{zoomLevel}%</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex justify-center items-center bg-slate-900/60 rounded-xl border border-slate-800 p-6 relative">
              {activeSheet ? (
                <div 
                  className="relative bg-slate-950 border border-dashed border-slate-700 shadow-2xl transition-all duration-300 origin-center"
                  style={{
                    width: isRotated ? `${activePlanchaHeight * scale}px` : `${activePlanchaWidth * scale}px`,
                    height: isRotated ? `${activePlanchaWidth * scale}px` : `${activePlanchaHeight * scale}px`,
                    backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                    backgroundSize: '12px 12px'
                  }}
                >
                  
                  {isRotated ? (
                    <div className="absolute top-0 -left-10 bottom-0 w-8 border-r border-slate-800 flex flex-col justify-between text-[9px] text-slate-500 select-none pr-1.5 font-mono text-right">
                      {Array.from({ length: Math.floor(activePlanchaWidth / 100) + 1 }).map((_, i) => (
                        <div key={i} className="absolute w-full" style={{ top: `${(i * 100) * scale}px` }}>{i * 10} cm —</div>
                      ))}
                      <div className="absolute w-full" style={{ top: `${activePlanchaWidth * scale}px` }}>{activePlanchaWidth / 10} cm —</div>
                    </div>
                  ) : (
                    <div className="absolute -top-6 left-0 right-0 h-5 border-b border-slate-800 flex justify-between text-[9px] text-slate-500 select-none px-1 font-mono">
                      {Array.from({ length: Math.floor(activePlanchaWidth / 100) + 1 }).map((_, i) => (
                        <div key={i} className="absolute" style={{ left: `${(i * 100) * scale}px` }}>| {i * 10} cm</div>
                      ))}
                      <div className="absolute" style={{ left: `${activePlanchaWidth * scale}px` }}>| {activePlanchaWidth / 10} cm</div>
                    </div>
                  )}

                  {isRotated ? (
                    <div className="absolute -top-6 left-0 right-0 h-5 border-b border-slate-800 flex justify-between text-[9px] text-slate-500 select-none px-1 font-mono">
                      {Array.from({ length: Math.floor(activePlanchaHeight / 100) + 1 }).map((_, i) => (
                        <div key={i} className="absolute" style={{ left: `${(i * 100) * scale}px` }}>| {i * 10} cm</div>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute top-0 -left-10 bottom-0 w-8 border-r border-slate-800 flex flex-col justify-between text-[10px] text-slate-600 select-none pr-1.5 font-mono text-right">
                      {Array.from({ length: Math.floor(activePlanchaHeight / 100) + 1 }).map((_, i) => (
                        <div key={i} className="absolute w-full" style={{ top: `${(i * 100) * scale}px` }}>{i * 10} cm —</div>
                      ))}
                    </div>
                  )}

                  <div 
                    className="absolute border border-dashed border-red-500/40 pointer-events-none rounded animate-pulse"
                    style={{
                      top: `${activeSheet.safeMargin * scale}px`,
                      left: `${activeSheet.safeMargin * scale}px`,
                      width: isRotated ? `${(activePlanchaHeight - (activeSheet.safeMargin * 2)) * scale}px` : `${(activePlanchaWidth - (activeSheet.safeMargin * 2)) * scale}px`,
                      height: isRotated ? `${(activePlanchaWidth - (activeSheet.safeMargin * 2)) * scale}px` : `${(activePlanchaHeight - (activeSheet.safeMargin * 2)) * scale}px`
                    }}
                  >
                    <span className="absolute -top-4 left-1 text-[8px] text-red-500/70 font-bold uppercase tracking-wider">
                      Límite Imprimible Rollo Maestro
                    </span>
                  </div>

                  {activeSheet.packedPlanchas.map((plancha) => {
                    const pLeft = isRotated ? plancha.y * scale : plancha.x * scale;
                    const pTop = isRotated ? plancha.x * scale : plancha.y * scale;
                    const pWidth = isRotated ? plancha.height * scale : plancha.width * scale;
                    const pHeight = isRotated ? plancha.width * scale : plancha.height * scale;

                    return (
                      <React.Fragment key={plancha.id}>
                        <div
                          className="absolute border-2 border-dashed rounded-xl pointer-events-none transition-all"
                          style={{
                            left: `${pLeft}px`,
                            top: `${pTop}px`,
                            width: `${pWidth}px`,
                            height: `${pHeight}px`,
                            borderColor: plancha.color,
                            backgroundColor: `${plancha.color}15`, 
                          }}
                        >
                          <div 
                            className="absolute border border-dotted rounded-lg"
                            style={{
                              top: `${5 * scale}px`,
                              left: `${5 * scale}px`,
                              right: `${5 * scale}px`,
                              bottom: `${5 * scale}px`,
                              borderColor: `${plancha.color}35`
                            }}
                          />
                        </div>

                        <div 
                          className="absolute text-[8px] font-black px-1.5 py-0.5 rounded text-white pointer-events-none z-10 truncate max-w-37.5 shadow-md"
                          style={{ 
                            backgroundColor: plancha.color,
                            left: `${pLeft + 6}px`,
                            top: `${pTop - 6}px`,
                          }}
                        >
                          {plancha.name}
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {activeSheet.packedPlanchas.flatMap(p => p.packedStickers).map((item) => {
                    const leftPos = isRotated ? item.globalY * scale : item.globalX * scale;
                    const topPos = isRotated ? item.globalX * scale : item.globalY * scale;
                    const widthSize = isRotated ? item.height * scale : item.width * scale;
                    const heightSize = isRotated ? item.width * scale : item.height * scale;

                    return (
                      <div
                        key={item.id}
                        className="absolute group cursor-pointer"
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
                          className="w-full h-full p-px rounded transition-all group-hover:scale-105 group-hover:shadow-lg relative overflow-hidden flex items-center justify-center checkboard-pattern"
                          style={{
                            border: `1.5px solid #22d3ee40`,
                            backgroundColor: 'rgba(30, 41, 59, 0.05)'
                          }}
                        >
                          <img 
                            src={item.imageSrc} 
                            alt={item.name} 
                            className="pointer-events-none object-contain w-full h-full"
                            style={{
                              transform: isRotated ? 'rotate(-90deg)' : 'none',
                              transition: 'transform 0.15s ease'
                            }}
                          />

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

                  {hoveredSticker && (
                    <div 
                      className="absolute bg-transparent border-2 border-dashed pointer-events-none z-30"
                      style={{
                        left: `${(isRotated ? hoveredSticker.globalY : hoveredSticker.globalX) * scale}px`,
                        top: `${(isRotated ? hoveredSticker.globalX : hoveredSticker.globalY) * scale}px`,
                        width: `${(isRotated ? hoveredSticker.height : hoveredSticker.width) * scale}px`,
                        height: `${(isRotated ? hoveredSticker.width : hoveredSticker.height) * scale}px`,
                        borderColor: '#22d3ee'
                      }}
                    ></div>
                  )}

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-600 gap-3">
                  <svg className="w-12 h-12 text-slate-850" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-400">Área de Visualización Vacía</p>
                    <p className="text-xs text-slate-500 mt-1">Sube tus stickers o carga los datos demo en una plantilla chica para empezar.</p>
                  </div>
                </div>
              )}
            </div>

            {activeSheet && (
              <div className="mt-3 flex flex-wrap justify-between items-center text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="flex gap-4">
                  <span>Plantillas chicas anidadas: <strong>{activeSheet.packedPlanchas.length}</strong></span>
                  <span>Ancho Útil Master: <strong>{(activeSheet.width - (activeSheet.safeMargin * 2)) / 10} cm</strong></span>
                  <span>Alto Útil Master: <strong>{(activeSheet.height - (activeSheet.safeMargin * 2)) / 10} cm</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>Aprovechamiento del Pliego Master: <strong className="text-cyan-400">{activeSheet.utilizationPercentage}%</strong></span>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ================= MODAL DE EDICIÓN AVANZADA (REMOVEDOR Y BORDES) ================= */}
      {editingImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-2">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🎨</span> Editor Avanzado de Stickers
                </h3>
                <p className="text-xs text-slate-400">Personaliza la transparencia del fondo y el contorno físico de tu sticker</p>
              </div>
              <button 
                onClick={() => setEditingImage(null)}
                className="text-slate-400 hover:text-white text-lg font-bold focus:outline-none"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-slate-800 mb-4">
              <button
                onClick={() => setActiveTab('bg')}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
                  activeTab === 'bg'
                    ? 'border-cyan-500 text-cyan-400 bg-slate-950/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🪄</span> Quitar Fondo
              </button>
              <button
                onClick={() => setActiveTab('stroke')}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
                  activeTab === 'stroke'
                    ? 'border-cyan-500 text-cyan-400 bg-slate-950/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>⭕</span> Contorno (Borde Offset)
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
              
              <div className="flex flex-col gap-5 justify-between">
                
                {activeTab === 'bg' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-slate-300">Activar Remoción de Fondo</label>
                      <input 
                        type="checkbox"
                        checked={isBgRemovalActive}
                        onChange={(e) => setIsBgRemovalActive(e.target.checked)}
                        className="rounded border-slate-800 text-cyan-500 w-4 h-4 cursor-pointer focus:ring-0"
                      />
                    </div>

                    {isBgRemovalActive && (
                      <>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Modo de Selección</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setBgMode('contiguous')}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all focus:outline-none ${
                                bgMode === 'contiguous'
                                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                              }`}
                            >
                              🪄 Varita Mágica (Contiguo)
                            </button>
                            <button
                              type="button"
                              onClick={() => setBgMode('global')}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all focus:outline-none ${
                                bgMode === 'global'
                                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                              }`}
                            >
                              🌍 Borrado Global (Todo)
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Preajustes Rápidos</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setTargetBgColor({ r: 255, g: 255, b: 255 });
                                setClickCoords({ x: 0, y: 0 }); 
                                setIsBgRemovalActive(true);
                              }}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all focus:outline-none ${
                                targetBgColor.r === 255 && targetBgColor.g === 255 && targetBgColor.b === 255
                                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-full bg-white border border-slate-700"></span>
                              Blanco
                            </button>
                            <button
                              onClick={() => {
                                setTargetBgColor({ r: 0, g: 0, b: 0 });
                                setClickCoords({ x: 0, y: 0 });
                                setIsBgRemovalActive(true);
                              }}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all focus:outline-none ${
                                targetBgColor.r === 0 && targetBgColor.g === 0 && targetBgColor.b === 0
                                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-full bg-black border border-slate-700"></span>
                              Negro
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl flex flex-col gap-2">
                          <span className="text-xs font-bold text-slate-400 block">Color de Fondo Seleccionado</span>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-xl border border-slate-750 shrink-0"
                              style={{ backgroundColor: `rgb(${targetBgColor.r}, ${targetBgColor.g}, ${targetBgColor.b})` }}
                            ></div>
                            <div className="text-xs">
                              <div className="font-mono font-bold text-slate-300">RGB({targetBgColor.r}, {targetBgColor.g}, {targetBgColor.b})</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">O pulsa cualquier color del sticker</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tolerancia base</span>
                            <span className="text-xs font-mono font-bold text-cyan-400">{bgTolerance}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={bgTolerance} 
                            onChange={(e) => setBgTolerance(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <span>🧼</span> Limpieza de Halo (Anti-Alias)
                            </span>
                            <span className="text-xs font-mono font-bold text-cyan-400">{haloCleanup} px</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="5" 
                            step="1"
                            value={haloCleanup} 
                            onChange={(e) => setHaloCleanup(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Aumenta si quedan motas o filamentos blancos imperfectos alrededor del borde.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'stroke' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-slate-300">Activar Borde de Sticker</label>
                      <input 
                        type="checkbox"
                        checked={strokeEnabled}
                        onChange={(e) => setStrokeEnabled(e.target.checked)}
                        className="rounded border-slate-800 text-cyan-500 w-4 h-4 cursor-pointer focus:ring-0"
                      />
                    </div>

                    {strokeEnabled && (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grosor de Contorno</span>
                            <span className="text-xs font-mono font-bold text-cyan-400">{strokeWidth} mm</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="10" 
                            step="0.5"
                            value={strokeWidth} 
                            onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Color del Contorno</span>
                          <div className="flex gap-2 mb-3">
                            <input 
                              type="color" 
                              value={strokeColor} 
                              onChange={(e) => setStrokeColor(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-none overflow-hidden"
                            />
                            <input 
                              type="text" 
                              value={strokeColor} 
                              onChange={(e) => setStrokeColor(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 uppercase"
                            />
                          </div>

                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { hex: '#ffffff', label: 'Blanco' },
                              { hex: '#ff00ff', label: 'Corte (Magenta)' },
                              { hex: '#00ffff', label: 'Cian' },
                              { hex: '#ffff00', label: 'Amarillo' },
                              { hex: '#ff0000', label: 'Rojo' },
                              { hex: '#00ff00', label: 'Verde' }
                            ].map(color => (
                              <button
                                key={color.hex}
                                type="button"
                                onClick={() => setStrokeColor(color.hex)}
                                className="w-7 h-7 rounded-lg border border-slate-800 transition-transform hover:scale-110 shrink-0 focus:outline-none"
                                style={{ backgroundColor: color.hex }}
                                title={`${color.label}: ${color.hex}`}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={restoreOriginalImage}
                  className="py-2.5 px-4 bg-red-950/40 hover:bg-red-950/60 border border-red-900/60 text-red-300 rounded-xl text-xs font-bold transition-colors w-full focus:outline-none"
                >
                  ↩ Deshacer Ediciones y Restablecer
                </button>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2 overflow-hidden justify-center items-center">
                <span className="text-xs font-bold text-slate-500 self-start mb-1">Previsualización del Sticker (Haz clic sobre el fondo para remover):</span>
                <div className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-2xl relative flex items-center justify-center p-4 checkboard-pattern overflow-auto">
                  <canvas 
                    ref={previewCanvasRef} 
                    className="max-w-full max-h-[45vh] object-contain rounded-lg shadow-xl"
                    style={{ display: 'none' }} 
                  />
                  {removalPreviewUrl && (
                    <img 
                      src={removalPreviewUrl} 
                      alt="Preview" 
                      onClick={handleCanvasClick}
                      className="max-w-full max-h-[45vh] object-contain cursor-crosshair rounded-lg hover:ring-2 hover:ring-cyan-500/50 transition-all"
                      title="Haz clic sobre cualquier color para removerlo del fondo"
                    />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 text-center flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Consejo: Usa "Varita Mágica" y sube el deslizador de "Limpieza de Halo" para borrar impurezas de bordes.
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
              <button 
                onClick={() => setEditingImage(null)}
                className="py-2 px-5 rounded-xl text-xs font-bold bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 focus:outline-none"
              >
                Cancelar
              </button>
              <button 
                onClick={saveTransparentImage}
                className="py-2 px-6 rounded-xl text-xs font-extrabold bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/10 focus:outline-none"
              >
                Guardar y Aplicar al Layout
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Estilos CSS Auxiliares para el patrón ajedrezado transparente de stickers */}
      <style>{`
        .checkboard-pattern {
          background-image: linear-gradient(45deg, #161e2e 25%, transparent 25%), 
                            linear-gradient(-45deg, #161e2e 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #161e2e 75%), 
                            linear-gradient(-45deg, transparent 75%, #161e2e 75%);
          background-size: 14px 14px;
          background-position: 0 0, 0 7px, 7px -7px, -7px 0px;
        }
      `}</style>

    </div>
  );
}