import PDFDocument from 'pdfkit';
import pool from '../config/mysql.js';
import IcmpMetric from '../models/IcmpMetric.js';

// Construye el objeto de datos del reporte (compartido por JSON/CSV/PDF,
// así los tres formatos siempre muestran exactamente los mismos números).
async function buildAuditReportData({ orgId, siteId, from, to }) {
  // 1. Validar que la sucursal pertenezca a la organización
  const [siteRows] = await pool.query(
    'SELECT siteId, name, address FROM sites WHERE siteId = ? AND orgId = ?',
    [siteId, orgId]
  );
  if (siteRows.length === 0) {
    return null;
  }
  const site = siteRows[0];

  // 2. Nodos de la sucursal
  const [nodes] = await pool.query(
    'SELECT nodeId, name, ipAddress, deviceType FROM nodes WHERE siteId = ?',
    [siteId]
  );

  // 3. Incidentes en el rango de fechas (incluye los de nodos ya eliminados,
  //    gracias a que incidents.nodeId ahora es NULL-able en vez de perderse)
  const [incidents] = await pool.query(
    `SELECT i.incidentId, i.nodeId, i.severity, i.type, i.title,
            i.isResolved, i.startedAt, i.resolvedAt,
            COALESCE(n.name, '(nodo eliminado)') AS nodeName
     FROM incidents i
     LEFT JOIN nodes n ON i.nodeId = n.nodeId
     WHERE i.siteId = ? AND i.startedAt BETWEEN ? AND ?
     ORDER BY i.startedAt DESC`,
    [siteId, from, to]
  );

  // 4. Disponibilidad real por nodo, calculada desde las métricas ICMP en Mongo
  const metricStats = await IcmpMetric.aggregate([
    {
      $match: {
        'metadata.site_id': Number(siteId),
        captured_at: { $gte: new Date(from), $lte: new Date(to) }
      }
    },
    {
      $group: {
        _id: '$metadata.node_id',
        totalPings: { $sum: 1 },
        downCount: { $sum: { $cond: [{ $eq: ['$status', 'DOWN'] }, 1, 0] } },
        avgLatencyMs: { $avg: '$avg_ms' },
        avgJitterMs: { $avg: '$jitter_ms' },
        avgLossPercent: { $avg: '$loss_percent' }
      }
    }
  ]);
  const metricsByNode = new Map(metricStats.map((m) => [String(m._id), m]));

  const nodeRows = nodes.map((n) => {
    const m = metricsByNode.get(String(n.nodeId));
    const totalPings = m?.totalPings || 0;
    const downCount = m?.downCount || 0;
    const uptimePercent = totalPings > 0
      ? Number((((totalPings - downCount) / totalPings) * 100).toFixed(2))
      : null;

    const nodeIncidents = incidents.filter((i) => i.nodeId === n.nodeId);

    return {
      nodeId: n.nodeId,
      name: n.name,
      ipAddress: n.ipAddress,
      deviceType: n.deviceType,
      uptimePercent,
      avgLatencyMs: m?.avgLatencyMs != null ? Number(m.avgLatencyMs.toFixed(2)) : null,
      avgJitterMs: m?.avgJitterMs != null ? Number(m.avgJitterMs.toFixed(2)) : null,
      avgLossPercent: m?.avgLossPercent != null ? Number(m.avgLossPercent.toFixed(2)) : null,
      totalIncidents: nodeIncidents.length,
      criticalIncidents: nodeIncidents.filter((i) => i.severity === 'CRITICAL').length,
      dataAvailable: totalPings > 0
    };
  });

  return {
    site,
    period: { from, to },
    generatedAt: new Date(),
    nodes: nodeRows,
    incidents
  };
}

// Una fecha "YYYY-MM-DD" sin hora (como la que manda un <input type="date">)
// se interpreta como medianoche UTC de ese día — como límite superior eso
// excluye TODO lo capturado ese mismo día. "Hasta: hoy" debe cubrir hoy
// completo, así que a un `to` sin hora se le empuja al final del día.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveDateRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  if (query.to && DATE_ONLY_RE.test(String(query.to).trim())) {
    to.setUTCHours(23, 59, 59, 999);
  }
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // últimos 30 días por default
  return { from, to };
}

// GET /api/reports/site/:siteId/audit?from=&to=&format=json|csv|pdf
export const getSiteAuditReport = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId } = req.params;
    const { format = 'json' } = req.query;
    const { from, to } = resolveDateRange(req.query);

    const report = await buildAuditReportData({ orgId, siteId, from, to });
    if (!report) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    if (format === 'csv') {
      return sendCsv(res, report);
    }
    if (format === 'pdf') {
      return sendPdf(res, report);
    }
    return res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generando el reporte de auditoría', error: error.message });
  }
};

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sendCsv(res, report) {
  const lines = [];

  lines.push(`Reporte de auditoria - ${csvEscape(report.site.name)}`);
  lines.push(`Periodo,${report.period.from.toISOString()},${report.period.to.toISOString()}`);
  lines.push('');

  lines.push('Nodo,IP,Tipo,Disponibilidad %,Latencia promedio (ms),Jitter promedio (ms),Perdida promedio (%),Incidentes totales,Incidentes criticos');
  report.nodes.forEach((n) => {
    lines.push([
      csvEscape(n.name),
      csvEscape(n.ipAddress),
      csvEscape(n.deviceType),
      csvEscape(n.uptimePercent ?? 'Sin datos'),
      csvEscape(n.avgLatencyMs ?? ''),
      csvEscape(n.avgJitterMs ?? ''),
      csvEscape(n.avgLossPercent ?? ''),
      csvEscape(n.totalIncidents),
      csvEscape(n.criticalIncidents)
    ].join(','));
  });

  lines.push('');
  lines.push('Historial de incidentes en el periodo');
  lines.push('Fecha,Nodo,Severidad,Tipo,Titulo,Resuelto,Fecha de resolucion');
  report.incidents.forEach((i) => {
    lines.push([
      csvEscape(new Date(i.startedAt).toISOString()),
      csvEscape(i.nodeName),
      csvEscape(i.severity),
      csvEscape(i.type),
      csvEscape(i.title),
      csvEscape(i.isResolved ? 'Si' : 'No'),
      csvEscape(i.resolvedAt ? new Date(i.resolvedAt).toISOString() : '')
    ].join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\n'); // BOM para que Excel abra bien los acentos

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="auditoria_${sanitizeFilename(report.site.name)}.csv"`
  );
  res.send(csvContent);
}

// Paleta compartida con el dashboard (dathua-front/src/assets/styles.css)
// para que el PDF se sienta parte de la misma marca, no un reporte genérico.
const COLOR = {
  orange: '#D96B14',
  dark: '#12161A',
  card: '#F4F5F6', // gris muy claro — el PDF es para imprimir, así que el
  border: '#E2E4E7', // fondo se queda blanco y el dark theme se usa solo en acentos
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  good: '#0CA30C',
  warning: '#FAB219',
  serious: '#EC835A',
  critical: '#D03B3B',
  neutral: '#6B7280',
};

const PAGE_MARGIN = 40;

function uptimeColor(pct, dataAvailable) {
  if (!dataAvailable || pct === null) return COLOR.neutral;
  if (pct >= 99) return COLOR.good;
  if (pct >= 95) return COLOR.warning;
  if (pct >= 85) return COLOR.serious;
  return COLOR.critical;
}

const SEVERITY_COLOR = {
  CRITICAL: COLOR.critical,
  HIGH: COLOR.serious,
  MEDIUM: COLOR.warning,
  LOW: COLOR.neutral,
  INFO: COLOR.neutral,
};

function severityColor(sev) {
  return SEVERITY_COLOR[String(sev).toUpperCase()] || COLOR.neutral;
}

// Encabezado de marca — banda oscura con el wordmark a la izquierda y los
// datos del reporte (sucursal/periodo) alineados a la derecha. Se repite
// en cada página nueva para que una tabla larga no pierda el contexto.
function drawHeader(doc, report) {
  const width = doc.page.width;
  doc.rect(0, 0, width, 72).fill(COLOR.dark);

  doc.fillColor(COLOR.orange).font('Helvetica-Bold').fontSize(20).text('DATHUA', PAGE_MARGIN, 24, { lineBreak: false });
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(9.5).text('Reporte de auditoría', PAGE_MARGIN, 47, { lineBreak: false });

  const rightWidth = 260;
  const rightX = width - PAGE_MARGIN - rightWidth;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(report.site.name, rightX, 20, { width: rightWidth, align: 'right' });
  doc.fillColor('#C9CDD3').font('Helvetica').fontSize(8.5).text(
    `${report.period.from.toLocaleDateString('es-MX')} — ${report.period.to.toLocaleDateString('es-MX')}`,
    rightX, 36, { width: rightWidth, align: 'right' }
  );
  if (report.site.address) {
    doc.fillColor('#9CA3AF').fontSize(8).text(report.site.address, rightX, 49, { width: rightWidth, align: 'right' });
  }

  doc.y = 92;
}

function sectionTitle(doc, text) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y + 1, 3, 13).fill(COLOR.orange);
  doc.fillColor(COLOR.dark).font('Helvetica-Bold').fontSize(12.5).text(text, PAGE_MARGIN + 10, y);
  doc.moveDown(0.7);
}

function ensureSpace(doc, report, neededHeight) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
    drawHeader(doc, report);
  }
}

function kpiCards(doc, report) {
  const withData = report.nodes.filter((n) => n.dataAvailable);
  const avgUptime = withData.length
    ? Math.round((withData.reduce((sum, n) => sum + n.uptimePercent, 0) / withData.length) * 10) / 10
    : null;
  const criticalCount = report.incidents.filter((i) => i.severity === 'CRITICAL').length;

  const cards = [
    { label: 'Equipos monitoreados', value: String(report.nodes.length), color: COLOR.dark },
    { label: 'Disponibilidad promedio', value: avgUptime !== null ? `${avgUptime}%` : 'Sin datos', color: uptimeColor(avgUptime, avgUptime !== null) },
    { label: 'Incidentes en el periodo', value: String(report.incidents.length), color: COLOR.dark },
    { label: 'Incidentes críticos', value: String(criticalCount), color: criticalCount > 0 ? COLOR.critical : COLOR.good },
  ];

  const width = doc.page.width - PAGE_MARGIN * 2;
  const gap = 10;
  const cardWidth = (width - gap * 3) / 4;
  const cardHeight = 52;
  const y = doc.y;

  cards.forEach((c, i) => {
    const x = PAGE_MARGIN + i * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke(COLOR.card, COLOR.border);
    doc.fillColor(COLOR.gray).font('Helvetica').fontSize(7.5).text(c.label.toUpperCase(), x + 10, y + 10, { width: cardWidth - 20 });
    doc.fillColor(c.color).font('Helvetica-Bold').fontSize(17).text(c.value, x + 10, y + 24, { width: cardWidth - 20 });
  });

  doc.y = y + cardHeight + 22;
}

const NODE_COLS = [
  { key: 'name', label: 'Equipo', width: 118 },
  { key: 'ipAddress', label: 'IP', width: 78 },
  { key: 'deviceType', label: 'Tipo', width: 62 },
  { key: 'uptime', label: 'Disponibilidad', width: 78 },
  { key: 'latency', label: 'Latencia', width: 62 },
  { key: 'loss', label: 'Pérdida', width: 55 },
  { key: 'incidents', label: 'Incidentes', width: 62 },
];

function nodeTableHeader(doc) {
  const y = doc.y;
  const height = 22;
  const width = NODE_COLS.reduce((s, c) => s + c.width, 0);
  doc.rect(PAGE_MARGIN, y, width, height).fill(COLOR.dark);

  let x = PAGE_MARGIN;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
  NODE_COLS.forEach((c) => {
    doc.text(c.label.toUpperCase(), x + 8, y + 7, { width: c.width - 12 });
    x += c.width;
  });
  doc.y = y + height;
}

function nodeTableRow(doc, n, index) {
  const rowHeight = 24;
  const width = NODE_COLS.reduce((s, c) => s + c.width, 0);
  const y = doc.y;

  if (index % 2 === 1) {
    doc.rect(PAGE_MARGIN, y, width, rowHeight).fill(COLOR.card);
  }

  let x = PAGE_MARGIN;
  doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.dark);

  doc.text(n.name, x + 8, y + 8, { width: NODE_COLS[0].width - 12 });
  x += NODE_COLS[0].width;
  doc.fillColor(COLOR.gray).text(n.ipAddress, x + 8, y + 8, { width: NODE_COLS[1].width - 12 });
  x += NODE_COLS[1].width;
  doc.text(n.deviceType, x + 8, y + 8, { width: NODE_COLS[2].width - 12 });
  x += NODE_COLS[2].width;

  const uColor = uptimeColor(n.uptimePercent, n.dataAvailable);
  doc.circle(x + 12, y + 12, 3).fill(uColor);
  doc.fillColor(COLOR.dark).text(
    n.dataAvailable ? `${n.uptimePercent}%` : 'Sin datos',
    x + 20, y + 8, { width: NODE_COLS[3].width - 28 }
  );
  x += NODE_COLS[3].width;

  doc.fillColor(COLOR.gray).text(n.avgLatencyMs != null ? `${n.avgLatencyMs} ms` : '—', x + 8, y + 8, { width: NODE_COLS[4].width - 12 });
  x += NODE_COLS[4].width;
  doc.text(n.avgLossPercent != null ? `${n.avgLossPercent}%` : '—', x + 8, y + 8, { width: NODE_COLS[5].width - 12 });
  x += NODE_COLS[5].width;

  doc.fillColor(n.criticalIncidents > 0 ? COLOR.critical : COLOR.dark).text(
    `${n.totalIncidents}${n.criticalIncidents > 0 ? ` (${n.criticalIncidents} crít.)` : ''}`,
    x + 8, y + 8, { width: NODE_COLS[6].width - 12 }
  );

  doc.y = y + rowHeight;
}

function incidentCard(doc, incident) {
  const width = doc.page.width - PAGE_MARGIN * 2;
  const height = 40;
  const y = doc.y;
  const color = severityColor(incident.severity);

  doc.roundedRect(PAGE_MARGIN, y, width, height, 4).fillAndStroke('#FFFFFF', COLOR.border);
  doc.rect(PAGE_MARGIN, y, 3, height).fill(color);

  doc.fillColor(COLOR.dark).font('Helvetica-Bold').fontSize(9.5).text(incident.title, PAGE_MARGIN + 14, y + 8, { width: width - 140 });

  const fecha = new Date(incident.startedAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.fillColor(COLOR.gray).font('Helvetica').fontSize(8).text(`${incident.nodeName} · ${fecha}`, PAGE_MARGIN + 14, y + 23, { width: width - 140 });

  // Chip de severidad
  const chipLabel = String(incident.severity).toUpperCase();
  doc.font('Helvetica-Bold').fontSize(7.5);
  const chipTextWidth = doc.widthOfString(chipLabel);
  const chipWidth = chipTextWidth + 16;
  const chipX = PAGE_MARGIN + width - chipWidth - 90;
  doc.roundedRect(chipX, y + 9, chipWidth, 14, 7).fillAndStroke(color, color);
  doc.fillColor('#FFFFFF').text(chipLabel, chipX + 8, y + 12.5, { lineBreak: false });

  // Estado resuelto/activo
  const statusLabel = incident.isResolved ? 'Resuelto' : 'Activo';
  doc.fillColor(incident.isResolved ? COLOR.good : COLOR.warning).font('Helvetica-Bold').fontSize(8).text(
    statusLabel, PAGE_MARGIN + width - 80, y + 13, { width: 80, align: 'right' }
  );

  doc.y = y + height + 8;
}

function drawFooters(doc, report) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // El footer vive dentro de la franja de márgenes de la página — sin
    // anular el margen inferior aquí, pdfkit interpreta que el texto "no
    // cabe" en el área de contenido y agrega una página en blanco extra
    // solo para escribirlo ahí.
    const previousBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 32;
    doc.moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).strokeColor(COLOR.border).lineWidth(0.5).stroke();
    doc.fillColor(COLOR.grayLight).font('Helvetica').fontSize(7.5).text(
      `Generado por DatHua el ${report.generatedAt.toLocaleString('es-MX')}`,
      PAGE_MARGIN, y + 8, { lineBreak: false }
    );
    doc.text(
      `Página ${i - range.start + 1} de ${range.count}`,
      doc.page.width - PAGE_MARGIN - 100, y + 8, { width: 100, align: 'right', lineBreak: false }
    );

    doc.page.margins.bottom = previousBottomMargin;
  }
}

function sendPdf(res, report) {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="auditoria_${sanitizeFilename(report.site.name)}.pdf"`
  );
  doc.pipe(res);

  drawHeader(doc, report);
  kpiCards(doc, report);

  sectionTitle(doc, 'Disponibilidad y desempeño por equipo');
  if (report.nodes.length === 0) {
    doc.fillColor(COLOR.gray).font('Helvetica').fontSize(9.5).text('Esta sucursal todavía no tiene equipos registrados.');
  } else {
    ensureSpace(doc, report, 22);
    nodeTableHeader(doc);
    report.nodes.forEach((n, i) => {
      ensureSpace(doc, report, 24);
      nodeTableRow(doc, n, i);
    });
  }
  doc.moveDown(1.5);

  ensureSpace(doc, report, 40);
  sectionTitle(doc, 'Historial de incidentes en el periodo');
  if (report.incidents.length === 0) {
    doc.fillColor(COLOR.gray).font('Helvetica').fontSize(9.5).text('No se registraron incidentes en este periodo.');
  } else {
    report.incidents.forEach((incident) => {
      ensureSpace(doc, report, 48);
      incidentCard(doc, incident);
    });
  }

  drawFooters(doc, report);
  doc.end();
}

function sanitizeFilename(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
}
