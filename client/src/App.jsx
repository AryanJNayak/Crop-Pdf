import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const App = () => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [file, setFile] = useState(null);
  const [annotations, setAnnotations] = useState({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentDrag, setCurrentDrag] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfRef, setPdfRef] = useState(null);

  // Constants for exact replica scaling
  const PAGE_WIDTH = 600;
  const handleCropPdf = async () => {
    if (!file || Object.keys(annotations).length === 0) {
      alert("Please upload a PDF and draw at least one rectangle.");
      return;
    }
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('annotations', JSON.stringify(annotations));

      const response = await fetch('http://localhost:8000/crop-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to process PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cropped_${file.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error cropping PDF:", error);
      alert("Error processing PDF. Check backend.");
    } finally {
      setIsProcessing(false);
    }
  };
  const onFileChange = (e) => {
    setFile(e.target.files[0]);
    setCurrentPage(1);
    setAnnotations({});
  };

  const onDocumentLoadSuccess = (pdf) => {
    setPdfRef(pdf);
    setNumPages(pdf.numPages);
  };

  const pageIndex = currentPage - 1;

  const handleMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    setCurrentDrag({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      w: Math.abs(currentX - startPos.x),
      h: Math.abs(currentY - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDrag) {
      setAnnotations(prev => ({
        ...prev,
        [pageIndex]: [...(prev[pageIndex] || []), currentDrag]
      }));
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentDrag(null);
  };

  const deleteRect = (i) => {
    const updated = [...(annotations[pageIndex] || [])];
    updated.splice(i, 1);
    setAnnotations({ ...annotations, [pageIndex]: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#f3f4f6' }}>

      {/* Header Toolbar */}
      <div style={{ padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <input type="file" onChange={onFileChange} accept="application/pdf" />

        <div>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
          <span style={{ margin: '0 15px' }}>Page {currentPage} of {numPages}</span>
          <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
        </div>

        <button
          onClick={handleCropPdf}
          disabled={isProcessing}
          style={{ backgroundColor: '#ef4444', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isProcessing ? 'Processing...' : 'Download Cropped PDF'}
        </button>
      </div>

      {/* Main Container: Row for Left/Right Mirror */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: Editor */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '40px', borderRight: '2px solid #ddd' }}>
          <div style={{ position: 'relative', width: PAGE_WIDTH, height: 'fit-content', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
              <Page pageNumber={currentPage} width={PAGE_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>

            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair', zIndex: 10 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {annotations[pageIndex]?.map((rect, i) => (
                <rect key={i} x={`${rect.x * 100}%`} y={`${rect.y * 100}%`} width={`${rect.w * 100}%`} height={`${rect.h * 100}%`} fill="rgba(255, 0, 0, 0.1)" stroke="red" strokeWidth="2" onClick={(e) => { e.stopPropagation(); deleteRect(i) }} />
              ))}
              {isDrawing && currentDrag && (
                <rect x={`${currentDrag.x * 100}%`} y={`${currentDrag.y * 100}%`} width={`${currentDrag.w * 100}%`} height={`${currentDrag.h * 100}%`} fill="transparent" stroke="red" strokeWidth="2" strokeDasharray="4" />
              )}
            </svg>
          </div>
        </div>

        {/* RIGHT: Exact Replica Preview */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '40px', backgroundColor: '#fff' }}>
          <div style={{ width: PAGE_WIDTH }}>
            <h3 style={{ textAlign: 'center', marginTop: 0 }}>Preview (Final Result)</h3>
            <CropPreview
              pdf={pdfRef}
              pageNumber={currentPage}
              boxes={annotations[pageIndex]}
              width={PAGE_WIDTH}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
export default App;

// --- PREVIEW COMPONENT ---
const CropPreview = ({ pdf, pageNumber, boxes, width }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const renderPreview = async () => {
      if (!pdf) return;
      const page = await pdf.getPage(pageNumber);

      // Calculate viewport based on the fixed width to match the left side
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // 1. Render PDF Content
      await page.render({ canvasContext: context, viewport }).promise;

      // 2. Apply White-out Mask
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.fillStyle = "white";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.globalCompositeOperation = 'destination-out';

      (boxes || []).forEach(box => {
        tempCtx.fillRect(box.x * canvas.width, box.y * canvas.height, box.w * canvas.width, box.h * canvas.height);
      });

      context.globalCompositeOperation = 'source-over';
      context.drawImage(tempCanvas, 0, 0);
    };

    renderPreview();
  }, [pdf, pageNumber, boxes, width]);

  return <canvas ref={canvasRef} style={{ width: '100%', border: '1px solid #ddd', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }} />;
};