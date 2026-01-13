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
  const isA4 = options.pageSize === 'letter';
  
  // A4/Letter specific settings - optimized for perfect A4 fit
  const titleFontSize = isSmallFormat ? 10 : 16;
  const sectionFontSize = isSmallFormat ? 8 : 11;
  const contentFontSize = isSmallFormat ? 7 : 10;
  const lineSpacing = isSmallFormat ? 4 : 6;
  const sectionSpacing = isSmallFormat ? 3 : 7;
  const margin = isSmallFormat ? 5 : 15;
  const topMargin = isSmallFormat ? 10 : 20;
  const startY = isSmallFormat ? 15 : 35;

  shippedShipments.forEach((shipment, index) => {
    // Add new page for each shipment (except the first one)
    if (index > 0) {
      pdf.addPage();
    }

    // Set font
    pdf.setFontSize(titleFontSize);
    pdf.setFont('helvetica', 'bold');

    // Title - centered at top
    pdf.text('SHIPPING LABEL', pageWidth / 2, topMargin, { align: 'center' });

    // Draw border around entire label area - optimized for A4 with proper padding
    pdf.setLineWidth(1);
    const borderPadding = 8; // Increased padding to prevent text overlap
    const borderY = topMargin + 8;
    const borderHeight = pageHeight - (topMargin + 20);
    const borderX = margin - borderPadding;
    const borderWidth = pageWidth - (margin * 2) + (borderPadding * 2);
    
    pdf.rect(borderX, borderY, borderWidth, borderHeight);

    // Define content area with proper padding inside border
    const contentPadding = 5; // Padding inside border to prevent text overlap
    const contentX = borderX + contentPadding;
    const contentWidth = borderWidth - (contentPadding * 2);
    const contentBottomY = borderY + borderHeight - contentPadding;

    let yPosition = startY;
    
    // Add a subtle divider line below title - use contentX for proper padding
    if (isA4) {
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(contentX, topMargin + 12, contentX + contentWidth, topMargin + 12);
      pdf.setDrawColor(0, 0, 0); // Reset to black
    }

    // From Address Section - use contentX for proper padding
    pdf.setFontSize(sectionFontSize);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FROM:', contentX, yPosition);
    yPosition += lineSpacing + 2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    
    if (shipment.from_first_name || shipment.from_last_name) {
      const name = `${shipment.from_first_name || ''} ${shipment.from_last_name || ''}`.trim();
      if (name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(name, contentX, yPosition);
        yPosition += lineSpacing;
        pdf.setFont('helvetica', 'normal');
      }
    }
    if (shipment.from_address) {
      pdf.text(shipment.from_address, contentX, yPosition);
      yPosition += lineSpacing;
    }
    if (shipment.from_address2) {
      pdf.text(shipment.from_address2, contentX, yPosition);
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
      pdf.text(fromCityState, contentX, yPosition);
      yPosition += lineSpacing;
    }

    yPosition += sectionSpacing;
    
    // Add divider line between FROM and TO sections for A4
    if (isA4) {
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(contentX, yPosition - 2, contentX + contentWidth, yPosition - 2);
      pdf.setDrawColor(0, 0, 0);
      yPosition += 2;
    }

    // To Address Section - use contentX for proper padding
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(sectionFontSize);
    pdf.text('TO:', contentX, yPosition);
    yPosition += lineSpacing + 2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    if (shipment.to_first_name || shipment.to_last_name) {
      const name = `${shipment.to_first_name || ''} ${shipment.to_last_name || ''}`.trim();
      if (name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(name, contentX, yPosition);
        yPosition += lineSpacing;
        pdf.setFont('helvetica', 'normal');
      }
    }
    if (shipment.to_address) {
      pdf.text(shipment.to_address, contentX, yPosition);
      yPosition += lineSpacing;
    }
    if (shipment.to_address2) {
      pdf.text(shipment.to_address2, contentX, yPosition);
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
      pdf.text(toCityState, contentX, yPosition);
      yPosition += lineSpacing;
    }

    yPosition += sectionSpacing;
    
    // Add divider line before package details for A4
    if (isA4) {
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(contentX, yPosition - 2, contentX + contentWidth, yPosition - 2);
      pdf.setDrawColor(0, 0, 0);
      yPosition += 2;
    }

    // Package Details Section - use contentX for proper padding
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(sectionFontSize);
    pdf.text('PACKAGE DETAILS:', contentX, yPosition);
    yPosition += lineSpacing + 2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(contentFontSize);
    
    // Dimensions - formatted clearly with proper padding
    const dimensions = `${shipment.length || 0}" × ${shipment.width || 0}" × ${shipment.height || 0}"`;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Dimensions:', contentX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dimensions, contentX + (isA4 ? 35 : 20), yPosition);
    yPosition += lineSpacing;
    
    // Weight - formatted clearly with proper padding
    const weight = `${shipment.weight_lbs || 0} lb ${shipment.weight_oz || 0} oz`;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Weight:', contentX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(weight, contentX + (isA4 ? 35 : 20), yPosition);
    yPosition += lineSpacing;

    // Order Information - use contentX for proper padding
    if (shipment.order_number) {
      yPosition += sectionSpacing - 2;
      if (isA4) {
        pdf.setLineWidth(0.3);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(contentX, yPosition - 2, contentX + contentWidth, yPosition - 2);
        pdf.setDrawColor(0, 0, 0);
        yPosition += 2;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(contentFontSize);
      pdf.text(`Order Number: ${shipment.order_number}`, contentX, yPosition);
      yPosition += lineSpacing;
    }

    // Bottom section - Tracking, Service, Cost
    // Add divider line before bottom section for A4 with proper padding
    if (isA4) {
      const bottomSectionY = contentBottomY - (isSmallFormat ? 15 : 20);
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(contentX, bottomSectionY, contentX + contentWidth, bottomSectionY);
      pdf.setDrawColor(0, 0, 0);
    }
    
    // Bottom positions with proper padding from border
    const bottomY = contentBottomY - (isSmallFormat ? 8 : 15);
    const bottomY2 = contentBottomY - (isSmallFormat ? 4 : 8);
    const bottomY3 = contentBottomY - (isSmallFormat ? 0 : 2);

    // Tracking Number (if available) - centered with proper padding
    if (shipment.tracking_number) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(isA4 ? 11 : (isSmallFormat ? 8 : 10));
      pdf.text(`Tracking Number: ${shipment.tracking_number}`, pageWidth / 2, bottomY, {
        align: 'center',
      });
    }

    // Shipping Service and Cost - side by side for A4 with proper padding
    if (isA4) {
      // Service on left with padding from border
      if (shipment.shipping_service) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(contentFontSize);
        pdf.text(
          `Service: ${shipment.shipping_service}`,
          contentX,
          bottomY2
        );
      }
      
      // Cost on right with padding from border
      if (shipment.shipping_cost) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(contentFontSize);
        pdf.text(
          `Cost: $${Number(shipment.shipping_cost).toFixed(2)}`,
          contentX + contentWidth,
          bottomY2,
          { align: 'right' }
        );
      }
    } else {
      // For 4x6, stack vertically
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

      if (shipment.shipping_cost) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(contentFontSize);
        pdf.text(
          `Cost: $${Number(shipment.shipping_cost).toFixed(2)}`,
          contentX,
          bottomY3
        );
      }
    }
  });

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `shipping-labels-${timestamp}.pdf`;

  // Save PDF
  pdf.save(filename);
};
