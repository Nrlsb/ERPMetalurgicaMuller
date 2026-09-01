/**
 * Utilidades de exportación e impresión para ERP Muller
 */

export interface ExportColumn<T = any> {
  header: string;
  key: keyof T | string;
  format?: (value: any, row: T) => string | number;
}

/**
 * Exporta un listado de datos a un archivo CSV compatible con Microsoft Excel (UTF-8 con BOM)
 */
export function exportToCsv<T = any>(
  filename: string,
  data: T[],
  columns: ExportColumn<T>[]
) {
  if (!data || data.length === 0) {
    alert('No hay datos disponibles para exportar.');
    return;
  }

  // Encabezados
  const headerRow = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(';');

  // Filas de datos
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        let val: any;
        if (typeof col.key === 'string' && col.key.includes('.')) {
          // Soporte para propiedades anidadas (ej. customer.name)
          const parts = col.key.split('.');
          val = parts.reduce((acc: any, part: string) => (acc ? acc[part] : undefined), row as any);
        } else {
          val = (row as any)[col.key];
        }

        if (col.format) {
          val = col.format(val, row);
        }

        if (val === null || val === undefined) {
          return '""';
        }

        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(';');
  });

  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imprime un elemento o abre el diálogo de impresión con estilos optimizados
 */
export function printDocument(elementId: string, title = 'Comprobante') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Elemento con ID "${elementId}" no encontrado para imprimir.`);
    return;
  }

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Por favor habilite las ventanas emergentes (popups) para imprimir el comprobante.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            box-sizing: border-box;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            text-align: left;
            font-size: 13px;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 600;
            color: #0f172a;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .text-primary { color: #2563eb; }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .totals-box {
            margin-top: 20px;
            margin-left: auto;
            width: 320px;
          }
          .footer-box {
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
