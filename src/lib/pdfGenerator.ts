import jsPDF from 'jspdf';

interface AtaData {
  meeting: {
    title: string;
    type: string;
    scheduled_at: string;
    duration_minutes: number;
    areas?: { name: string };
    meeting_rooms?: { name: string };
  };
  ata: {
    summary: string;
    decisions: string[];
    action_items: Array<{
      task: string;
      responsible: string;
      deadline: string;
    }>;
    approved_by?: string;
    approved_at?: string;
  };
}

export async function generateAtaPDF(data: AtaData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, maxWidth);
    
    // Check if we need a new page
    if (yPosition + (lines.length * fontSize * 0.35) > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
    
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * fontSize * 0.35 + 5;
  };

  // Add header
  doc.setFillColor(11, 61, 145); // Navy Blue (#0B3D91)
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ATA DE REUNIÃO', pageWidth / 2, 20, { align: 'center' });
  
  yPosition = 45;
  doc.setTextColor(0, 0, 0);

  // Meeting Information
  addText('INFORMAÇÕES DA REUNIÃO', 14, true);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Título:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.meeting.title, margin + 30, yPosition);
  yPosition += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Tipo:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.meeting.type, margin + 30, yPosition);
  yPosition += 7;

  if (data.meeting.areas) {
    doc.setFont('helvetica', 'bold');
    doc.text('Área:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.meeting.areas.name, margin + 30, yPosition);
    yPosition += 7;
  }

  if (data.meeting.meeting_rooms) {
    doc.setFont('helvetica', 'bold');
    doc.text('Sala:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.meeting.meeting_rooms.name, margin + 30, yPosition);
    yPosition += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Data:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const meetingDate = new Date(data.meeting.scheduled_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(meetingDate, margin + 30, yPosition);
  yPosition += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Duração:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.meeting.duration_minutes} minutos`, margin + 30, yPosition);
  yPosition += 15;

  // Summary
  doc.setDrawColor(11, 61, 145);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  addText('RESUMO EXECUTIVO', 14, true);
  addText(data.ata.summary);
  yPosition += 5;

  // Decisions
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  addText('DECISÕES TOMADAS', 14, true);
  
  if (data.ata.decisions && data.ata.decisions.length > 0) {
    data.ata.decisions.forEach((decision, index) => {
      addText(`${index + 1}. ${decision}`);
    });
  } else {
    addText('Nenhuma decisão registrada.');
  }
  yPosition += 5;

  // Action Items
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  addText('AÇÕES E RESPONSABILIDADES', 14, true);
  
  if (data.ata.action_items && data.ata.action_items.length > 0) {
    data.ata.action_items.forEach((item, index) => {
      addText(`${index + 1}. ${item.task}`, 10, true);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const detailsY = yPosition;
      doc.text(`   Responsável: ${item.responsible}`, margin, detailsY);
      yPosition += 5;
      doc.text(`   Prazo: ${item.deadline}`, margin, yPosition);
      yPosition += 8;
    });
  } else {
    addText('Nenhuma ação definida.');
  }

  // Approval information
  if (data.ata.approved_at) {
    yPosition += 10;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    addText('APROVAÇÃO', 14, true);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Aprovado em:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const approvalDate = new Date(data.ata.approved_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(approvalDate, margin + 35, yPosition);
    yPosition += 10;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `ATA_${data.meeting.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`;
  doc.save(fileName);
}
