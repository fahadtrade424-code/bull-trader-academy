// Pure Client-Side PDF 1.4 Generator (Zero External Libraries)
// Generates a clean, downloadable PDF Admission Slip with vector digital signature strokes

function pdfEscape(text) {
  return String(text || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars = 76) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.length ? lines : ['—'];
}

export function downloadAdmissionSlipPDF(student, academySettings) {
  const cmds = [];
  const pageW = 595; // A4 portrait points
  const pageH = 842;

  const text = (x, y, str, size = 10, font = 'F1', rgb = [0.12, 0.14, 0.18]) => {
    cmds.push(`BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(str)}) Tj ET`);
  };

  const rect = (x, y, w, h, fillRgb, strokeRgb = null, lineWidth = 1) => {
    cmds.push('q');
    if (fillRgb) cmds.push(`${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg`);
    if (strokeRgb) {
      cmds.push(`${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG ${lineWidth} w`);
    }
    cmds.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S'}`);
    cmds.push('Q');
  };

  const line = (x1, y1, x2, y2, rgb = [0.83, 0.69, 0.22], lw = 1) => {
    cmds.push(`q ${rgb[0]} ${rgb[1]} ${rgb[2]} RG ${lw} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S Q`);
  };

  // Outer page crisp white card surface & header banner
  rect(0, 0, pageW, pageH, [0.99, 0.985, 0.97]);
  rect(28, 728, pageW - 56, 86, [0.05, 0.06, 0.09], [0.83, 0.69, 0.22], 1.5);

  text(46, 782, (academySettings?.academyName || 'SIR HAMZA BULL TRADER ACADEMY').toUpperCase(), 15, 'F2', [0.94, 0.81, 0.42]);
  text(46, 763, 'OFFICIAL STUDENT ADMISSION SLIP', 11, 'F2', [0.96, 0.95, 0.92]);
  text(46, 745, `WhatsApp: ${academySettings?.whatsapp || '0325 6000474'}  |  Email: ${academySettings?.email || 'sirhamzawebsite@gmail.com'}`, 8.5, 'F1', [0.78, 0.76, 0.72]);

  // Student ID & Status Banner
  rect(28, 654, pageW - 56, 58, [0.95, 0.93, 0.88], [0.83, 0.69, 0.22], 1);
  text(44, 688, 'STUDENT ID', 8.5, 'F2', [0.42, 0.36, 0.2]);
  text(44, 668, student.id || 'PENDING', 15, 'F2', [0.08, 0.09, 0.12]);

  text(255, 688, 'ADMISSION STATUS', 8.5, 'F2', [0.42, 0.36, 0.2]);
  text(255, 669, (student.admissionStatus || 'Pending Review').toUpperCase(), 11, 'F2', [0.1, 0.12, 0.16]);

  text(425, 688, 'PAYMENT STATUS', 8.5, 'F2', [0.42, 0.36, 0.2]);
  text(425, 669, (student.paymentStatus || 'Pending Verification').toUpperCase(), 11, 'F2', [0.1, 0.12, 0.16]);

  // Section 1: Personal Information
  let y = 626;
  text(32, y, '01. STUDENT PERSONAL INFORMATION', 10.5, 'F2', [0.58, 0.43, 0.08]);
  line(32, y - 6, pageW - 32, y - 6, [0.83, 0.69, 0.22], 0.9);
  y -= 26;

  const drawRow = (label1, val1, label2, val2) => {
    text(34, y, label1, 8, 'F2', [0.45, 0.45, 0.48]);
    text(34, y - 13, String(val1 || '—').slice(0, 38), 10, 'F1', [0.1, 0.11, 0.14]);
    text(312, y, label2, 8, 'F2', [0.45, 0.45, 0.48]);
    text(312, y - 13, String(val2 || '—').slice(0, 38), 10, 'F1', [0.1, 0.11, 0.14]);
    line(34, y - 22, pageW - 34, y - 22, [0.88, 0.87, 0.84], 0.5);
    y -= 36;
  };

  drawRow('Full Name', student.fullName, "Father's Name", student.fatherName);
  drawRow('Date of Birth', student.dateOfBirth || '—', 'Mobile / Phone', student.phone);
  drawRow('Email Address', student.email, 'City / Country', [student.city, student.country].filter(Boolean).join(', '));

  text(34, y, 'Complete Address', 8, 'F2', [0.45, 0.45, 0.48]);
  const addrLines = wrapText(student.address || '—', 86);
  addrLines.slice(0, 2).forEach((ln, idx) => {
    text(34, y - 13 - idx * 12, ln, 9.5, 'F1', [0.1, 0.11, 0.14]);
  });
  line(34, y - 34, pageW - 34, y - 34, [0.88, 0.87, 0.84], 0.5);
  y -= 54;

  // Section 2: Course, Batch & Payment Details
  text(32, y, '02. COURSE, BATCH & PAYMENT DETAILS', 10.5, 'F2', [0.58, 0.43, 0.08]);
  line(32, y - 6, pageW - 32, y - 6, [0.83, 0.69, 0.22], 0.9);
  y -= 26;

  drawRow('Selected Course', student.courseName, 'Course Fee', `PKR ${Number(student.courseFee || 0).toLocaleString('en-US')}`);
  drawRow('Selected Batch', student.batchName, 'Batch Schedule', student.batchSchedule || 'As Assigned');
  drawRow('Payment Method', student.paymentMethod, 'Transaction ID', student.transactionId);
  drawRow('Trading Experience', student.experienceLevel, 'Application Date', new Date(student.createdAt || Date.now()).toLocaleDateString('en-GB'));

  // Learning Goals
  text(34, y, 'Learning Goals & Objectives', 8, 'F2', [0.45, 0.45, 0.48]);
  const goalLines = wrapText(student.learningGoals || '—', 86);
  goalLines.slice(0, 2).forEach((ln, idx) => {
    text(34, y - 13 - idx * 12, ln, 9.5, 'F1', [0.1, 0.11, 0.14]);
  });
  y -= 48;

  // Section 3: Digital Signature & Academy Seal
  rect(32, 92, 260, 108, [1, 1, 1], [0.82, 0.8, 0.75], 0.9);
  text(42, 184, 'STUDENT DIGITAL SIGNATURE', 8, 'F2', [0.45, 0.45, 0.48]);

  // Draw crisp vector strokes from signature canvas if available
  const strokes = Array.isArray(student.signatureStrokes) ? student.signatureStrokes : [];
  if (strokes.length > 0) {
    cmds.push('q 0.07 0.08 0.12 RG 1.4 w 1 J 1 j');
    for (const stroke of strokes) {
      if (!Array.isArray(stroke) || stroke.length < 2) continue;
      const sx = 44 + stroke[0].x * 234;
      const sy = 104 + (1 - stroke[0].y) * 68;
      cmds.push(`${sx.toFixed(1)} ${sy.toFixed(1)} m`);
      for (let i = 1; i < stroke.length; i++) {
        const px = 44 + stroke[i].x * 234;
        const py = 104 + (1 - stroke[i].y) * 68;
        cmds.push(`${px.toFixed(1)} ${py.toFixed(1)} l`);
      }
      cmds.push('S');
    }
    cmds.push('Q');
  } else {
    text(44, 134, student.fullName || 'Signed Digitally', 11, 'F2', [0.15, 0.16, 0.2]);
  }
  text(42, 100, `Signed electronically on ${new Date(student.createdAt || Date.now()).toLocaleDateString('en-GB')}`, 7.5, 'F1', [0.45, 0.45, 0.48]);

  rect(310, 92, pageW - 342, 108, [0.97, 0.95, 0.9], [0.83, 0.69, 0.22], 1);
  text(322, 180, 'ACADEMY VERIFICATION NOTE', 8.5, 'F2', [0.58, 0.43, 0.08]);
  text(322, 160, 'Verify your Student ID anytime on the', 8.5, 'F1', [0.22, 0.22, 0.25]);
  text(322, 147, 'official Student ID Verification page.', 8.5, 'F1', [0.22, 0.22, 0.25]);
  text(322, 124, `Admissions: ${academySettings?.whatsapp || '0325 6000474'}`, 8.5, 'F2', [0.12, 0.13, 0.16]);
  text(322, 108, `${academySettings?.email || 'sirhamzawebsite@gmail.com'}`, 8.5, 'F1', [0.12, 0.13, 0.16]);

  // Footer
  line(28, 70, pageW - 28, 70, [0.83, 0.69, 0.22], 0.8);
  text(32, 52, 'Generated locally by Sir Hamza Bull Trader Academy Admission System (Client-Side Document).', 8, 'F1', [0.45, 0.45, 0.48]);
  text(32, 39, 'Keep this slip for Student Portal access and batch onboarding.', 8, 'F1', [0.45, 0.45, 0.48]);

  const contentStream = cmds.join('\n');

  // Assemble PDF 1.4 byte structure cleanly
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`);
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  objects.push(`6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${student.id || 'Admission-Slip'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
