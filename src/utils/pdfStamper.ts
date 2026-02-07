import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import bwipjs from 'bwip-js';

export const stampPdf = async (fileBuffer: Buffer, documentCode: string): Promise<{ buffer: Buffer, pageCount: number }> => {
  try {
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 7;

    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',       
      text: documentCode,    
      scale: 3,              
      height: 10,          
      includetext: false,    
      textxalign: 'center', 
    });

    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer);
    const barcodeDims = barcodeImage.scale(0.25); 

    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const footerText = `${documentCode}-${pageNum.toString().padStart(2, '0')}/${totalPages.toString().padStart(2, '0')}`;
      
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(footerText, fontSize);
      
      const contentRightMargin = 30;
      const textX = width - textWidth - contentRightMargin;
      const textY = 45; 

      const barcodeX = width - barcodeDims.width - contentRightMargin;
      const barcodeY = 15;

      page.drawText(footerText, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0), 
      });

      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeDims.width,
        height: barcodeDims.height,
      });

      const leftTextLine1 = "Digitally authorised document by";
      const leftTextLine2 = "Documentation Committee, Incridea '26";
      
      page.drawText(leftTextLine1, {
        x: 30,
        y: 38, 
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(leftTextLine2, {
        x: 30,
        y: 30, 
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const modifiedPdfBytes = await pdfDoc.save();
    return { buffer: Buffer.from(modifiedPdfBytes), pageCount: totalPages };
  } catch (error) {
    console.error('Error stamping PDF:', error);
    throw new Error('Failed to process PDF file');
  }
};
