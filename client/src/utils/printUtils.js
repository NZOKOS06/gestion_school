import { toast } from 'react-hot-toast';

/**
 * Utility to print a given HTML string with unified styles avoiding popup blockers.
 * @param {string} title - The title of the document
 * @param {string} htmlBody - The HTML string representing the body content
 */
export const printHtml = (title, htmlBody) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const documentContent = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 24px; 
            color: #111;
            margin: 0;
            background: white;
          }
          h1 { 
            font-size: 18px; 
            margin: 0 0 4px 0; 
          }
          h2 { 
            font-size: 14px; 
            margin: 20px 0 8px 0; 
            border-bottom: 1px solid #ccc; 
            padding-bottom: 4px; 
          }
          .meta { 
            font-size: 12px; 
            color: #555; 
            margin-bottom: 16px; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px; 
            margin-bottom: 8px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 6px 8px; 
            text-align: left; 
          }
          th { 
            background: #f5f5f5; 
            font-weight: 600;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }
          .text-muted { color: #555; }
          
          /* Utility for timetable specifically */
          .timetable td { vertical-align: top; height: 60px; }
          
          @media print {
            body { padding: 0; }
            button { display: none; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
    </html>
  `;

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(documentContent);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
};
