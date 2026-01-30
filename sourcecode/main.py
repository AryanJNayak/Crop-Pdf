from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
import fitz  # PyMuPDF
from fastapi.responses import FileResponse
import os
from fastapi.middleware.cors import CORSMiddleware

import json
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
class Annotation(BaseModel):
    x: float
    y: float
    w: float
    h: float

class CropRequest(BaseModel):
    # Dict where key is page index, value is list of boxes
    annotations: dict[str, list[Annotation]]



@app.post("/crop-pdf")
async def crop_pdf(pdf: UploadFile = File(...), annotations: str = Form(...)):
    doc = None
    input_path = f"temp_{pdf.filename}"
    output_path = f"cropped_{pdf.filename}"

    try:
        with open(input_path, "wb") as f:
            content = await pdf.read()
            f.write(content)

        doc = fitz.open(input_path)
        data = json.loads(annotations)

        for page_str, boxes in data.items():
            page_num = int(page_str)
            if page_num >= len(doc): continue
            
            page = doc[page_num]
            p_w, p_h = page.rect.width, page.rect.height

            # 1. Collect all "Keep" zones for this page
            keep_zones = []
            for b in boxes:
                x1, y1 = b['x'] * p_w, b['y'] * p_h
                x2, y2 = (b['x'] + b['w']) * p_w, (b['y'] + b['h']) * p_h
                keep_zones.append(fitz.Rect(x1, y1, x2, y2))

            if not keep_zones:
                continue

            # 2. To keep multiple boxes, we redact everything ELSE.
            # We create a large grid and redact sections that don't hit our keep_zones.
            # A simpler way with Redact: Redact the whole page, then 'apply' 
            # only to specific areas.
            
            # Since we want to white-out the REST, we'll find the 'Inverse' areas.
            # To keep the code simple and bug-free for multiple boxes, 
            # we use the 'Mask' approach with Redact:
            
            full_rect = page.rect
            # Add a redaction for the whole page with white fill
            page.add_redact_annot(full_rect, fill=(1, 1, 1))
            
            # Apply redactions - This usually clears the page.
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

            # 3. Now, we RE-INSERT the original content into our "holes"
            # We open a second copy of the doc to "steal" the original content back
            src_doc = fitz.open(input_path)
            src_page = src_doc[page_num]

            for zone in keep_zones:
                # This 'show_pdf_page' acts like a stamp, 
                # putting the original content back on top of the white redaction.
                page.show_pdf_page(zone, src_doc, page_num, clip=zone)
            
            src_doc.close()

        doc.save(output_path)
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}
    finally:
        if doc: doc.close()
        if os.path.exists(input_path): os.remove(input_path)

    return FileResponse(output_path, media_type="application/pdf")