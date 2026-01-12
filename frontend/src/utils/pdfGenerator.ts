import jsPDF from 'jspdf';
import { Shipment } from '../types/shipment';

interface PDFOptions {
  pageSize: 'letter' | '4x6';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Generate PDF with shipping labels
 * Each shipment gets its own page in the selected dimension
 */
export const generateShippingLabelsPDF = (
  shipments: Shipment[],
  options: PDFOptions
): void => {
  // Filter only shipped products (those with labels)
  const shippedShipments = shipments.filter(s => s.has_label === true);
  
  if (shippedShipments.length === 0) {
    throw new Error('No shipped products found to print');
  }

  // Page dimensions in mm
  const pageDimensions = {
    letter: { width: 215.9, height: 279.4 }, // 8.5 x 11 inches in mm
    '4x6': { width: 101.6, height: 152.4 }, // 4 x 6 inches in mm
  };

  const dimensions = pageDimensions[options.pageSize];
  const orientation = options.orientation || 'portrait';
  
  // Swap dimensions for landscape
  const pageWidth = orientation === 'landscape' ? dimensions.height : dimensions.width;
  const pageHeight = orientation === 'landscape' ? dimensions.width : dimensions.height;

  // Create PDF
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  // Adjust font sizes and spacing based on page size
  const isSmallFormat = options.pageSize === '4x6';
  const titleFontSize = isSmallFormat ? 10 : 12;
  const sectionFontSize = isSmallFormat ? 8 : 10;
  const contentFontSize = isSmallFormat ? 7 : 9;
  const lineSpacing = isSmallFormat ? 4 : 5;
  const sectionSpacing = isSmallFormat ? 3 : 5;
  const margin = isSmallFormat ? 5 : 10;
  const topMargin = isSmallFormat ? 10 : 15;
  const startY = isSmallFormat ? 15 : 30;

  shippedShipments.forEach((shipment, index) => {
    // Add new page for each shipment (except the first one)
    if (index > 0) {
      pdf.addPage();
    }

    // Set font
    pdf.setFontSize(titleFontSize);
    pdf.setFont('helvetica', 'bold');

    // Title
    pdf.text('SHIPPING LABEL', pageWidth / 2, topMargin, { align: 'center' });

    // Draw border
    pdf.setLineWidth(0.5);
    pdf.rect(margin, topMargin + 5, pageWidth - (margin * 2), pageHeight - (topMargin + 15));

    let yPosition = startY;

    // From Address Section
    pdf.setFontSize(sectionFontSize);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FROM:', margin + 2, yPosition);
    yPosition += lineSpacing + 1;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    if (shipment.from_first_name || shipment.from_last_name) {
      const name = `${shipment.from_first_name || ''} ${shipment.from_last_name || ''}`.trim();
      if (name) {
        pdf.text(name, margin + 2, yPosition);
        yPosition += lineSpacing;
      }
    }
    if (shipment.from_address) {
      pdf.text(shipment.from_address, margin + 2, yPosition);
      yPosition += lineSpacing;
    }
    if (shipment.from_address2) {
      pdf.text(shipment.from_address2, margin + 2, yPosition);
      yPosition += lineSpacing;
    }
    const fromCityState = [
      shipment.from_city,
      shipment.from_state,
      shipment.from_zip,
    ]
      .filter(Boolean)
      .join(', ');
    if (fromCityState) {
      pdf.text(fromCityState, margin + 2, yPosition);
      yPosition += lineSpacing;
    }

    yPosition += sectionSpacing;

    // To Address Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(sectionFontSize);
    pdf.text('TO:', margin + 2, yPosition);
    yPosition += lineSpacing + 1;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    if (shipment.to_first_name || shipment.to_last_name) {
      const name = `${shipment.to_first_name || ''} ${shipment.to_last_name || ''}`.trim();
      if (name) {
        pdf.text(name, margin + 2, yPosition);
        yPosition += lineSpacing;
      }
    }
    if (shipment.to_address) {
      pdf.text(shipment.to_address, margin + 2, yPosition);
      yPosition += lineSpacing;
    }
    if (shipment.to_address2) {
      pdf.text(shipment.to_address2, margin + 2, yPosition);
      yPosition += lineSpacing;
    }
    const toCityState = [
      shipment.to_city,
      shipment.to_state,
      shipment.to_zip,
    ]
      .filter(Boolean)
      .join(', ');
    if (toCityState) {
      pdf.text(toCityState, margin + 2, yPosition);
      yPosition += lineSpacing;
    }

    yPosition += sectionSpacing;

    // Package Details Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(sectionFontSize);
    pdf.text('PACKAGE DETAILS:', margin + 2, yPosition);
    yPosition += lineSpacing + 1;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    const dimensions = `${shipment.length}" × ${shipment.width}" × ${shipment.height}"`;
    const weight = `${shipment.weight_lbs} lb ${shipment.weight_oz} oz`;
    pdf.text(dimensions, margin + 2, yPosition);
    yPosition += lineSpacing;
    pdf.text(weight, margin + 2, yPosition);
    yPosition += lineSpacing;

    // Order Information
    if (shipment.order_number) {
      yPosition += sectionSpacing - 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(contentFontSize);
      pdf.text(`Order #: ${shipment.order_number}`, margin + 2, yPosition);
      yPosition += lineSpacing;
    }

    // Bottom section - Tracking, Service, Cost
    const bottomY = pageHeight - (isSmallFormat ? 8 : 12);
    const bottomY2 = pageHeight - (isSmallFormat ? 4 : 8);

    // Tracking Number (if available)
    if (shipment.tracking_number) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(isSmallFormat ? 8 : 10);
      pdf.text(`Tracking: ${shipment.tracking_number}`, pageWidth / 2, bottomY, {
        align: 'center',
      });
    }

    // Shipping Service
    if (shipment.shipping_service) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(contentFontSize);
      pdf.text(
        `Service: ${shipment.shipping_service}`,
        pageWidth / 2,
        bottomY2,
        { align: 'center' }
      );
    }

    // Shipping Cost
    if (shipment.shipping_cost) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(contentFontSize);
      pdf.text(
        `Cost: $${Number(shipment.shipping_cost).toFixed(2)}`,
        margin + 2,
        bottomY2
      );
    }
  });

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `shipping-labels-${timestamp}.pdf`;

  // Save PDF
  pdf.save(filename);
};
