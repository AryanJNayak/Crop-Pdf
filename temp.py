import subprocess

input_pdf = r"C:\Users\Lenovo\Downloads\Dashboard_Report.pdf"
output_pdf = "compressed.pdf"

subprocess.run([
    "gswin64c",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dPDFSETTINGS=/ebook",
    "-dNOPAUSE",
    "-dBATCH",
    "-dQUIET",
    f"-sOutputFile={output_pdf}",
    input_pdf
], check=True)

print("PDF compressed successfully!")